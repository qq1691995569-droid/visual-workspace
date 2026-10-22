import {spawn} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export function referenceLimits(caps, request) {
  const catalog=caps.routes?.[request.tool_type]
  const selected=request.params?.route_override
  const route=catalog?.available_routes?.find(r=>r.model===selected?.model&&r.provider===selected?.provider) || (!selected ? catalog : undefined)
  // Generic limits describe model output on some backends: use them only as a conservative upload policy.
  const limits=route?.input_limits || route?.limits
  const positive=value=>Number.isFinite(value)&&value>0?Math.floor(value):undefined
  return {max_pixels:positive(limits?.max_pixels)||16_000_000,max_edge:positive(limits?.max_edge)||4096,max_bytes:Math.min(positive(limits?.max_bytes)||8_000_000,8_000_000)}
}

export function prepareReference(image, limits) {
  return new Promise((resolve,reject)=>{
    const python=process.env.CANVAS_PYTHON || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
    const child=spawn(python,[fileURLToPath(new URL('./reference_image.py',import.meta.url))],{windowsHide:true,timeout:60000})
    let out=''
    child.stdout.on('data',bytes=>{out+=bytes});child.stderr.resume()
    child.on('error',()=>reject(Error('参考图缩放运行时不可用，请检查 Python 和 Pillow')))
    child.on('close',code=>{try{if(code!==0)throw Error();resolve(JSON.parse(out))}catch{reject(Error('参考图缩放失败，请检查图片格式和尺寸；尚未提交生图'))}})
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({image,limits}))
  })
}
