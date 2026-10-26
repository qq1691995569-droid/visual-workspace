import {spawn} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export function referenceLimits(caps, request) {
  const catalog=caps.routes?.[request.tool_type]
  const selected=request.params?.route_override
  const route=catalog?.available_routes?.find(r=>r.model===selected?.model&&r.provider===selected?.provider) || (!selected ? catalog : undefined)
  // Prefer explicit input limits. When a provider only advertises output
  // resolutions, use the selected resolution as the conservative input cap.
  const limits=route?.input_limits || route?.limits || {}
  const positive=value=>Number.isFinite(value)&&value>0?Math.floor(value):undefined
  const firstPositive=(...values)=>values.map(positive).find(value=>value!==undefined)
  const resolution=request.params?.resolution
  const resolutionEdge={ '1K':1024, '2K':2048, '4K':4096 }[resolution] || 4096
  const maxEdge=firstPositive(limits.max_edge,limits.max_input_edge,limits.max_reference_edge,route?.max_input_edge,route?.max_reference_edge) || resolutionEdge
  const maxPixels=firstPositive(limits.max_pixels,limits.max_input_pixels,limits.max_reference_pixels,route?.max_input_pixels,route?.max_reference_pixels) || maxEdge*maxEdge
  const maxBytes=Math.min(firstPositive(limits.max_bytes,limits.max_input_bytes,limits.max_reference_bytes,route?.max_input_bytes,route?.max_reference_bytes) || 8_000_000,8_000_000)
  return {max_pixels:maxPixels,max_edge:maxEdge,max_bytes:maxBytes}
}

export function prepareReference(image, limits, options = {}) {
  return new Promise((resolve,reject)=>{
    const python=process.env.CANVAS_PYTHON || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
    const child=spawn(python,[fileURLToPath(new URL('./reference_image.py',import.meta.url))],{windowsHide:true,timeout:60000})
    let out=''
    child.stdout.on('data',bytes=>{out+=bytes});child.stderr.resume()
    child.on('error',()=>reject(Error('参考图缩放运行时不可用，请检查 Python 和 Pillow')))
    child.on('close',code=>{try{if(code!==0)throw Error();resolve(JSON.parse(out))}catch{reject(Error('参考图缩放失败，请检查图片格式和尺寸；尚未提交生图'))}})
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({image,limits,...options}))
  })
}
