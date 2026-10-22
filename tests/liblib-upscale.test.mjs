import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {liblibUpscale} from '../server/liblib-upscale.mjs'
test('mock upload, submit, restart, poll and save never resubmits',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'liblib-test-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const workflow={id:'test',enabled:true,version:1,name:'Test',template_uuid:'template',workflow_uuid:'workflow',load_image_node_id:'1',generate_params_template:{'1':{class_type:'LoadImage',inputs:{image:''}}},editable_params:[]}
 await writeFile(path.join(dir,'liblib.json'),JSON.stringify({accessKey:'test',secretKey:'test',workflows:[workflow]}))
 const load=async id=>JSON.parse(await readFile(path.join(dir,id+'.json'),'utf8'))
 let submitted=0,uploaded=0,resolveSaved;const saved=new Promise(r=>resolveSaved=r)
 const save=async j=>{await writeFile(path.join(dir,j.id+'.json'),JSON.stringify(j));if(j.generateUuid)resolveSaved()}
 const json=data=>new Response(JSON.stringify({code:0,data}))
 const fetcher=async(raw,options)=>{
  const url=new URL(raw)
  if(url.pathname==='/api/generate/upload/signature')return json({postUrl:'https://test.oss-cn-test.aliyuncs.com',key:'input.png',policy:'p',xOssSignature:'s',xOssDate:'d',xOssSignatureVersion:'v',xOssCredential:'c',xOssExpires:'1'})
  if(url.hostname==='test.oss-cn-test.aliyuncs.com'&&options.method==='POST'){uploaded++;const duringUpload=await runner.sync(await load(id));assert.equal(duringUpload.status,'uploading');assert.doesNotMatch(duringUpload.message,/中断|DREO/);assert.equal(options.headers,undefined);assert.ok(options.body.get('file'));return new Response('',{status:200})}
  if(url.pathname==='/api/generate/comfyui/app'){submitted++;return json({generateUuid:'remote-test'})}
  if(url.pathname==='/api/generate/comfy/status')return json({generateStatus:5,images:[{imageUrl:'https://test.oss-cn-test.aliyuncs.com/output.png',auditStatus:3}]})
  return new Response('mock image bytes',{headers:{'content-type':'image/png'}})
 }
 const deps={directory:dir,load,save,publicJob:j=>j,inspect:async()=>{},fetcher}
 const runner=liblibUpscale(deps),id='11111111-1111-4111-8111-111111111111',body={requestId:id,workflowId:'test',workflowVersion:1,base:'data:image/png;base64,AAAA',paramValues:{}}
 await runner.handle('POST','/api/skills/upscale/tasks',body);await saved
 const restarted=liblibUpscale(deps)
 const done=await restarted.sync(await load(id));assert.equal(done.status,'complete');assert.equal(done.images.length,1)
 await restarted.handle('POST','/api/skills/upscale/tasks',body)
 assert.equal(submitted,1);assert.equal(uploaded,1);assert.equal(done.taskId,undefined);assert.equal(done.generateUuid,'remote-test')
})
