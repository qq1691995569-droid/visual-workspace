import {test} from 'node:test'
import assert from 'node:assert/strict'
import {upscaleBridge} from '../server/upscale-bridge.mjs'
const requestId='11111111-1111-4111-8111-111111111111'
const input={requestId,base:'image',workflowId:'flow',workflowVersion:1,paramValues:{'1':{scale:2}}}
const workflow={id:'flow',version:1,editable_params:[{node_id:'1',params:[{name:'scale',input_type:'int',min:1,max:4,default:2}]}],cross_field_rules:[]}
function setup(fail=false){
 const records=new Map(),calls=[],active=new Set(),monitored=[]
 const load=async id=>{if(!records.has(id))throw Object.assign(Error('missing'),{code:'ENOENT'});return records.get(id)}
 const handle=upscaleBridge({dreo:async(method,url,body)=>{calls.push({method,url,body});if(url==='/upscale/workflows')return {items:[workflow],credits:2};if(url==='/upload')return {storage_key:'user/input.png'};if(url==='/tasks'){if(fail)throw Error('timeout');return {task_id:'remote-task'}}},load,save:async job=>records.set(job.id,{...job}),create:async job=>{if(records.has(job.id))return false;records.set(job.id,{...job});return true},active,monitor:id=>monitored.push(id),publicJob:job=>({...job}),imageValid:()=>true})
 return {handle,records,calls,monitored}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('uploads original once and reuses request after duplicate submit',async()=>{
 const t=setup();await t.handle('POST','/api/skills/upscale/tasks',input);await settle();await t.handle('POST','/api/skills/upscale/tasks',input)
 assert.equal(t.calls.filter(call=>call.url==='/tasks').length,1)
 assert.equal(t.calls.find(call=>call.url==='/tasks').body.tool_type,'upscaler')
 assert.equal(t.records.get(requestId).taskId,'remote-task')
 await assert.rejects(()=>t.handle('POST','/api/skills/upscale/tasks',{...input,base:'other'}),/冲突/)
})
test('ambiguous upstream submission is retained and never automatically resubmitted',async()=>{
 const t=setup(true);await t.handle('POST','/api/skills/upscale/tasks',input);await settle();assert.equal(t.records.get(requestId).status,'submission_unknown')
 await t.handle('POST','/api/skills/upscale/tasks',input);assert.equal(t.calls.filter(call=>call.url==='/tasks').length,1)
})
test('invalid parameters and stale workflow never upload or create task',async()=>{
 const t=setup();await assert.rejects(()=>t.handle('POST','/api/skills/upscale/tasks',{...input,paramValues:{'1':{scale:9}}}),/范围/)
 await assert.rejects(()=>t.handle('POST','/api/skills/upscale/tasks',{...input,workflowVersion:2}),/变更/)
 assert.equal(t.calls.filter(call=>call.method==='POST').length,0)
})
test('recovery reuses existing remote task without submitting new generation',async()=>{
 const t=setup();await t.handle('POST','/api/skills/upscale/tasks',input);await settle();t.records.get(requestId).status='paused'
 await t.handle('POST','/api/skills/upscale/recover',{requestId});assert.equal(t.records.get(requestId).status,'running');assert.equal(t.calls.filter(call=>call.url==='/tasks').length,1)
})
