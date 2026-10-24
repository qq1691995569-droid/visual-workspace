import {readFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import path from 'node:path'
import {nativeLayerItems} from './interior-separate.mjs'
import {dreoValidationSummary} from './dreo-error.mjs'

const MODEL='doubao-seedream-5-0-pro-260628'

export async function openLuxConfig(){
  const file=process.env.CANVAS_OPENLUX_CONFIG||path.join(homedir(),'.visual-workspace','openlux.json')
  let config
  try{config=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))}
  catch(error){if(error.code==='ENOENT')return null;throw Error('OpenLux 本机配置无法读取')}
  const url=new URL(config.origin||'https://api.openlux.ai/v1')
  if((url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))||url.username||url.password||!/^\/v1\/?$/.test(url.pathname)||typeof config.token!=='string'||!config.token.trim())throw Error('OpenLux 本机配置无效')
  return {origin:url.href.replace(/\/$/,''),token:config.token}
}

export function openLuxNativeRequest(image,prompt){
  if(!/^data:image\/(?:png|jpeg);base64,/.test(image))throw Error('原生拆层只接受 PNG 或 JPEG 原图')
  return {model:MODEL,image,prompt,layer_decomposition:true,size:'auto',output_format:'png',response_format:'url',watermark:false}
}

export async function submitOpenLuxNative(config,image,prompt,fetcher=fetch){
  const response=await fetcher(config.origin+'/images/generations',{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify(openLuxNativeRequest(image,prompt)),signal:AbortSignal.timeout(180000),redirect:'error'})
  if(!response.ok){
    const detail=dreoValidationSummary((await response.text()).slice(0,16000))
    throw Object.assign(Error(`OpenLux 拒绝拆层请求（HTTP ${response.status}）${detail?'；'+detail:''}`),{status:response.status})
  }
  const result=await response.json()
  if(result.model&&result.model!==MODEL)throw Error('OpenLux 返回了非指定模型的结果，已停止导入')
  nativeLayerItems(result)
  return {data:result.data}
}
