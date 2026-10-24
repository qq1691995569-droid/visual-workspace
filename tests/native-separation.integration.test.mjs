import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir,homedir} from 'node:os'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'

test('one native DREO task imports background and original-coordinate alpha layers', {timeout:30000}, async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'native-separation-'))
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const images=JSON.parse(spawnSync(python,['-c',`from PIL import Image
import io,base64,json
def encode(image):
 buf=io.BytesIO();image.save(buf,format='PNG');return base64.b64encode(buf.getvalue()).decode()
print(json.dumps({'base':encode(Image.new('RGB',(512,512),'white')),'layer':encode(Image.new('RGBA',(154,205),(120,80,40,255)))}))`],{encoding:'utf8'}).stdout)
 let submissions=0,request,rejectNext=false
 const mock=createServer(async(req,res)=>{
  if(req.url==='/background.png'||req.url==='/layer.png'){
   res.setHeader('Content-Type','image/png');res.end(Buffer.from(req.url==='/background.png'?images.base:images.layer,'base64'));return
  }
  let body='';for await(const chunk of req)body+=chunk
  res.setHeader('Content-Type','application/json')
  if(req.url==='/vision'){
   res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({objects:[{id:'pot',name:'盆栽',kind:'plant',disposition:'separate',includedParts:['植物','花盆'],excludedObjectIds:[],occludedByIds:[],bbox:{x:.1,y:.2,width:.3,height:.4},uncertainRegions:[],confidence:.9,reviewNotes:[]}],effects:[],unresolved:[]})}}]}));return
  }
  if(req.url==='/api/agent/capabilities'){
   const route={provider:'seedream',model:'doubao-seedream-5-0-pro-260628',supported_resolutions:['2K'],supported_aspects:['1:1'],max_images_per_call:1,max_reference_images:1}
   res.end(JSON.stringify({routes:{'conversation-image':{model:route.model,available_routes:[route]}}}));return
  }
  if(req.url==='/api/agent/upload'){res.end(JSON.stringify({storage_key:'original-key'}));return}
  if(req.url==='/api/agent/tasks'&&req.method==='POST'){
   submissions++;request=JSON.parse(body)
   if(rejectNext){res.statusCode=422;res.end(JSON.stringify({detail:[{loc:['body','params','layer_decomposition'],msg:'Extra inputs are not permitted',type:'extra_forbidden',input:'private-storage-key'}]}));return}
   res.end(JSON.stringify({task_id:'one-native-task'}));return
  }
  if(req.url==='/api/agent/tasks/one-native-task'){
   const origin=`http://127.0.0.1:${mock.address().port}`
   res.end(JSON.stringify({status:'success',result:{data:[{z_index:0,url:origin+'/background.png'},{z_index:1,url:origin+'/layer.png',bounding_box:{normalized:[100,200,400,600]},name:'盆栽'}]}}));return
  }
  res.statusCode=404;res.end('{}')
 })
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve))
 const origin=`http://127.0.0.1:${mock.address().port}`
 const credentials=path.join(directory,'credentials.json')
 await writeFile(credentials,JSON.stringify({origin,token:'test-token'}))
 const openlux=path.join(directory,'openlux.json'),data=path.join(directory,'data')
 await writeFile(openlux,JSON.stringify({origin:origin+'/v1',token:'test-openlux-token'}))
 await mkdir(data)
 await writeFile(path.join(data,'api-routing.json'),JSON.stringify({schema:1,bindings:{separate:'dreo'}}))
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5191','--strictPort'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,CANVAS_DATA_DIR:data,CANVAS_DREO_CONFIG:credentials,CANVAS_OPENLUX_CONFIG:openlux,CANVAS_VISION_CONFIG_PATH:'',CANVAS_VISION_ENDPOINT:origin+'/vision',CANVAS_VISION_TOKEN:'test-vision',CANVAS_VISION_MODEL:'mock',CANVAS_PYTHON:python},stdio:'ignore'})
 const api='http://127.0.0.1:5191'
 async function call(route,body){const response=await fetch(api+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()}}
 try{
  let ready=false
  for(let i=0;i<40;i++){try{ready=(await call('/api/skills/status')).data.dreoConnected;if(ready)break}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  assert.ok(ready,'isolated server started')
  const input={requestId:randomUUID(),operation:'separate',base:'data:image/png;base64,'+images.base,parameters:{prompt:''},options:{model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:4}}
  const created=await call('/api/skills/canvas/tasks',input)
  assert.equal(created.status,200,JSON.stringify(created.data))
  let result
  for(let i=0;i<50;i++){result=(await call('/api/skills/images/tasks/'+created.data.id)).data;if(['complete','paused','submission_unknown'].includes(result.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
  assert.equal(result.status,'complete',JSON.stringify({status:result.status,message:result.message}))
  assert.equal(submissions,1)
  assert.equal(request.params.layer_decomposition,true)
  assert.equal(request.params.ratio,'auto')
  assert.equal('size' in request.params,false)
  assert.deepEqual(request.params.image_paths,['original-key'])
  assert.equal(result.images.length,2)
  assert.equal(result.images[1].review.boundingBox,'100,200,400,600')
  assert.match(result.images[1].src,/^data:image\/png;base64,/)
  rejectNext=true
  const rejected=await call('/api/skills/canvas/tasks',{...input,requestId:randomUUID()})
  assert.equal(rejected.status,200)
  let failed
  for(let i=0;i<50;i++){failed=(await call('/api/skills/images/tasks/'+rejected.data.id)).data;if(failed.status==='submit_error')break;await new Promise(resolve=>setTimeout(resolve,100))}
  assert.equal(failed.status,'submit_error')
  assert.match(failed.message,/HTTP 422/)
  assert.match(failed.message,/校验详情：字段 body.params.layer_decomposition Extra inputs are not permitted/)
  assert.doesNotMatch(failed.message,/private-storage-key/)
  assert.equal(failed.taskId,undefined)
  assert.equal(submissions,2)
  await call('/api/skills/images/tasks/'+rejected.data.id)
  assert.equal(submissions,2)
 }finally{
  vite.kill();await new Promise(resolve=>vite.exitCode!==null?resolve():vite.once('exit',resolve))
  await new Promise(resolve=>mock.close(resolve))
  await rm(directory,{recursive:true,force:true})
 }
})
