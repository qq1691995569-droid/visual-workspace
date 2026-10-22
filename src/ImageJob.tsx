import { TaskTiming, type TaskTimingState } from './TaskTiming'
import { useEffect, useRef } from 'react'
import type { SkillResult } from './SkillNode'
export type ImageJobState = TaskTimingState & { phase?:{step:number;total:number}; id?: string; requestId?: string; status: string; message: string; queryAttempt?:number; monitoringStopped?:boolean; taskId?:string }
export function ImageJob({ job, onChange, onResults, endpoint = 'images', monitor = true, submitting = false }: { submitting?:boolean; monitor?: boolean; endpoint?: 'images' | 'style'; job: ImageJobState; onChange: (job: ImageJobState) => void; onResults: (id: string, results: SkillResult[]) => void | Promise<void> }) {
  const latest = useRef({ job, onChange, onResults })
  useEffect(() => { latest.current = { job, onChange, onResults } })
  useEffect(() => {
    const id = job.id || job.requestId
    if (submitting || !monitor || !id || job.monitoringStopped || ['connection_lost','needs_attention','submission_unknown'].includes(job.status)) return
    let stopped = false, failures = 0, timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    async function poll() {
      try {
        const response = await fetch(`/api/skills/${endpoint}/tasks/${id}`, {signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}), result = await response.json()
        if (stopped) return
        if (!response.ok) {
          if (result.code==='TASK_NOT_FOUND') {
            latest.current.onChange({...latest.current.job,status:'needs_attention',message:'找不到此任务的本地记录，无法确认是否已提交。请核对生成服务中的任务；不会自动重新生图。'})
            return
          }
          throw Error(result.error || '任务状态查询失败')
        }
        failures = 0
        if (result.images?.length) await latest.current.onResults(result.id, result.images)
        if (stopped) return
        latest.current.onChange({ ...latest.current.job, taskId:result.taskId, phase:result.phase, createdAt: result.createdAt, finishedAt: result.finishedAt, serverNow: result.serverNow, id: result.id, status: result.status, message: [result.message, result.warning].filter(Boolean).join('；') })
        if (['complete','paused','submission_unknown','connection_lost','needs_attention'].includes(result.status)) return
      } catch {
        if (stopped) return
        failures++
        latest.current.onChange({ ...latest.current.job, ...(failures>=3?{status:'connection_lost'}:{}), message: failures>=3?'连续查询失败，已停止自动等待；远端是否完成尚未确认。可重新查询原任务，不会重复生图。':`状态查询失败，正在重连（${failures}/3）；不会重新提交生图` })
        if(failures>=3)return
      }
      if (!stopped) timer = setTimeout(poll, 4000)
    }
    void poll(); return () => { stopped = true; controller.abort(); clearTimeout(timer) }
  }, [job.id, job.requestId, job.status, job.queryAttempt, job.monitoringStopped, endpoint, monitor, submitting])
  return monitor?null:<div className="node-executor-status" role="status">{job.message}<TaskTiming job={job}/><ImageJobControls job={job} onChange={onChange}/></div>
}
export function ImageJobControls({job,onChange}:{job:ImageJobState;onChange:(job:ImageJobState)=>void}){
 const unresolved=['connection_lost','needs_attention','submission_unknown','paused'].includes(job.status)
 if(job.status==='complete')return null
 return <div className="task-recovery-actions nodrag nopan" onPointerDown={e=>e.stopPropagation()}>
 {(unresolved||job.monitoringStopped)&&<button title="只查询原任务，不重复生成" onClick={()=>onChange({...job,status:'restoring',monitoringStopped:false,queryAttempt:(job.queryAttempt||0)+1,message:'正在重新查询原任务…'})}>查询原任务</button>}
 {!job.monitoringStopped&&<button title="只停止本地等待，不取消远端任务" onClick={()=>onChange({...job,status:'paused',monitoringStopped:true,message:'已停止本地等待，远端任务可能继续；可查询原任务找回结果。'})}>停止等待</button>}
 </div>
}
