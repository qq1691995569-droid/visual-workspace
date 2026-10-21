import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export function TaskNotice({message, status, action}: {message?:string; status?:string; action?:ReactNode}) {
  const text = message || '任务暂时无法继续，请检查任务状态。'
  const legacy = text.includes('结果未通过合成校验')
  const occlusion = text.includes('交错遮挡')
  const title = /取消|cancell?ed/.test(status || '') ? '已取消' : occlusion ? '分层已暂停' : legacy || /合成|原图位置/.test(text) ? '结果待检查' : /下载/.test(text) ? '下载未完成' : '任务已暂停'
  const summary = occlusion ? '对象存在交错遮挡，原图已保留' : legacy ? '下载或合成检查未完成，原图已保留' : text.split(/[；\n]/)[0]
  return <div className="canvas-task-notice nodrag nopan" onPointerDown={event=>event.stopPropagation()}>
    <div className="canvas-notice-heading"><CircleAlert size={15}/><strong>{title}</strong></div>
    <p>{summary}</p>
    <div className="canvas-notice-footer">
      <details><summary>查看详情</summary><div>{text}{occlusion&&<p>这是旧任务的分析校验结果。请重新发起多图层；查询状态不会重新分析。</p>}</div></details>
      {action&&<div className="canvas-notice-action">{action}</div>}
    </div>
  </div>
}
