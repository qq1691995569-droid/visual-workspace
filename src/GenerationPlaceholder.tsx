import { TaskNotice } from './TaskNotice'
import type { ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { TaskTiming, type TaskTimingState } from './TaskTiming'

export function GenerationPlaceholder({ task, index = 0, children, preview, frame, operation, action }: { task?: TaskTimingState & { message?: string; phase?:{step:number;total:number} }; index?: number; children?: ReactNode; preview?:string; frame?:{x:number;y:number;width:number;height:number}; operation?:string; action?:ReactNode }) {
  const stopped = !!task && ['paused', 'submission_unknown', 'submit_error', 'connection_lost', 'needs_attention', 'failed', 'error', 'cancelled', 'canceled'].includes(task.status || '')
  const label = task?.status === 'restoring' ? '正在查询任务状态' : stopped ? (['connection_lost','needs_attention','submission_unknown'].includes(task?.status||'')?'任务需要处理':'任务已暂停') : task?.status === 'complete' ? '正在载入结果' : operation ? `正在${operation}` : '正在生成'
  if(preview) {
    const blur = operation === '分离主体'
    return <div className={`result-placeholder image-processing ${blur?'processing-cutout':'processing-array'} ${stopped?'generation-idle':'generation-loading'}`} role="status" aria-busy={!stopped}>
      <div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div>
      <div className="task-preview-shade"/>
      {!blur&&!stopped&&task?.status!=='complete'&&<div className="processing-dot-array" aria-hidden="true"/>}
      {children}
      <div className="processing-status" title={task?.message}>
        {!stopped&&task?.status!=='complete'&&<i className="task-activity-track" aria-hidden="true"/>}
        <strong hidden={stopped}>{label}</strong>
        {!stopped&&action}{stopped?<TaskNotice message={task?.message} status={task?.status} action={action}/>:task&&<TaskTiming job={task}/>}
      </div>
    </div>
  }
  if(stopped) return <div className="result-placeholder generation-idle" role="status" aria-busy={false}>{children}<TaskNotice message={task?.message} status={task?.status} action={action}/>{task&&<TaskTiming job={task}/>}</div>
  return <div className={`result-placeholder ${!stopped ? 'generation-loading' : 'generation-idle'}${preview?' has-input-preview':''}`} role="status" aria-busy={!stopped} style={{ animationDelay: `${index * -0.35}s` }}>
    {preview && <><div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div><div className="task-preview-shade"/><div className="task-preview-dots"/></>}{children}{!preview&&<ImagePlus size={25} />}<strong>{label}{!preview&&` · ${index + 1}`}</strong>{!stopped&&<i className="task-activity-track" aria-hidden="true"/>}<span title={task?.message}>{preview&&!stopped&&task?.status!=='complete'?(operation==='分离主体'?'本地处理 · 保留原图':task?.status==='uploading'?'正在准备图片':'完成后自动显示结果'):task?.status === 'complete' ? '正在恢复已保存的图片，无需重新生成' : task?.message || '等待后台返回图片'}</span>{task?.phase&&<div className="generation-phases">{['识别对象','组合参考','提交生图','生成保存'].map((label,i)=><small key={label} className={i+1<task.phase!.step?'done':i+1===task.phase!.step?'current':''}><i/>{label}</small>)}</div>}{task && <TaskTiming job={task} />}{action}
  </div>
}
