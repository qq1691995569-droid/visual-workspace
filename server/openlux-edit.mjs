import {dreoValidationSummary} from './dreo-error.mjs'
import {INTERACTIVE_EDIT_MODEL} from './interactive-edit.mjs'

export function openLuxEditRequest(image,prompt,resolution='2K'){
  if(!/^data:image\/(?:png|jpeg);base64,/.test(image))throw Error('框选编辑只接受 PNG 或 JPEG 原图')
  if(typeof prompt!=='string'||!prompt.includes('<bbox>'))throw Error('框选编辑缺少区域坐标')
  return {model:INTERACTIVE_EDIT_MODEL,image,prompt,size:['1K','2K','4K'].includes(resolution)?resolution:'2K',output_format:'png',response_format:'url',watermark:false}
}

export async function submitOpenLuxEdit(config,image,prompt,resolution='2K',fetcher=fetch){
  const response=await fetcher(config.origin+'/images/generations',{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify(openLuxEditRequest(image,prompt,resolution)),signal:AbortSignal.timeout(180000),redirect:'error'})
  if(!response.ok){
    const detail=dreoValidationSummary((await response.text()).slice(0,16000))
    throw Object.assign(Error(`OpenLux 拒绝框选编辑请求（HTTP ${response.status}）${detail?'；'+detail:''}`),{status:response.status})
  }
  const result=await response.json()
  if(result.model&&result.model!==INTERACTIVE_EDIT_MODEL)throw Error('OpenLux 返回了非指定模型的结果，已停止导入')
  const url=result.data?.[0]?.url
  if(typeof url!=='string'||!url.trim())throw Error('OpenLux 没有返回可下载的图片地址')
  return {url}
}
