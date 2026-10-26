import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {textureRestore,restorePlan} from '../server/texture-restore.mjs'
const plan={scene:'卧室',objects:['床','加湿器'],materials:{床:'棉布'},lighting:{光源:'窗户'}}
function fixture(){
 const records=new Map(),calls=[];const caps={routes:{'conversation-image':{available_routes:['gpt-image-2.5-sunburst','doubao-seedream-5-0-pro-260628'].map(model=>({model,provider:'test',supported_aspects:['1:1','2:3'],supported_resolutions:['2K'],max_images_per_call:4}))}}}
 const route=textureRestore({load:async id=>{if(!records.has(id))throw Object.assign(Error('missing'),{code:'ENOENT'});return structuredClone(records.get(id))},save:async p=>records.set(p.id,structuredClone(p)),create:async p=>{if(records.has(p.id))return false;records.set(p.id,structuredClone(p));return true},submit:async(job,input)=>{calls.push(input);records.set(job.id,{...job,status:'complete',images:[{src:'line'}]})},sync:async j=>j,publicJob:j=>j,vision:async(system,images)=>{assert.deepEqual(images,['base','ref']);return plan},capabilities:async()=>caps,valid:x=>!!x,inspect:async()=>({width:1000,height:1500})})
 return {route,records,calls}
}
async function ready(f){const id=randomUUID();await f.route('POST','/prepare',{requestId:id,base:'base',reference:'ref'});await new Promise(r=>setTimeout(r,10));const p=await f.route('GET','/preparations/'+id);assert.equal(p.status,'review');return id}
test('preparation and final submission preserve inputs, aspect and idempotency',async()=>{
 const f=fixture(),id=await ready(f);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.ratio,'2:3');assert.match(f.calls[0].prompt,/床、加湿器/)
 await f.route('POST','/prepare',{requestId:id,base:'base',reference:'ref'});assert.equal(f.calls.length,1)
 const body={preparationId:id,confirmed:false,supplement:'',options:{model:'doubao-seedream-5-0-pro-260628',ratio:'auto',resolution:'2K',count:4}}
 await assert.rejects(f.route('POST','/run',body),/确认/)
 const results=await Promise.all([f.route('POST','/run',{...body,confirmed:true}),f.route('POST','/run',{...body,confirmed:true})]);assert.equal(results[0].id,results[1].id);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].images,['line']);assert.equal(f.calls[1].options.ratio,'2:3');assert.doesNotMatch(f.calls[1].prompt,/skill|CLI/)
})
test('style reference is included only on explicit choice',async()=>{const f=fixture(),id=await ready(f);await f.route('POST','/run',{preparationId:id,confirmed:true,includeReference:true,supplement:'',options:{model:'doubao-seedream-5-0-pro-260628',ratio:'auto',count:4}});assert.deepEqual(f.calls[1].images,['line','ref'])})
test('incomplete visual analysis is rejected',()=>{assert.throws(()=>restorePlan({scene:'room',objects:[],materials:{},lighting:{}}));assert.deepEqual(restorePlan(plan),plan)})
test('visual analysis JSON may be wrapped in prose or a markdown fence',()=>{
 const wrapped='分析完成：\n```json\n'+JSON.stringify(plan)+'\n```\n'
 assert.deepEqual(restorePlan(wrapped),plan)
})

test('previous registry versions gain restoration without changing existing switches',async()=>{const {defaults,validateConfig}=await import('../server/function-config.mjs');const old=await defaults();old.features=old.features.filter(f=>f.id!=='texture-restore');old.features[0].enabled=false;const updated=validateConfig(old);assert.equal(updated.features.find(f=>f.id==='texture-restore').enabled,true);assert.equal(updated.features[0].enabled,false)})

test('automatic mode continues without preview or confirmation and reuses the same output',async()=>{
 const f=fixture(),id=randomUUID();await f.route('POST','/prepare',{requestId:id,base:'base',reference:'ref',automatic:true,supplement:'',options:{model:'doubao-seedream-5-0-pro-260628',ratio:'auto',count:4}})
 await new Promise(r=>setTimeout(r,2200));assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].images,['line']);const p=await f.route('GET','/preparations/'+id);assert.ok(p.finalId);await f.route('GET','/preparations/'+id);assert.equal(f.calls.length,2)
})

test('pipeline task keeps the parent ID and hides line images until final output',async()=>{
 const f=fixture(),id=randomUUID();await f.route('POST','/prepare',{requestId:id,base:'base',reference:'ref',automatic:true,supplement:'',options:{model:'doubao-seedream-5-0-pro-260628',ratio:'auto',count:4}})
 await new Promise(r=>setTimeout(r,20));const task=await f.route('GET','/tasks/'+id);assert.equal(task.id,id);assert.equal(task.status,'complete');assert.equal(task.phase.step,2);assert.equal(f.calls.length,2);assert.ok(task.images.length)
})
