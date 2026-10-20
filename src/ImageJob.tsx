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
  const unresolved=['connection_lost','needs_attention','submission_unknown'].includes(job.status)
  return <div className="node-executor-status" role="status">{job.message}<TaskTiming job={job}/>{!monitor&&job.status!=='complete'&&<div className="task-recovery-actions nodrag nopan">
    {(unresolved||job.monitoringStopped||job.status==='paused')&&<button title="只查询原任务，不提交新的生图请求" onClick={()=>onChange({...job,status:'restoring',monitoringStopped:false,queryAttempt:(job.queryAttempt||0)+1,message:'正在重新查询原任务…'})}>重新查询原任务</button>}
    {!job.monitoringStopped&&<button title="只结束本地等待，远端任务可能继续；再次生成前请核对远端，避免重复计费" onClick={()=>onChange({...job,status:'paused',monitoringStopped:true,message:'已停止本地等待，未取消远端任务。再次生成前请核对远端；也可重新查询找回结果。'})}>停止本地等待</button>}
    {(job.taskId||unresolved)&&<small>任务编号：{job.taskId||job.id||job.requestId}</small>}
  </div>}</div>
}
