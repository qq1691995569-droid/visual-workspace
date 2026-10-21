import test from 'node:test'
import assert from 'node:assert/strict'
import {deferredEdit,prepareDeferredEdit} from '../server/deferred-edit.mjs'
const asset={kind:'material',name:'织物',image:'data:image/png;base64,AAAA',prompt:'哑光织物',tags:[]}
const edit={deferredSelection:true,kind:'material',supplement:'仅换材质',regions:[{id:'a',mark:[.2,.2],target:'椅面',asset},{id:'b',mark:[.7,.7],target:'地毯',asset}]}
function deps(overrides={}){return {save:async()=>{},inspect:async()=>({width:1000,height:1000}),capabilities:async()=>({routes:{'conversation-image':{available_routes:[{model:'test',supported_aspects:['1:1','16:9','auto']}]}}}),validate:()=>({params:{}}),locate:async()=>({name:'已识别对象',points:[[.1,.1],[.3,.1],[.3,.3],[.1,.3]]}),prepare:async()=>({mask:'mask',outline:'outline',regionMap:'map',atlas:'atlas'}),submit:async()=>{},...overrides}}
test('仅标记和资产即可排队，不要求前台等待识别范围',()=>{
 assert.equal(deferredEdit(edit).regions.length,2)
 assert.throws(()=>deferredEdit({...edit,regions:[{...edit.regions[0],mark:[2,1]}]}),/标记/)
 assert.throws(()=>deferredEdit({...edit,regions:[{...edit.regions[0],asset:{...asset,kind:'model'}}]}),/资产/)
})
test('后台并发识别所有对象，阶段进度有序，并按编号组合定位图与材质提示词后才提交',async()=>{
 const gates=[],stages=[],job={options:{count:4}};let submitted=0,prepared
 const promise=prepareDeferredEdit(job,{base:'base',edit,options:{count:4}},deps({save:async j=>stages.push([j.phase.step,j.message]),locate:async(kind,mark)=>new Promise(resolve=>gates.push(()=>resolve({name:'对象'+mark[0],points:[[.1,.1],[.3,.1],[.3,.3],[.1,.3]]}))),prepare:async data=>{prepared=data;return {mask:'mask',outline:'outline',regionMap:'map',atlas:'atlas'}},submit:async(j,input)=>{submitted++;assert.deepEqual(input.images,['base','outline','map']);assert.equal(JSON.parse(input.prompt).regions.length,2)}}))
 await new Promise(resolve=>setImmediate(resolve));assert.equal(gates.length,2);assert.equal(submitted,0)
 gates[1]();gates[0]();await promise
 assert.equal(submitted,1);assert.equal(prepared.regions[0].target,'对象0.2');assert.equal(job.localEdit.regions.length,2);assert.equal(job.localEdit.spatialGuidance,'object-outline')
 assert.ok(stages.some(([s,m])=>s===1&&m.includes('2/2')));assert.ok(stages.some(([s])=>s===2))
})
test('识别失败或模型参数无效时，不组合错误选区且不提交生图',async()=>{
 let submitted=0,prepared=0,located=0
 await assert.rejects(prepareDeferredEdit({}, {base:'base',edit,options:{}},deps({locate:async()=>{throw Error('未可靠识别')},prepare:async()=>{prepared++},submit:async()=>{submitted++}})),/尚未提交生图/)
 assert.equal(prepared,0);assert.equal(submitted,0)
 await assert.rejects(prepareDeferredEdit({}, {base:'base',edit,options:{}},deps({validate:()=>{throw Error('参数不支持')},locate:async()=>{located++},submit:async()=>{submitted++}})),/参数不支持/)
 assert.equal(located,0);assert.equal(submitted,0)
})

test('仅显式图片参考才上传参考板，混合对象保留各自模式',async()=>{
 const mixed={...edit,regions:edit.regions.map((r,i)=>({...r,useImageReference:i===1}))}
 await prepareDeferredEdit({}, {base:'base',edit:mixed,options:{}},deps({prepare:async data=>{assert.deepEqual(data.regions.map(r=>r.useImageReference),[false,true]);return {mask:'mask',outline:'outline',regionMap:'map',atlas:'explicit-only-atlas'}},submit:async(j,input)=>{
  assert.deepEqual(input.images,['base','outline','map','explicit-only-atlas'])
  const plan=JSON.parse(input.prompt);assert.deepEqual(plan.regions.map(r=>r.guidance),['prompt','image']);assert.equal(plan.regions[0].referenceCell,undefined);assert.equal(plan.regions[1].referenceCell,2)
  assert.match(plan.instructionPriority[0],/用户补充/);assert.match(plan.conflictResolution,/不同时执行矛盾要求/);assert.equal(plan.locks,undefined);assert.match(plan.referenceRoles[1],/黑底白线/);assert.match(plan.boundaryCorrection,/排除人物/);assert.equal(plan.regions[0].mark[0],.2)
 }}))
})
