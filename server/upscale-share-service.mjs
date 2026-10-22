// A deliberately narrow HTTPS gateway. Never expose Vite or management APIs to the LAN.
import https from 'node:https'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {sharingConfig,tokenHash} from './upscale-sharing.mjs'
export function shareHandler({directory,fetcher=fetch}){
const busy=new Set(),hits=new Map()
return async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store')
 try{
  if(req.headers.origin)throw Object.assign(Error('只允许画布服务连接'),{status:403})
  const latest=await sharingConfig(directory)
  const client=latest?.clients.find(c=>c.enabled&&c.tokenHash===tokenHash(req.headers.authorization?.replace(/^Bearer /,'')))
  if(!client)throw Object.assign(Error('共享访问凭据无效或已撤销'),{status:401})
  const count=hits.get(client.id)||{at:Date.now(),count:0};if(Date.now()-count.at>60000){count.at=Date.now();count.count=0}count.count++;hits.set(client.id,count)
  if(count.count>120)throw Object.assign(Error('请求过于频繁，请稍后重试'),{status:429})
  const poll=req.method==='GET'&&/^\/api\/skills\/images\/tasks\/[a-f0-9-]{36}$/.test(req.url)
  const catalog=req.method==='GET'&&req.url==='/api/skills/upscale/workflows'
  const submit=req.method==='POST'&&req.url==='/api/skills/upscale/tasks'
  const recover=req.method==='POST'&&req.url==='/api/skills/upscale/recover'
  if(!catalog&&!poll&&!submit&&!recover)throw Object.assign(Error('接口不存在'),{status:404})
  let body,size=0,chunks=[]
  if(submit||recover){if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要 JSON 请求');for await(const chunk of req){size+=chunk.length;if(size>42*1024*1024)throw Error('图片过大');chunks.push(chunk)}body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  const id=poll?req.url.split('/').at(-1):body?.requestId
  if(!catalog){
   if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('任务编号无效')
   const ownerFile=path.join(directory,'shared-owners',id+'.json')
   if(submit){
    if(busy.has(client.id))throw Object.assign(Error('正在提交，请稍后重试'),{status:429})
    await mkdir(path.dirname(ownerFile),{recursive:true})
    // Reserve globally before proxying; another user cannot take over an existing local task.
    try{await readFile(path.join(directory,id+'.json'));await readFile(ownerFile)}catch(e){if(e.code!=='ENOENT')throw e;try{await readFile(path.join(directory,id+'.json'));throw Error('任务编号不可用')}catch(inner){if(inner.code!=='ENOENT')throw inner}}
    try{await writeFile(ownerFile,JSON.stringify({clientId:client.id}),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
   }
   let owner;try{owner=JSON.parse(await readFile(ownerFile,'utf8'))}catch{throw Object.assign(Error('任务不存在'),{status:404})}
   if(owner.clientId!==client.id)throw Object.assign(Error('任务不存在'),{status:404})
  }
  if(submit)busy.add(client.id)
  try{
   // Sharing requires the host's explicit local Liblib configuration. Never fall back to DREO.
   await readFile(path.join(directory,'liblib.json'))
   let upstream;try{upstream=await fetcher('http://127.0.0.1:5173'+req.url,{method:req.method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(90000)})}catch{throw Object.assign(Error('主机服务连接中断，请查询原任务'),{status:502})}
   res.statusCode=upstream.status;res.end(await upstream.text())
  }finally{if(submit)busy.delete(client.id)}
 }catch(e){res.statusCode=e.status||400;res.end(JSON.stringify({error:e.status?e.message:'共享放大服务暂不可用，请联系管理员；不要重复提交'}))}
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const directory=process.env.CANVAS_DATA_DIR||fileURLToPath(new URL('../.canvas-data/',import.meta.url))
const config=await sharingConfig(directory)
if(!config)throw Error('请先初始化共享服务')
const service=https.createServer({key:await readFile(path.join(directory,'upscale-share-key.pem')),cert:await readFile(path.join(directory,'upscale-share-cert.pem')),minVersion:'TLSv1.2'},shareHandler({directory}))
service.requestTimeout=120000;service.headersTimeout=15000
service.listen(new URL(config.origin).port||5443,config.bindHost,()=>console.log('共享放大服务已启动：'+config.origin))
}
