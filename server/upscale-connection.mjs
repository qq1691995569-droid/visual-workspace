import https from 'node:https'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
export async function sharedUpscale(directory,method,url,body){
 let c;try{c=JSON.parse(await readFile(path.join(directory,'upscale-connection.json'),'utf8'))}catch(e){if(e.code==='ENOENT')return;throw Error('共享放大连接配置无效')}
 const catalog=method==='GET'&&url==='/api/skills/upscale/workflows'
 const submit=method==='POST'&&url==='/api/skills/upscale/tasks'
 const recover=method==='POST'&&url==='/api/skills/upscale/recover'
 const poll=method==='GET'&&/^\/api\/skills\/images\/tasks\/[a-f0-9-]{36}$/.test(url)
 if(!catalog&&!submit&&!recover&&!poll)return
 // Existing local jobs keep their original provider.
 if(poll||recover){const id=poll?url.split('/').at(-1):body.requestId;try{await readFile(path.join(directory,id+'.json'));return}catch(e){if(e.code!=='ENOENT')throw e}}
 const origin=new URL(c.origin);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||!c.ca||!c.token)throw Error('共享放大连接配置无效')
 return new Promise((resolve,reject)=>{
  const req=https.request(new URL(url,origin),{method,ca:c.ca,headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},timeout:90000},res=>{
   let size=0,chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>100*1024*1024){res.destroy();reject(Error('共享结果过大'));return}chunks.push(chunk)})
   res.on('error',()=>reject(Error('共享结果接收中断，请查询原任务')))
   res.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(res.statusCode>=400)reject(Object.assign(Error(data.error||'共享服务拒绝请求'),{status:res.statusCode}));else resolve(data)}catch{reject(Error('共享服务返回无效结果'))}})
  });req.on('timeout',()=>req.destroy());req.on('error',()=>reject(Error('无法连接共享放大服务，请确认管理员电脑在线；提交过的任务请查询原任务')));req.end(body?JSON.stringify(body):undefined)
 }).catch(error=>{
  if(submit&&(!error.status||error.status>=500))return {id:body.requestId,status:'submission_unknown',message:'共享服务提交结果未确认，请查询原任务，不要重新提交',createdAt:new Date().toISOString(),images:[]}
  throw error
 })
}
