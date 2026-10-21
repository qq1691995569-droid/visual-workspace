import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import './ToneWorkbench.css'

type Picture = { id: string; src: string; label: string }
export function ToneWorkbench({ target, initialReference, initialParameters, onClose, onApply }: {
  target: Picture; references: Picture[]; onClose: () => void
  initialReference?: string; initialParameters?: Record<string,unknown>
  onApply: (src: string, width: number, height: number, parameters?:Record<string,unknown>) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const [session] = useState(() => crypto.randomUUID())
  const [ready, setReady] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [error, setError] = useState('')
  const applying = useRef(false)
  const callbacks = useRef({ onApply })
  callbacks.current = { onApply }
  useEffect(() => { dialog.current?.focus() }, [])
  useEffect(() => {
    let active = true
    const receive = async (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.session !== session) return
      if (event.data.type === 'tone:ready') setReady(true)
      if (event.data.type === 'tone:preview-ready') setPreviewReady(true)
      if (event.data.type === 'tone:error') setError(String(event.data.message || '图片加载失败，请重新打开预览'))
      if (event.data.type !== 'tone:result' || !(event.data.blob instanceof Blob) || event.data.blob.type !== 'image/png' || applying.current) return
      applying.current = true
      try {
        const blob = event.data.blob as Blob
        const bitmap = await createImageBitmap(blob)
        const { width, height } = bitmap
        bitmap.close()
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(Error('无法读取调色结果'))
          reader.readAsDataURL(blob)
        })
        if (active) callbacks.current.onApply(src, width, height, event.data.parameters)
      } catch { if (active) setError('保存调色结果失败，请重试。') }
      finally { applying.current = false }
    }
    window.addEventListener('message', receive)
    return () => { active = false; window.removeEventListener('message', receive) }
  }, [session])
  useEffect(() => {
    const sync = () => {
      const doc = frame.current?.contentDocument
      if (doc) doc.documentElement.style.colorScheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [ready, previewReady])
  async function sendImage(picture: Picture, key: 'target' | 'reference', signal?: AbortSignal) {
    try {
      const response = await fetch(picture.src, { signal })
      if (!response.ok) throw Error('读取图片失败')
      const blob = await response.blob()
      if (!signal?.aborted) frame.current?.contentWindow?.postMessage({type: 'tone:image', session, blob, name: picture.label, key, expectedReference:!!initialReference, parameters: key==='target'?initialParameters:undefined}, location.origin)
    } catch (e) { if (!signal?.aborted) setError(`图片加载失败：${e instanceof Error ? e.message : String(e)}`) }
  }
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    void sendImage(target, 'target', controller.signal)
    if(initialReference) void sendImage({id:'reference',src:initialReference,label:'参考图'},'reference',controller.signal)
    return () => controller.abort()
    // Target and session are fixed for this modal instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  return <div ref={dialog} tabIndex={-1} className="tone-overlay" role="dialog" aria-modal="true" aria-label="图片调色" onKeyDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
    <div className="tone-window">
      <header className="tone-header"><strong>图片调色</strong><span>本地处理 · 原尺寸保存</span>
        <button onClick={onClose} aria-label="关闭调色"><X size={20}/></button></header>
      {error && <p role="alert">{error}</p>}
      {!previewReady && <div className="tone-preview-loading" role="status">{error ? '预览未能加载，请关闭后重试。' : '正在准备对比画面…'}</div>}
      <iframe ref={frame} style={{visibility:previewReady?'visible':'hidden'}} aria-hidden={!previewReady} tabIndex={previewReady?0:-1} onLoad={()=>setReady(true)} title="Scene Tone 调色工作台" src={`/scene-tone/index.html?session=${session}&preview=1`} />
    </div>
  </div>
}
