import {readLiblibConfig} from './liblib-config.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {liblibClient,workflowRequest} from './liblib-client.mjs'
export function liblibUpscale({directory,load,save,publicJob,inspect,fetcher=fetch,onReady=()=>{}}){
 const active=new Set()
 const configuration=()=>readLiblibConfig(directory)
 function client(c){if(!c.accessKey||!c.secretKey)throw Error('Liblib 服务端凭据未配置');return liblibClient(c,fetcher)}
 async function sync(job){
  if(active.has(job.id)||job.status==='complete')return job
  if(!job.generateUuid){
   if(['uploading','submitting'].includes(job.status)){job.status=job.submissionAttemptedAt?'submission_unknown':'paused';job.message=job.submissionAttemptedAt?'Liblib 提交结果未确认，请核对 Liblib 原任务；不会自动重提':'本地上传被中断，尚未提交 Liblib 放大';await save(job)}
   return job
  }
  active.add(job.id)
  try{
   const c=await configuration();if(!c)throw Error('Liblib 配置缺失')
   const data=await client(c).call('/api/generate/comfy/status',{generateUuid:job.generateUuid});job.remoteStatus=String(data.generateStatus)
   if([6,7].includes(data.generateStatus)){job.status='paused';job.message='Liblib 工作流失败，状态码 '+data.generateStatus}
   else if(data.generateStatus===5){
    job.status='download_pending';job.message='Liblib 已完成，正在保存结果';await save(job)
    if(!data.images?.length)throw Error('Liblib 未返回结果图片')
    for(const [index,item] of data.images.entries()){
     if(job.images.some(i=>i.index===index))continue
     if(item.auditStatus!==undefined&&item.auditStatus!==3)throw Error('结果图片尚未通过审核')
     const url=new URL(item.imageUrl||item.url);if(url.protocol!=='https:'||url.username||url.password||!['.aliyuncs.com','.liblibai.cloud','.liblib.art','.liblib.cloud'].some(s=>url.hostname.endsWith(s)))throw Error('结果域名尚未列入可信范围')
     const res=await fetcher(url,{signal:AbortSignal.timeout(60000),redirect:'error'});if(!res.ok)throw Error('Liblib 结果下载失败')
     const mime=res.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/webp'].includes(mime))throw Error('结果图片格式无效')
     const chunks=[];let size=0;for await(const chunk of res.body){size+=chunk.length;if(size>30*1024*1024)throw Error('结果超过 30 MB');chunks.push(chunk)}
     const src=`data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;await inspect(src)
     job.images.push({index,src,review:{source:'Liblib 独立放大'}});await save(job)
    }
    job.status='complete';job.message=`已保存 ${job.images.length} 张 Liblib 放大结果`;job.finishedAt=new Date().toISOString()
   }else{job.status='running';job.message='Liblib 正在处理，状态码 '+data.generateStatus}
  }catch{const downloading=job.status==='download_pending';job.status='needs_attention';job.message=downloading?'Liblib 结果保存失败，请重新查询原任务':'Liblib 查询或结果处理失败，请查询原任务，不要重复提交'}
  finally{active.delete(job.id);await save(job)}return job
 }
 async function handle(method,url,body){
  if(!url.startsWith('/api/skills/upscale/'))return
  if(method==='POST'&&url.endsWith('/recover')){const job=await load(body.requestId);if(job.provider==='liblib')return publicJob(await sync(job));return}
  const c=await configuration();if(!c)return
  if(method==='GET'&&url.endsWith('/workflows'))return {items:(c.workflows||[]).filter(w=>w.enabled).map(w=>({id:w.id,name:w.name.replace(/\s*·\s*Liblib\s*$/i,''),description:'',version:w.version,editable_params:w.editable_params||[],is_default:w.is_default}))}
  if(method!=='POST'||!url.endsWith('/tasks'))return
  if(!/^[a-f0-9-]{36}$/.test(body.requestId))throw Error('任务编号无效')
  const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex')
  try{const prior=await load(body.requestId);if(prior.fingerprint!==fingerprint)throw Error('任务编号冲突');return publicJob(prior)}catch(e){if(e.code!=='ENOENT')throw e}
  const w=c.workflows?.find(w=>w.enabled&&w.id===body.workflowId&&w.version===body.workflowVersion);if(!w)throw Error('Liblib 工作流未配置或版本已变更')
  workflowRequest(w,'validation',body.paramValues);const api=client(c);await inspect(body.base)
  const job={id:body.requestId,provider:'liblib',upscale:true,type:'generation',feature:'图像放大',fingerprint,workflow:structuredClone(w),paramValues:body.paramValues,status:'uploading',images:[],createdAt:new Date().toISOString(),message:'上传 Liblib 原图'}
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,job.id+'.json'),JSON.stringify(job),{flag:'wx'})
  active.add(job.id)
  void(async()=>{try{
   const image=await api.upload(body.base);job.status='submitting';job.submissionAttemptedAt=new Date().toISOString();await save(job)
   const result=await api.call('/api/generate/comfyui/app',workflowRequest(w,image,body.paramValues))
   if(!result.generateUuid)throw Error('未返回任务编号')
   job.generateUuid=result.generateUuid;job.status='running';job.message='Liblib 已接收任务';await save(job)
  }catch{job.status=job.submissionAttemptedAt?'submission_unknown':'paused';job.message=job.submissionAttemptedAt?'Liblib 提交结果未确认，请核对后再操作':'Liblib 原图上传失败，尚未提交放大';await save(job)}finally{active.delete(job.id);if(job.generateUuid)onReady(job.id)}})().catch(()=>{/* Retain the durable submission marker; never resubmit. */})
  return publicJob(job)
 }
 return {handle,sync}
}
