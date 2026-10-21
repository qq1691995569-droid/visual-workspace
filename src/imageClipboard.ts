// Standard PNG is understood by Figma and other image-aware applications.
// The custom representation retains the canvas data without exposing JSON as text.
export const GRAPH_CLIPBOARD_TYPE = 'web application/x-visual-canvas'
import type {ClipboardImage} from './figmaClipboard'

export function writeMultipleImagesClipboard(images:ClipboardImage[],graph:string):Promise<void>{
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')return Promise.reject(Error('浏览器不支持图片复制'))
  const worker=new Worker(new URL('./figmaClipboard.worker.ts',import.meta.url),{type:'module'})
  const html=new Promise<Blob>((resolve,reject)=>{
    const timeout=setTimeout(()=>{worker.terminate();reject(Error('多图转换超时，请分批复制'))},60000)
    worker.onmessage=e=>{clearTimeout(timeout);e.data.error?reject(Error(e.data.error)):resolve(new Blob([e.data.html],{type:'text/html'}))}
    worker.onerror=()=>{clearTimeout(timeout);reject(Error('多图转换失败'))}
    worker.postMessage(images)
  })
  // HTML carries independent Figma image layers; text retains the existing internal paste format.
  return navigator.clipboard.write([new ClipboardItem({'text/html':html,'text/plain':new Blob([graph],{type:'text/plain'})})]).finally(()=>worker.terminate())
}

async function originalPng(src: string): Promise<Blob> {
  const response = await fetch(src)
  if (!response.ok) throw Error('无法读取原图')
  const blob = await response.blob()
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw Error('无法转换图片')
    context.drawImage(bitmap, 0, 0)
    return await canvas.convertToBlob({ type: 'image/png' })
  } finally { bitmap.close() }
}

export function writeImageClipboard(src: string, graph: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return Promise.reject(Error('当前浏览器不支持图片复制'))
  }
  const data: Record<string, Blob | Promise<Blob>> = { 'image/png': originalPng(src) }
  if (ClipboardItem.supports?.(GRAPH_CLIPBOARD_TYPE)) {
    data[GRAPH_CLIPBOARD_TYPE] = new Blob([graph], { type: 'application/x-visual-canvas' })
  }
  // Invoke during the user gesture; image conversion resolves inside the item.
  return navigator.clipboard.write([new ClipboardItem(data)])
}

export async function readClipboardGraph(): Promise<string | undefined> {
  try {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes(GRAPH_CLIPBOARD_TYPE)) return await (await item.getType(GRAPH_CLIPBOARD_TYPE)).text()
    }
  } catch { /* Normal image paste remains available without custom-format access. */ }
}
