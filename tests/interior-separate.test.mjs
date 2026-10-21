import test from 'node:test'
import assert from 'node:assert/strict'
import {validateSeparationPlan,separationRunner,separationPrompt} from '../server/interior-separate.mjs'
import {canvasSkill} from '../server/canvas-skill.mjs'
const plan=()=>({objects:[{id:'pot',name:'盆栽',disposition:'separate',includedParts:['植物','花盆'],excludedObjectIds:[],occludedByIds:[],bbox:{x:.1,y:.2,width:.3,height:.4}}],effects:[],unresolved:[]})
test('entry loads interior skill, not Qwen, including independent pillows rule',async()=>{const skill=await canvasSkill('separate');assert.equal(skill.processor,'interior-separate');assert.equal(skill.model,'doubao-seedream-5-0-pro-260628');assert.match(skill.prompt,/每个抱枕/);assert.match(separationPrompt(skill,plan(),plan().objects[0]),/纯白无纹理/);assert.equal(skill.hash.length,64)})
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
