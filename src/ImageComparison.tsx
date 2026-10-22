import { useEffect, useRef, useState } from 'react'
import { ChevronsLeftRight, Minus, Plus, RotateCcw } from 'lucide-react'
import './ImageComparison.css'

export function ImageComparison({ original, input, result, beforeLabel, afterLabel }: { original?: string; input?: string; result: string; beforeLabel?:string; afterLabel?:string }) {
  const [position, setPosition] = useState(50), [compareInput, setCompareInput] = useState(!!input)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const before = compareInput && input ? input : original
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
  const zoom = (factor: number, point?: { x: number; y: number }) => {
    const rect = stage.current?.getBoundingClientRect()
    if (!rect) return
    setView(old => {
      const scale = Math.max(1, Math.min(8, old.scale * factor))
      const ratio = scale / old.scale
      const px = point ? point.x - rect.left - rect.width / 2 : 0
      const py = point ? point.y - rect.top - rect.height / 2 : 0
      return { scale, x: clamp(px - (px - old.x) * ratio, rect.width * (scale - 1) / 2), y: clamp(py - (py - old.y) * ratio, rect.height * (scale - 1) / 2) }
    })
  }
  // Native listener prevents wheel zoom from scrolling the page behind the modal.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation()
      zoomRef.current(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.03 : 0.002)), { x: event.clientX, y: event.clientY })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  const slide = (clientX: number) => {
    const rect = stage.current?.getBoundingClientRect()
    if (rect) setPosition(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)))
  }
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
  return <div className={`comparison-view${original ? '' : ' single-image-view'}`}>
    <div ref={stage} className={`comparison-stage${view.scale > 1 ? ' is-zoomed' : ''}`}
      onPointerDown={event => {
        if (event.button !== 0 || view.scale <= 1) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={event => {
        const previous = drag.current, rect = stage.current?.getBoundingClientRect()
        if (!previous || !rect) return
        const dx = event.clientX - previous.x, dy = event.clientY - previous.y
        drag.current = { x: event.clientX, y: event.clientY }
        setView(old => ({ ...old, x: clamp(old.x + dx, rect.width * (old.scale - 1) / 2), y: clamp(old.y + dy, rect.height * (old.scale - 1) / 2) }))
      }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
      <img className="comparison-result" src={result} alt={afterLabel || '调整结果'} draggable={false} style={{ transform }} />
      {before && <>
        <div className="comparison-original" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={before} alt={compareInput ? '本次输入图片' : '原始底图'} draggable={false} style={{ transform }} /></div>
        <span className="comparison-tag before">{beforeLabel || (compareInput ? '本次输入' : '原始底图')}</span><span className="comparison-tag after">{afterLabel || '调整结果'}</span>
        <div className="comparison-divider" style={{ left: `${position}%` }}><span className="comparison-handle"><ChevronsLeftRight size={19} /></span></div>
        <div className="comparison-drag-handle" style={{ left: `${position}%` }} role="slider" tabIndex={0} aria-label="原图与结果对比滑块" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)}
          onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); slide(event.clientX) }}
          onPointerMove={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) slide(event.clientX) }}
          onPointerUp={event => { event.stopPropagation(); event.currentTarget.releasePointerCapture(event.pointerId) }}
          onKeyDown={event => { const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0; if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setPosition(value => event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.max(0, Math.min(100, value + delta))) } }} />
      </>}
    </div>
    <div className="comparison-caption"><span>滚轮缩放 · 放大后拖动查看</span><div className="comparison-zoom-controls"><button aria-label="缩小图片" disabled={view.scale <= 1} onClick={() => zoom(1 / 1.25)}><Minus size={14}/></button><span>{Math.round(view.scale * 100)}%</span><button aria-label="放大图片" disabled={view.scale >= 8} onClick={() => zoom(1.25)}><Plus size={14}/></button><button aria-label="重置图片缩放" title="适应窗口" onClick={() => setView({ scale: 1, x: 0, y: 0 })}><RotateCcw size={14}/></button></div>{input && input !== original && <button onClick={() => setCompareInput(value => !value)}>{compareInput ? '对比原始底图' : '对比本次输入'}</button>}</div>
  </div>
}
