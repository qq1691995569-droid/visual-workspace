import { useEffect, useState } from 'react'
import './TaskTiming.css'

export type TaskTimingState = { createdAt?: string; finishedAt?: string; serverNow?: string; status?: string }

export function TaskTiming({ job }: { job: TaskTimingState }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const server = Date.parse(job.serverNow || '')
    const anchor = performance.now()
    const tick = () => setNow((Number.isFinite(server) ? server : Date.now()) + (Number.isFinite(server) ? performance.now() - anchor : 0))
    tick()
    if (job.finishedAt || ['complete', 'completed', 'paused', 'failed', 'error', 'submit_error', 'cancelled', 'canceled'].includes(job.status || '')) return
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [job.serverNow, job.finishedAt, job.status])
  const start = Date.parse(job.createdAt || '')
  if (!Number.isFinite(start)) return null
  const end = Date.parse(job.finishedAt || '')
  const terminal = ['complete', 'completed', 'paused', 'failed', 'error', 'submit_error', 'cancelled', 'canceled'].includes(job.status || '')
  const seconds = Math.max(0, Math.floor(((Number.isFinite(end) ? end : now) - start) / 1000))
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const time = new Date(start).toLocaleTimeString('zh-CN', { hour12: false })
  return <div className="task-timing" title="从后台接收任务开始，包含排队、处理和结果保存时间"><span>{terminal && !Number.isFinite(end) ? '历史任务未记录结束时间' : `${Number.isFinite(end) ? '总耗时' : '已耗时'} ${duration}`}</span><span>开始于 {time}</span></div>
}
