import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, Expand, Eraser, PencilLine, X, Undo2 } from 'lucide-react'
import { builtinSkills, type BuiltinOperation, type InlineParameters } from './builtinSkills'

export function InlineImageEdit({ anchor, sourceLabel, sourceImage, operation, revision, onCancel, onConfirm }: {
  anchor: RefObject<HTMLDivElement | null>; sourceLabel?:string; sourceImage?:string; operation: BuiltinOperation; revision: string
  onCancel: () => void; onConfirm: (parameters: InlineParameters) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('自由')
  const [frame, setFrame] = useState({ x: -.2, y: -.2, width: 1.4, height: 1.4 })
  const [strokes, setStrokes] = useState<number[][][]>([])
  const [point, setPoint] = useState({ x: 12, y: 80 })
  const bar = useRef<HTMLDivElement>(null)
  const resize = useRef<{ handle: string; x: number; y: number; frame: typeof frame } | null>(null)
  const drawing = useRef(false)
  useEffect(() => { const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel) }, [onCancel])
  useLayoutEffect(() => {
    const update = () => { const r = anchor.current?.getBoundingClientRect(); if (!r || !bar.current) return; const w = bar.current.offsetWidth; setPoint({ x: Math.max(12, Math.min(r.x + r.width / 2 - w / 2, window.innerWidth - w - 12)), y: operation === 'redraw' ? Math.min(r.bottom + 16,window.innerHeight-bar.current.offsetHeight-12) : Math.max(80, r.y + (operation === 'expand' ? frame.y * r.height : 0) - 72) }) }
    update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update)
  }, [anchor, revision, frame, operation])
  function chooseRatio(value: string) {
    setRatio(value)
    if (value === '自由') return
    const r = anchor.current!.getBoundingClientRect(), [a, b] = value.split(':').map(Number)
    let width = 1.4, height = 1.4
    if (width * r.width / (height * r.height) < a / b) width = height * r.height * a / b / r.width
    else height = width * r.width * b / a / r.height
    setFrame({ x: (1 - width) / 2, y: (1 - height) / 2, width, height })
  }
  const Icon = operation === 'expand' ? Expand : operation === 'erase' ? Eraser : PencilLine
  return <>
    {operation === 'expand' && <div className="inline-expansion nodrag nopan" style={{ left: `${frame.x * 100}%`, top: `${frame.y * 100}%`, width: `${frame.width * 100}%`, height: `${frame.height * 100}%` }}><span className="expansion-tint" />{['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => <button key={handle} aria-label={`调整扩图范围 ${handle}`} className={`expansion-handle handle-${handle}`} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); resize.current = { handle, x: e.clientX, y: e.clientY, frame } }} onPointerMove={e => {
      const start = resize.current, r = anchor.current?.getBoundingClientRect(); if (!start || !r) return
      const dx = (e.clientX - start.x) / r.width, dy = (e.clientY - start.y) / r.height
      if (ratio !== '自由') { const scale = Math.max(1.02 / start.frame.width, 1.02 / start.frame.height, 1 + (handle.includes('w') ? -dx : dx) * 2 / start.frame.width + (handle.includes('n') ? -dy : dy) * 2 / start.frame.height); const width = start.frame.width * scale, height = start.frame.height * scale; setFrame({ x: (1 - width) / 2, y: (1 - height) / 2, width, height }); return }
      const x = handle.includes('w') ? Math.min(0, start.frame.x + dx) : start.frame.x, y = handle.includes('n') ? Math.min(0, start.frame.y + dy) : start.frame.y
      const right = handle.includes('e') ? Math.max(1, start.frame.x + start.frame.width + dx) : start.frame.x + start.frame.width, bottom = handle.includes('s') ? Math.max(1, start.frame.y + start.frame.height + dy) : start.frame.y + start.frame.height
      setFrame({ x, y, width: right - x, height: bottom - y })
    }} onPointerUp={() => { resize.current = null }} onPointerCancel={() => { resize.current = null }} />)}</div>}
    {operation === 'erase' && <svg className="inline-mask nodrag nopan" viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const r = e.currentTarget.getBoundingClientRect(); setStrokes(s => [...s, [[(e.clientX - r.x) / r.width * 1000, (e.clientY - r.y) / r.height * 1000]]]) }} onPointerMove={e => { if (!drawing.current) return; const r = e.currentTarget.getBoundingClientRect(), p = [Math.max(0,Math.min(1000,(e.clientX - r.x) / r.width * 1000)), Math.max(0,Math.min(1000,(e.clientY - r.y) / r.height * 1000))]; setStrokes(s => [...s.slice(0, -1), [...s[s.length - 1], p]]) }} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }}>{strokes.map((s, i) => <polyline key={i} points={(s.length===1?[s[0],[s[0][0]+.01,s[0][1]]]:s).map(p => p.join(',')).join(' ')} stroke="rgba(93,147,241,.55)" strokeWidth="45" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}
    {createPortal(<div ref={bar} className={`inline-edit-bar${operation==='redraw'?' inline-reference-edit':''}`} style={{ left: point.x, top: point.y }} role="toolbar" aria-label={`${builtinSkills[operation].name}操作`}>{operation==='redraw'?<span className="inline-reference-source" title={sourceLabel}>{sourceImage&&<img src={sourceImage} alt="当前引用图片"/>}<b>{sourceLabel}</b><small>直接修改 · 1 张</small></span>:<span><Icon size={17} />{builtinSkills[operation].name}</span>}{operation === 'expand' ? <select aria-label="扩图比例" value={ratio} onChange={e => chooseRatio(e.target.value)}>{['自由', '1:1', '4:3', '3:4', '16:9', '9:16'].map(r => <option key={r}>{r}</option>)}</select> : operation === 'erase' ? <><small>涂抹要移除的区域</small><button aria-label="撤销涂抹" disabled={!strokes.length} onClick={() => setStrokes(s => s.slice(0, -1))}><Undo2 size={15} /></button></> : <input autoFocus aria-label="图片修改要求" placeholder="描述希望怎样修改这张图…" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && prompt.trim()) onConfirm({ prompt }) }} />}{operation==='expand' && <input aria-label="扩图补充说明" placeholder="新增区域要求（可选）" value={prompt} onChange={e=>setPrompt(e.target.value)}/>}<button onClick={onCancel}><X size={14} />取消</button><button className="confirm" disabled={operation === 'erase' ? !strokes.length : operation !== 'expand' && !prompt.trim()} onClick={() => onConfirm(operation === 'expand' ? { ratio, frame, prompt } : operation === 'erase' ? { maskStrokes: strokes } : { prompt })}><Check size={14} />{operation==='redraw'?'生成图片':'确认'}</button></div>, document.body)}
  </>
}
