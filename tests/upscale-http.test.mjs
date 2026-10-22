import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {once} from 'node:events'

test('local HTTP bridge completes a simulated upscale and downloads without forwarding Token',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'canvas-upscale-test-'))
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
 const base='data:image/png;base64,'+png.toString('base64')
 let submitted=0,downloaded=0,remoteOrigin
 const upstream=createServer(async(req,res)=>{
  const bytes=[];for await(const chunk of req)bytes.push(chunk)
  const body=bytes.length?JSON.parse(Buffer.concat(bytes).toString()):{}
  if(req.url==='/result.png'){assert.equal(req.headers.authorization,undefined);downloaded++;res.setHeader('content-type','image/png');res.end(png);return}
  assert.equal(req.headers.authorization,'Bearer synthetic-test-token')
  res.setHeader('content-type','application/json')
  if(req.url==='/api/agent/upscale/workflows')res.end(JSON.stringify({items:[{id:'flow',version:1,editable_params:[],cross_field_rules:[]}],credits:2}))
  else if(req.url==='/api/agent/upload'){assert.equal(body.image,base);res.end(JSON.stringify({storage_key:'owner/source.png'}))}
  else if(req.url==='/api/agent/tasks'&&req.method==='POST'){submitted++;assert.equal(body.tool_type,'upscaler');res.end(JSON.stringify({task_id:'remote-test-task'}))}
  else if(req.url==='/api/agent/tasks/remote-test-task')res.end(JSON.stringify({status:'success',images:[{url:remoteOrigin+'/result.png'}]}))
  else{res.statusCode=404;res.end('{}')}
 })
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');remoteOrigin='http://127.0.0.1:'+upstream.address().port
 let local
 try{
  const config=path.join(temp,'credentials.json');await writeFile(config,JSON.stringify({origin:remoteOrigin,token:'synthetic-test-token'}))
  process.env.CANVAS_DATA_DIR=path.join(temp,'jobs');process.env.CANVAS_DREO_CONFIG=config
  const {skillApi}=await import('../server/skill-api.mjs')
  let middleware
  local=createServer((req,res)=>void middleware(req,res,()=>{res.statusCode=404;res.end()}))
  await skillApi().configureServer({httpServer:local,middlewares:{use:fn=>{middleware=fn}}})
  local.listen(0,'127.0.0.1');await once(local,'listening');const origin='http://127.0.0.1:'+local.address().port
  const input={requestId:'11111111-1111-4111-8111-111111111111',base,workflowId:'flow',workflowVersion:1,paramValues:{}}
  const post=()=>fetch(origin+'/api/skills/upscale/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})
  assert.equal((await post()).status,200)
  let result
  for(let i=0;i<40;i++){result=await(await fetch(origin+'/api/skills/images/tasks/'+input.requestId)).json();if(result.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,25))}
  assert.equal(result.status,'complete');assert.equal(result.images[0].src,base)
  assert.equal((await post()).status,200);assert.equal(submitted,1);assert.equal(downloaded,1)
 }finally{if(local){local.closeAllConnections();await new Promise(resolve=>local.close(resolve))}upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));await rm(temp,{recursive:true,force:true})}
})
