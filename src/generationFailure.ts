// Shared failure presentation for generated-image outputs (not transport/download pauses).
export function isGenerationFailure(task?: {status?:string; message?:string}) {
  return ['failed','error','submit_error','paused'].includes(task?.status || '') &&
    !/已停止本地等待|下载|download|取消|cancel/i.test(task?.message || '')
}
