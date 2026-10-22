import {readdir,readFile,stat} from 'node:fs/promises'
import path from 'node:path'
export function safeTaskMessage(value){return String(value||'').replace(/data:image\/[^\s]+/g,'[图片已隐藏]').replace(/https?:\/\/[^\s]+/g,'[链接已隐藏]').replace(/Bearer\s+\S+/gi,'[凭据已隐藏]').replace(/((?:token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi,'$1[已隐藏]').slice(0,800)}
export function taskSummary(j){
 if(j.provider==='liblib'){const summary=taskSummary({...j,provider:undefined,taskId:j.generateUuid,remoteStatus:j.remoteStatus==='5'?'completed':['6','7'].includes(j.remoteStatus)?'failed':j.remoteStatus});return {...summary,provider:'liblib',stage:summary.stage.replaceAll('DREO','Liblib')}}
 let stage='记录不足，提交状态待核对'
 if(j.taskId){stage=j.resultFailure?'提交后 · '+(j.resultFailure.stage==='download'?'结果下载失败':'结果处理失败'):['failed','cancelled','rejected','error'].includes(j.remoteStatus)?'提交后 · DREO 已停止':j.status==='complete'?'已完成':'已提交 DREO · '+(j.status==='connection_lost'?'查询中断':'等待或处理中')}
 else if(j.status==='submission_unknown'||j.submissionAttemptedAt||j.status==='submitting')stage='提交状态不确定 · 请核对 DREO'
 else if(j.failure?.stage==='before_submit'||j.deferredEdit||['analyzing','locating','composing','uploading','queued'].includes(j.status))stage='提交前 · '+(j.status==='paused'?'处理失败':'准备中')
 if(j.canvasSkill&&['local-vision','rembg'].includes(j.canvasSkill.processor)&&!j.taskId)stage='本地处理 · 无 DREO 任务'
 return {id:j.id,taskId:typeof j.taskId==='string'?j.taskId:undefined,feature:j.deferredEdit?.kind||j.canvasSkill?.name||j.feature||j.type,status:j.status,stage,message:safeTaskMessage(j.failure?.message||j.resultFailure?.message||j.message),createdAt:j.createdAt,updatedAt:j.updatedAt,remoteStatus:j.remoteStatus,phase:j.phase?.step,images:Array.isArray(j.images)?j.images.length:0,submittedAt:j.submissionAttemptedAt}
}
export async function taskMonitor(directory){
 const files=(await readdir(directory).catch(e=>{if(e.code==='ENOENT')return [];throw e})).filter(f=>/^[a-f0-9-]{36}\.json$/.test(f))
 const dated=await Promise.all(files.map(async file=>({file,time:(await stat(path.join(directory,file)).catch(()=>({mtimeMs:0}))).mtimeMs})))
 const tasks=[];let unreadable=0
 for(const {file} of dated.sort((a,b)=>b.time-a.time).slice(0,100)){
  try{const j=JSON.parse(await readFile(path.join(directory,file),'utf8'));if(!j.deletedAt&&j.id)tasks.push(taskSummary(j))}catch{unreadable++}
 }
 return {tasks,unreadable,checkedAt:new Date().toISOString()}
}
