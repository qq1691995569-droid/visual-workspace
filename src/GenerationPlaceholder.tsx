import { TaskNotice } from './TaskNotice'
import type { ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { TaskTiming, type TaskTimingState } from './TaskTiming'
import { estimateTaskProgress } from './layerProgress'
import { useEffect, useState } from 'react'

export function GenerationPlaceholder({ task, index = 0, children, preview, frame, operation, action }: { task?: TaskTimingState & { message?: string; phase?:{step:number;total:number} }; index?: number; children?: ReactNode; preview?:string; frame?:{x:number;y:number;width:number;height:number}; operation?:string; action?:ReactNode }) {
  const stopped = !!task && ['paused', 'submission_unknown', 'submit_error', 'connection_lost', 'needs_attention', 'failed', 'error', 'cancelled', 'canceled'].includes(task.status || '')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!task || stopped || task.status === 'complete') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [task, stopped])
  const label = task?.status === 'restoring' ? '正在查询任务状态' : stopped ? (['connection_lost','needs_attention','submission_unknown'].includes(task?.status||'')?'任务需要处理':'任务已暂停') : task?.status === 'complete' ? '正在载入结果' : operation ? `正在${operation}` : '正在生成'
  const primaryLabel = task?.status === 'complete' ? label : operation === '拆分图层' ? label : stopped ? label : '正在生成'
  const progress = task && !stopped ? estimateTaskProgress(task.status, task.createdAt, now) : 0
  if(preview) {
    const blur = operation === '分离主体'
    return <div className={`result-placeholder image-processing ${blur?'processing-cutout':'processing-array'} ${stopped?'generation-idle':'generation-loading'}`} role="status" aria-busy={!stopped}>
      <div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div>
      <div className="task-preview-shade"/>
      {!blur&&!stopped&&task?.status!=='complete'&&<div className="processing-dot-array" aria-hidden="true"/>}
      {children}
      {stopped&&<ImagePlus className="failure-placeholder-icon" size={25} aria-hidden="true"/>}
      <div className="processing-status" title={task?.message}>
        <strong className="generation-progress" hidden={stopped}>{progress}%</strong>
        <strong className="generation-primary" hidden={stopped}>{primaryLabel}</strong>
        {stopped?<TaskNotice message={task?.message} status={task?.status} action={action}/>:action}
      </div>
    </div>
  }
  if(stopped) return <div className="result-placeholder generation-idle" role="status" aria-busy={false}>{children}<ImagePlus className="failure-placeholder-icon" size={25} aria-hidden="true"/><TaskNotice message={task?.message} status={task?.status} action={action}/></div>
  return <div className={`result-placeholder ${!stopped ? 'generation-loading' : 'generation-idle'}${preview?' has-input-preview':''}`} role="status" aria-busy={!stopped} style={{ animationDelay: `${index * -0.35}s` }}>
    {preview && <><div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div><div className="task-preview-shade"/><div className="task-preview-dots"/></>}{children}{!preview&&<ImagePlus size={25} />}{preview&&<strong className="generation-progress">{progress}%</strong>}<strong className="generation-primary">{primaryLabel}</strong>{!preview&&<i className="task-activity-track" aria-hidden="true"/>}{task?.status === 'complete'&&<span className="generation-message">正在恢复已保存的图片，无需重新生成</span>}{task && <TaskTiming job={task} />}{action}
  </div>
}
