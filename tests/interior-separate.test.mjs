import test from 'node:test'
import assert from 'node:assert/strict'
import {validateSeparationPlan,separationRunner,separationPrompt,nativeSeparationPrompt,nativeLayerItems} from '../server/interior-separate.mjs'
import {canvasSkill} from '../server/canvas-skill.mjs'
import {configContext,defaults} from '../server/function-config.mjs'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
const plan=()=>({objects:[{id:'pot',name:'盆栽',disposition:'separate',includedParts:['植物','花盆'],excludedObjectIds:[],occludedByIds:[],bbox:{x:.1,y:.2,width:.3,height:.4}}],effects:[],unresolved:[]})
test('entry loads v3 persona and rules, not Qwen, including independent pillows rule',async()=>{const skill=await canvasSkill('separate');assert.equal(skill.processor,'interior-separate');assert.equal(skill.model,'doubao-seedream-5-0-pro-260628');assert.equal(skill.version,3);assert.match(skill.prompt,/固定执行人设/);assert.match(skill.prompt,/可移动的抱枕/);assert.match(skill.prompt,/每个抱枕/);assert.match(skill.prompt,/真实 Alpha 透明/);assert.match(separationPrompt(skill,plan(),plan().objects[0]),/纯白无纹理/);assert.equal(skill.hash.length,64)})
test('old admin persona cannot replace bundled v3 constraints; persona edits change task hash',async()=>{
 const config=await defaults(),feature=config.features.find(f=>f.id==='separate');feature.persona='旧人设：抱枕与沙发合并'
 const skill=await configContext.run(config,()=>canvasSkill('separate'))
 assert.ok(skill.prompt.indexOf('旧人设')<skill.prompt.indexOf('固定执行人设'))
 assert.match(skill.prompt,/后台旧人设与补充规则仅可表达兼容的偏好/)
 const root=await mkdtemp(path.join(tmpdir(),'separate-persona-'))
 try{
  const base=new URL('../server/skills/interior-scene-separate/',import.meta.url)
  await mkdir(path.join(root,'interior-scene-separate','references'),{recursive:true})
  for(const file of ['SKILL.md','PERSONA.md','references/plan-contract.md']){
   const target=path.join(root,'interior-scene-separate',file)
   await writeFile(target,await readFile(new URL(file,base),'utf8'))
  }
  const url=pathToFileURL(root+path.sep),before=await canvasSkill('separate',url)
  const personaFile=path.join(root,'interior-scene-separate','PERSONA.md')
  await writeFile(personaFile,(await readFile(personaFile,'utf8'))+'\n保留原始像素。')
  const after=await canvasSkill('separate',url)
  assert.notEqual(before.hash,after.hash)
  assert.match(after.prompt,/保留原始像素/)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('invalid references still fail; regional cyclic occlusion is retained for mask review',()=>{
 const p=plan();p.objects[0].occludedByIds=['missing'];assert.throws(()=>validateSeparationPlan(p))
 p.objects[0].occludedByIds=['pot'];assert.throws(()=>validateSeparationPlan(p))
 const q=plan();q.objects.push({...q.objects[0],id:'other',occludedByIds:['pot']});q.objects[0].occludedByIds=['other']
 const checked=validateSeparationPlan(q)
 assert.deepEqual(checked.objects,q.objects)
 assert.deepEqual(checked.occlusionReview.groups,[['pot','other']])
 assert.equal(checked.occlusionReview.requiresRegionalMasks,true)
 assert.equal(checked.occlusionReview.automaticCompositeAllowed,false)
 assert.equal(validateSeparationPlan(plan()).occlusionReview.status,'not_required')
})
test('only cyclic components need regional masks; unrelated occluders stay independent',()=>{
 const p=plan();p.objects= ['person','chair','blanket','lamp'].map(id=>({...p.objects[0],id,occludedByIds:[]}))
 p.objects[0].occludedByIds=['chair'];p.objects[1].occludedByIds=['blanket'];p.objects[2].occludedByIds=['person','lamp']
 assert.deepEqual(validateSeparationPlan(p).occlusionReview.groups,[['person','chair','blanket']])
})

function fixture(){const records=new Map(),active=new Set();let submits=0;const d={active,save:async j=>records.set(j.id,structuredClone(j)),load:async id=>{if(!records.has(id))throw Object.assign(Error(),{code:'ENOENT'});return structuredClone(records.get(id))},vision:async()=>plan(),capabilities:async()=>({}),imageRequest:()=>({}),submitImage:async j=>{submits++;j.taskId='remote';j.status='running';await d.save(j)},syncJob:async j=>({...j,status:'complete',images:[{src:'generated'}]}),cutout:async()=>({image:'alpha'}),imageTool:async()=>({image:'checked'}),deleted:()=>false};return {d,records,submits:()=>submits,job:{id:'parent',status:'analyzing',canvasSkill:{prompt:'rules'},options:{count:1},separation:{base:'original'},images:[]}}}
test('persisted children are queried, never re-submitted, original kept',async()=>{const f=fixture();const run=separationRunner(f.d);for(let i=0;i<5;i++)await run(f.job);assert.equal(f.job.status,'complete');assert.equal(f.submits(),2);assert.equal(f.job.images.length,2);assert.equal(f.job.separation.base,'original');assert.equal(f.job.images[1].review.alphaValidated,'true');await run(f.job);assert.equal(f.submits(),2)})
test('ambiguous submission pauses without another paid call',async()=>{const f=fixture();const run=separationRunner(f.d);await run(f.job);const id=f.job.separation.layers[0].jobId;f.records.set(id,{id,status:'submission_unknown',images:[]});f.d.syncJob=async j=>j;await run(f.job);assert.equal(f.job.status,'paused');await run(f.job);assert.equal(f.submits(),1)})
test('invalid alpha retains child result and does not generate next layer',async()=>{const f=fixture();const run=separationRunner(f.d);for(let i=0;i<3;i++)await run(f.job);f.d.imageTool=async()=>{throw Error('invalid alpha')};await run(f.job);assert.equal(f.job.status,'paused');assert.equal(f.submits(),2);assert.ok(f.job.separation.layers[0].output)})

test('regional overlap generates independent layers, preserving review metadata and raw analysis',async()=>{
 const f=fixture(),p=plan();p.objects.push({...p.objects[0],id:'chair',name:'椅子',occludedByIds:['pot']});p.objects[0].occludedByIds=['chair'];f.d.vision=async()=>p
 const run=separationRunner(f.d);for(let i=0;i<7;i++)await run(f.job)
 assert.equal(f.job.status,'complete');assert.equal(f.submits(),3);assert.equal(f.job.images.length,3)
 assert.deepEqual(f.job.separation.rawPlan,p)
 assert.equal(f.job.images[1].review.occlusionReview.requiresRegionalMasks,true)
 assert.deepEqual(f.job.separation.plan.objects,p.objects)
})
test('invalid analysis is saved for diagnosis without submitting images',async()=>{
 const f=fixture();f.d.vision=async()=>({objects:[]});await separationRunner(f.d)(f.job)
 assert.equal(f.job.status,'paused');assert.equal(f.submits(),0)
 assert.deepEqual(f.records.get('parent').separation.rawPlan,{objects:[]})
})
test('native decomposition submits once, maps transparent layers, and keeps the original',async()=>{
 const records=new Map(),active=new Set(),requests=[]
 const d={active,save:async job=>records.set(job.id,structuredClone(job)),vision:async()=>plan(),capabilities:async()=>({}),imageRequest:input=>{requests.push(input);return {params:{layer_decomposition:true}}},submitNative:async job=>{job.taskId='one-native-task';job.status='running';await d.save(job)},fetchNativeTask:async()=>({status:'completed',result:{data:[{z_index:0,url:'https://test/background.png'},{z_index:1,url:'https://test/pot.png',bounding_box:{normalized:[100,200,400,600]},name:'盆栽'}]}}),downloadImage:async url=>url,imageTool:async input=>({image:input.action+':'+input.result,resized:false}),deleted:()=>false}
 const job={id:'native-parent',status:'analyzing',canvasSkill:{prompt:'固定规则'},options:{count:1},separation:{native:true,base:'original'},images:[]}
 const run=separationRunner(d)
 await run(job);assert.equal(job.taskId,'one-native-task');assert.equal(requests.length,1);assert.equal(requests[0].layerDecomposition,true);assert.doesNotMatch(requests[0].prompt,/纯白无纹理/)
 await run(job);assert.equal(job.status,'complete');assert.equal(job.images.length,2);assert.equal(job.images[1].review.boundingBox,'100,200,400,600');assert.equal(job.separation.base,'original')
 await run(job);assert.equal(requests.length,1)
 assert.match(nativeSeparationPrompt(job.canvasSkill,plan()),/一张原图/)
 assert.ok(nativeSeparationPrompt(job.canvasSkill,plan()).length<300)
})
test('native result requires coordinates; over 16 objects stops before paid submission',async()=>{
 assert.throws(()=>nativeLayerItems({result:{data:[{z_index:0,url:'https://test/bg.png'},{z_index:1,url:'https://test/layer.png'}]}}),/坐标/)
 const p=plan();p.objects=Array.from({length:17},(_,i)=>({...p.objects[0],id:'object-'+i,name:'对象 '+i}))
 let submitted=0
 const job={id:'native-limit',status:'analyzing',canvasSkill:{prompt:'rules'},options:{count:1},separation:{native:true,base:'original'},images:[]}
 await separationRunner({active:new Set(),save:async()=>{},vision:async()=>p,submitNative:async()=>{submitted++}})(job)
 assert.equal(job.status,'paused');assert.match(job.message,/最多拆 16 层/);assert.equal(submitted,0)
})
test('transient native task query retries the same task without a second submission',async()=>{
 let queries=0,submissions=0
 const job={id:'native-query',status:'running',taskId:'existing-task',canvasSkill:{prompt:'rules'},options:{count:1},separation:{native:true,base:'original',plan:validateSeparationPlan(plan())},images:[]}
 const d={active:new Set(),save:async()=>{},fetchNativeTask:async()=>{if(++queries===1)throw Error('network');return {status:'completed',result:{data:[{z_index:0,url:'https://test/background.png'},{z_index:1,url:'https://test/layer.png',bounding_box:{normalized:[100,200,400,600]}}]}}},downloadImage:async url=>url,imageTool:async input=>({image:input.result}),submitNative:async()=>{submissions++}}
 const run=separationRunner(d)
 await run(job);assert.equal(job.status,'running');assert.equal(job.taskId,'existing-task')
 await run(job);assert.equal(job.status,'complete');assert.equal(queries,2);assert.equal(submissions,0)
})
test('historical HTTP 422 submission is marked rejected without resubmission',async()=>{
 let submissions=0
 const job={id:'native-rejected',status:'submission_unknown',submissionAttemptedAt:'2026-10-24T10:00:00Z',failure:{stage:'submission_unknown',message:'DREO 请求失败（HTTP 422）'},canvasSkill:{prompt:'rules'},separation:{native:true,base:'original',plan:validateSeparationPlan(plan())},images:[]}
 await separationRunner({active:new Set(),save:async()=>{},submitNative:async()=>{submissions++}})(job)
 assert.equal(job.status,'submit_error');assert.match(job.message,/HTTP 422/);assert.equal(submissions,0)
})
