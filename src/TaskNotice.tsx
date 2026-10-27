import { ChevronDown, CircleAlert, CirclePause } from 'lucide-react'
import type { ReactNode } from 'react'

export function TaskNotice({message, status, action, variant = 'notice'}: {message?:string; status?:string; action?:ReactNode; variant?:'notice'|'generation'}) {
  if (variant === 'generation') return <div className="canvas-task-notice canvas-generation-failure nodrag nopan" onPointerDown={event=>event.stopPropagation()}>
    <CircleAlert size={15} aria-hidden="true"/>
    <strong>生成失败</strong>
    <p>请重试或检查提示词</p>
  </div>
  const text = message || '任务暂时无法继续，请检查任务状态。'
  const manuallyStopped = text.startsWith('已停止本地等待')
  const legacy = text.includes('结果未通过合成校验')
  const occlusion = text.includes('交错遮挡')
  const visionFormat = /Unexpected token|Bad control character|视觉分析未返回有效 JSON|视觉接口未返回 JSON|仅识别失败|返回的分析内容不是有效 JSON/.test(text)
  const generationFailure = ['failed', 'error', 'submit_error'].includes(status || '') && !/下载|download/i.test(text)
  const detailText = visionFormat ? '视觉模型未按要求返回结构化结果；请重新发起多图层。本次未提交生图。' : text
  const title = generationFailure ? '生成失败' : manuallyStopped ? '已停止等待' : visionFormat ? '视觉分析未完成' : status==='submit_error' ? '无法提交' : /取消|cancell?ed/.test(status || '') ? '已取消' : occlusion ? '分层已暂停' : legacy || /合成|原图位置/.test(text) ? '结果待检查' : /下载/.test(text) ? '下载未完成' : '任务已暂停'
  const summary = generationFailure ? '请重试或检查提示词' : manuallyStopped ? '只停止了浏览器查询；点击“查询原任务”查看最新结果。' : visionFormat ? '视觉模型未按要求返回结构化结果，本次未提交生图' : occlusion ? '对象存在交错遮挡，原图已保留' : legacy ? '下载或合成检查未完成，原图已保留' : text.split(/[；\n]/)[0]
  return <div className={`canvas-task-notice nodrag nopan${generationFailure?' canvas-task-failure':''}`} onPointerDown={event=>event.stopPropagation()}>
    <div className="canvas-notice-heading">{manuallyStopped?<CirclePause size={15}/>:<CircleAlert size={15}/>}<strong>{title}</strong></div>
    <p>{summary}</p>
    <div className="canvas-notice-footer">
      <details><summary>查看详情<ChevronDown size={13} aria-hidden="true" /></summary><div>{detailText}{occlusion&&<p>这是旧任务的分析校验结果。请重新发起多图层；查询状态不会重新分析。</p>}</div></details>
      {action&&<div className="canvas-notice-action">{action}</div>}
    </div>
  </div>
}
