import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box, Check, ChevronDown, Copy, Ratio, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { modelOptions, ratios, resolutions, qualities, type Generation } from './generation'

type Section = 'model' | 'resolution' | 'ratio' | 'quality' | 'count'
export function GenerationControls({ value, onChange, placement = 'dock', mode = 'generate' }: { mode?: 'generate' | 'redraw'; placement?: 'dock' | 'node'; value: Generation; onChange: (next: Generation) => void }) {
  const [defaultModel, setDefaultModel] = useState('')
  const [open, setOpen] = useState<Section | null>(null)
  const [routes, setRoutes] = useState<{model: string; display_name?: string; supported_resolutions: string[]; supported_aspects: string[]; supported_qualities: string[]; supported_counts?: number[]; max_images_per_call: number}[]>([])
  useEffect(() => { let active = true; fetch('/api/skills/status').then(r => r.json()).then(data => { if (active) { const catalog = data.imageRoutes?.[mode === 'redraw' ? 'conversation-image' : 'image-gen']; setDefaultModel(catalog?.model || ''); setRoutes(catalog?.available_routes || []) } }).catch(() => {}); return () => { active = false } }, [mode])
  const live = routes.find(route => route.model === value.model || value.model === 'dreo-default' && route.model === defaultModel || value.model === 'nano-banana-pro' && route.model === 'gemini-3-pro-image-preview')
  const root = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState({ left: 0, top: 0 })
  const present = (content: ReactNode) => placement === 'node' ? createPortal(<div ref={popup} className="node-parameter-portal nodrag nopan nowheel" style={{ left: anchor.left, top: anchor.top }} onWheel={e => e.stopPropagation()}>{content}</div>, document.body) : content
  const model = modelOptions.find(m => m.id === value.model) || {name:value.model}

  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as globalThis.Node) && !popup.current?.contains(e.target as globalThis.Node)) setOpen(null) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    const close = () => setOpen(null)
    const wheel = (e: WheelEvent) => { if (!popup.current?.contains(e.target as globalThis.Node) && !root.current?.contains(e.target as globalThis.Node)) close() }
    window.addEventListener('resize', close); window.addEventListener('wheel', wheel, true)
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('wheel', wheel, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const controls = [
    { id: 'model' as const, label: '生图模型', text: live?.display_name || model.name, icon: Box },
    { id: 'resolution' as const, label: '分辨率', text: value.resolution, icon: Sparkles },
    { id: 'ratio' as const, label: '画面比例', text: value.ratio, icon: Ratio },
    { id: 'quality' as const, label: '生成精细度', text: value.quality, icon: SlidersHorizontal },
    { id: 'count' as const, label: '输出数量', text: `${value.count} 张`, icon: Copy },
  ]
  const choose = (key: Section, next: string | number) => {
    const route = key === 'model' ? routes.find(route => route.model === next) : undefined
    onChange({ ...value, [key]: next, ...(route ? { resolution: (route.supported_resolutions.includes(value.resolution) ? value.resolution : route.supported_resolutions[0]) as Generation['resolution'], ratio: (route.supported_aspects.includes(value.ratio) ? value.ratio : '1:1') as Generation['ratio'], quality: (route.supported_qualities?.includes(value.quality) ? value.quality : 'auto') as Generation['quality'], count: route.supported_counts ? route.supported_counts.filter(n=>n>=1 && n<=4)[0] || 1 : Math.min(4, value.count, route.max_images_per_call) } : {}) }); setOpen(null)
  }
  return <div className="generation-controls" ref={root}>{controls.filter(control => control.id !== 'quality' || !!live?.supported_qualities?.length).map(control => <div className="parameter" key={control.id}>
    <button className={open === control.id ? 'parameter-trigger expanded' : 'parameter-trigger'} aria-label={`${control.label}：${control.text}`} aria-expanded={open === control.id} onClick={e => { const box = e.currentTarget.getBoundingClientRect(); const height = control.id === 'ratio' ? 360 : control.id === 'model' ? 330 : 180; setAnchor({ left: Math.max(12, Math.min(box.left, window.innerWidth - (control.id === 'model' ? 365 : 320) - 12)), top: box.top > height + 20 ? box.top - height - 10 : Math.max(12, Math.min(box.bottom + 10, window.innerHeight - height - 12)) }); setOpen(open === control.id ? null : control.id) }}><control.icon size={14} /><span>{control.text}</span><ChevronDown size={11} /></button>
    {open === control.id && present(<div className={`parameter-popover ${control.id}`} role="dialog" aria-label={`${control.label}设置`}><div className="parameter-title">{control.label}<button aria-label="关闭参数菜单" onClick={() => setOpen(null)}><X size={14} /></button></div>
      {control.id === 'model' ? <><p className="parameter-description">模型来自 DREO 后台实时能力</p><div className="model-list">{!routes.length && <p className="parameter-description" role="status">模型列表尚未加载，请检查 DREO 连接后重新打开画布。</p>}{modelOptions.filter(m => routes.some(route => route.model === m.id)).map(m => <button key={m.id} role="radio" aria-checked={(live?.model || value.model) === m.id} onClick={() => choose('model', m.id)}><div className="model-avatar">{m.name[0]}</div><span><strong>{m.name}</strong><small>{m.description}</small></span><em>{m.tag}</em>{(live?.model || value.model) === m.id && <Check size={14} />}</button>)}</div></> : control.id === 'ratio' ? <><div className="dimension-summary"><span>画面规格</span><strong>{value.resolution} · {value.ratio}</strong></div><div className="ratio-grid">{ratios.filter(ratio => !live || live.supported_aspects.includes(ratio)).map(ratio => { const [w, h] = ratio.split(':').map(Number); return <button key={ratio} role="radio" aria-checked={value.ratio === ratio} className={value.ratio === ratio ? 'picked' : ''} onClick={() => choose('ratio', ratio)}><i style={{ width: 21 * w / Math.max(w, h), height: 21 * h / Math.max(w, h) }} /><span>{ratio}</span></button> })}</div><p className="parameter-description">实际像素以生成结果为准。</p></> : <><div className={`option-grid${control.id === 'count' ? ' count-option-grid' : ''}`}>{(control.id === 'resolution' ? resolutions.filter(r => !live || live.supported_resolutions.includes(r)) : control.id === 'quality' ? qualities.filter(q => live?.supported_qualities?.includes(q)) : live?.supported_counts?.filter(n=>n>=1 && n<=4) || Array.from({length: Math.min(4, live?.max_images_per_call || 1)}, (_, i) => i + 1)).map(option => <button key={option} role="radio" aria-checked={value[control.id] === option} className={value[control.id] === option ? 'picked' : ''} onClick={() => choose(control.id, option)}>{option}{control.id === 'count' ? ' 张' : ''}{value[control.id] === option && <Check size={13} />}</button>)}</div><p className="parameter-description">{control.id === 'resolution' ? '实际像素以生成结果为准。' : control.id === 'quality' ? '精细度与分辨率独立设置。' : `当前模型单次支持 ${live?.supported_counts?.join('、') || `1–${Math.min(4,live?.max_images_per_call || 1)}`} 张。`}</p></>}
    </div>)}
  </div>)}</div>
}
