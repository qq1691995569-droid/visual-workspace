import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir,homedir} from 'node:os'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'

test('OpenLux 拆层与框选编辑各提交一次，结果保存且不重复扣费请求', {timeout:30000}, async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'openlux-native-'))
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const images=JSON.parse(spawnSync(python,['-c',`from PIL import Image
import io,base64,json
def encode(image):
 buf=io.BytesIO();image.save(buf,format='PNG');return base64.b64encode(buf.getvalue()).decode()
print(json.dumps({'base':encode(Image.new('RGB',(512,512),'white')),'layer':encode(Image.new('RGBA',(154,205),(120,80,40,255)))}))`],{encoding:'utf8'}).stdout)
 let submissions=0,submitted
 const mock=createServer(async(req,res)=>{
  if(req.url==='/background.png'||req.url==='/layer.png'){
   res.setHeader('Content-Type','image/png');res.end(Buffer.from(req.url==='/background.png'?images.base:images.layer,'base64'));return
  }
  let body='';for await(const chunk of req)body+=chunk
  res.setHeader('Content-Type','application/json')
  if(req.url==='/vision'){
   res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({objects:[{id:'pot',name:'盆栽',kind:'plant',disposition:'separate',includedParts:['植物','花盆'],excludedObjectIds:[],occludedByIds:[],bbox:{x:.1,y:.2,width:.3,height:.4},uncertainRegions:[],confidence:.9,reviewNotes:[]}],effects:[],unresolved:[]})}}]}));return
  }
  if(req.url==='/v1/images/generations'){
   submissions++;submitted=JSON.parse(body)
   const origin=`http://127.0.0.1:${mock.address().port}`
   res.end(JSON.stringify({model:'doubao-seedream-5-0-pro-260628',data:submitted.layer_decomposition?[{z_index:0,url:origin+'/background.png'},{z_index:1,url:origin+'/layer.png',bounding_box:{normalized:[100,200,400,600]},name:'盆栽'}]:[{url:origin+'/background.png'}]}));return
  }
  res.statusCode=404;res.end('{}')
 })
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve))
 const origin=`http://127.0.0.1:${mock.address().port}`
 const credentials=path.join(directory,'openlux.json')
 await writeFile(credentials,JSON.stringify({origin:origin+'/v1',token:'test-token'}))
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5192','--strictPort'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,CANVAS_DATA_DIR:path.join(directory,'data'),CANVAS_OPENLUX_CONFIG:credentials,CANVAS_VISION_CONFIG_PATH:'',CANVAS_VISION_ENDPOINT:origin+'/vision',CANVAS_VISION_TOKEN:'test-vision',CANVAS_VISION_MODEL:'mock',CANVAS_PYTHON:python},stdio:'ignore'})
 const api='http://127.0.0.1:5192'
 async function call(route,body){const response=await fetch(api+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()}}
 try{
  let ready=false
  for(let i=0;i<40;i++){try{ready=(await call('/api/skills/status')).status===200;if(ready)break}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  assert.ok(ready)
  const input={requestId:randomUUID(),operation:'separate',base:'data:image/png;base64,'+images.base,parameters:{prompt:''},options:{model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:4}}
  const created=await call('/api/skills/canvas/tasks',input)
  assert.equal(created.status,200,JSON.stringify(created.data))
  let result
  for(let i=0;i<50;i++){result=(await call('/api/skills/images/tasks/'+created.data.id)).data;if(['complete','paused','submit_error','submission_unknown'].includes(result.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
  assert.equal(result.status,'complete',JSON.stringify({status:result.status,message:result.message}))
  assert.equal(submissions,1)
  assert.equal(submitted.layer_decomposition,true)
  assert.equal(submitted.size,'auto')
  assert.equal(submitted.model,'doubao-seedream-5-0-pro-260628')
  assert.match(submitted.image,/^data:image\/png;base64,/)
  assert.equal(result.images.length,2)
  assert.equal(result.images[1].review.boundingBox,'100,200,400,600')
  await call('/api/skills/images/tasks/'+created.data.id)
  assert.equal(submissions,1)
  const edit={requestId:randomUUID(),operation:'edit',base:'data:image/png;base64,'+images.base,parameters:{prompt:'把区域 1 的盆栽改成蓝色',boxes:[[100,200,400,600]]},options:{model:'dreo-default',resolution:'2K',count:4}}
  const edited=await call('/api/skills/canvas/tasks',edit)
  assert.equal(edited.status,200,JSON.stringify(edited.data))
  let editedResult
  for(let i=0;i<50;i++){editedResult=(await call('/api/skills/images/tasks/'+edited.data.id)).data;if(['complete','paused','submit_error','submission_unknown','needs_attention'].includes(editedResult.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
  assert.equal(editedResult.status,'complete',JSON.stringify({status:editedResult.status,message:editedResult.message}))
  assert.equal(editedResult.images.length,1)
  assert.equal(submissions,2)
  assert.match(submitted.prompt,/<bbox>100 200 400 600<\/bbox>/)
  assert.equal(submitted.model,'doubao-seedream-5-0-pro-260628')
  assert.equal(submitted.layer_decomposition,undefined)
  assert.equal(submitted.size,'2K')
  await call('/api/skills/images/tasks/'+edited.data.id)
  assert.equal(submissions,2)
 }finally{
  vite.kill();await new Promise(resolve=>vite.exitCode!==null?resolve():vite.once('exit',resolve))
  await new Promise(resolve=>mock.close(resolve))
  await rm(directory,{recursive:true,force:true})
 }
})
