import { TaskNotice } from './TaskNotice'
import { useEffect, useState, type ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { TaskTiming, type TaskTimingState } from './TaskTiming'
import { estimateTaskProgress } from './layerProgress'

export function GenerationPlaceholder({ task, index = 0, children, preview, frame, operation, action }: { task?: TaskTimingState & { message?: string; phase?:{step:number;total:number} }; index?: number; children?: ReactNode; preview?:string; frame?:{x:number;y:number;width:number;height:number}; operation?:string; action?:ReactNode }) {
  const stopped = !!task && ['paused', 'submission_unknown', 'submit_error', 'connection_lost', 'needs_attention', 'failed', 'error', 'cancelled', 'canceled'].includes(task.status || '')
  const [now,setNow] = useState(()=>Date.now())
  useEffect(()=>{
    if(!task||stopped||task.status==='complete')return
    setNow(Date.now())
    const timer=setInterval(()=>setNow(Date.now()),1000)
    return()=>clearInterval(timer)
  },[task?.status,task?.createdAt,stopped])
  const percent=estimateTaskProgress(task?.status,task?.createdAt,now)
  const label = task?.status === 'restoring' ? '正在查询任务状态' : stopped ? (['connection_lost','needs_attention','submission_unknown'].includes(task?.status||'')?'任务需要处理':'任务已暂停') : task?.status === 'complete' ? '正在载入结果' : operation ? `正在${operation}` : '正在生成'
  const progress=task&&!stopped&&<div className="canvas-task-progress" role="progressbar" aria-label={operation==='拆分图层'?'多图层预计进度':`${operation || '图片生成'}预计进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <strong>{percent}%</strong>
    <span className="canvas-task-progress-label">{task.status==='complete'?'正在载入结果…':`${label}…`}</span>
  </div>
  if(preview) {
    const blur = operation === '分离主体'
    return <div className={`result-placeholder image-processing ${blur?'processing-cutout':'processing-array'} ${stopped?'generation-idle':'generation-loading'}`} role="status" aria-busy={!stopped}>
      <div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div>
      <div className="task-preview-shade"/>
      {!stopped&&<div className="processing-dot-array" aria-hidden="true"/>}
      {children}
      <div className="processing-status" title={task?.message}>
        {stopped?<><TaskNotice message={task?.message} status={task?.status} action={action}/>{task&&<TaskTiming job={task}/>}</>:progress}
      </div>
    </div>
  }
  if(stopped) return <div className="result-placeholder generation-idle" role="status" aria-busy={false}>{children}<TaskNotice message={task?.message} status={task?.status} action={action}/>{task&&<TaskTiming job={task}/>}</div>
  return <div className={`result-placeholder ${!stopped ? 'generation-loading' : 'generation-idle'}${preview?' has-input-preview':''}`} role="status" aria-busy={!stopped} style={{ animationDelay: `${index * -0.35}s` }}>
    {preview && <><div className="task-preview-media"><img alt="处理中的原图预览" src={preview} style={frame?{left:`${-frame.x/frame.width*100}%`,top:`${-frame.y/frame.height*100}%`,width:`${100/frame.width}%`,height:`${100/frame.height}%`}:undefined}/></div><div className="task-preview-shade"/></>}{children}{!preview&&<ImagePlus size={25} />}{progress||<strong>{label}{!preview&&` · ${index + 1}`}</strong>}<span title={task?.message}>{preview&&!stopped&&task?.status!=='complete'?(operation==='分离主体'?'本地处理 · 保留原图':task?.status==='uploading'?'正在准备图片':'完成后自动显示结果'):task?.status === 'complete' ? '正在恢复已保存的图片，无需重新生成' : task?.message || '等待后台返回图片'}</span>{task?.phase&&<div className="generation-phases">{['识别对象','组合参考','提交生图','生成保存'].map((label,i)=><small key={label} className={i+1<task.phase!.step?'done':i+1===task.phase!.step?'current':''}><i/>{label}</small>)}</div>}{task && <TaskTiming job={task} />}{action}
  </div>
}
