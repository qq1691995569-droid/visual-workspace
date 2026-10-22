import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {signedLiblibUrl,workflowRequest,liblibClient} from '../server/liblib-client.mjs'
const workflow={template_uuid:'template-test',workflow_uuid:'workflow-test',load_image_node_id:'1',generate_params_template:{'1':{class_type:'LoadImage',inputs:{image:''}},'2':{class_type:'Test',inputs:{scale:2}}},editable_params:[{node_id:'2',params:[{name:'scale',input_type:'int',min:1,max:4,default:2}]}]}
test('signature uses only route, milliseconds and nonce',()=>{
 const url=signedLiblibUrl('/api/generate/comfy/status',{accessKey:'test',secretKey:'secret'},123,'nonce')
 assert.equal(url.searchParams.get('Signature'),createHmac('sha1','secret').update('/api/generate/comfy/status&123&nonce').digest('base64url'))
})
test('template binding validates overrides without mutating snapshot',()=>{
 assert.equal(workflowRequest(workflow,'image',{'2':{scale:3}}).generateParams['2'].inputs.scale,3)
 assert.equal(workflow.generate_params_template['2'].inputs.scale,2)
 assert.throws(()=>workflowRequest(workflow,'image',{'2':{scale:9}}))
 assert.throws(()=>workflowRequest(workflow,'image',{'3':{scale:2}}))
 assert.throws(()=>workflowRequest({...workflow,template_uuid:''},'image'))
})
test('HTTP 200 business failure is rejected without leaking remote text',async()=>{
 const api=liblibClient({accessKey:'test',secretKey:'test'},async()=>new Response(JSON.stringify({code:99,message:'secret'})))
 await assert.rejects(api.call('/api/generate/comfy/status',{}),e=>e.message.includes('99')&&!e.message.includes('secret'))
})
