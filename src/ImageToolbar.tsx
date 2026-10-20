import { useStore } from '@xyflow/react'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Sparkles, Layers, Scan, Eraser, Expand, ScanLine, Download, Scissors, Archive, Columns2 } from 'lucide-react'

export function ImageToolbar({ anchor, revision, onAction, onDownload, onSaveAsset, assetSaved, onCompare }: {
  anchor: RefObject<HTMLDivElement | null>; revision: string
  onAction: (operation: string) => void; onDownload: () => void; onSaveAsset?:()=>void; assetSaved?:boolean; onCompare?:()=>void
}) {
  const zoom=useStore(state=>state.transform[2])
  const scale=Math.max(.95,Math.min(1,zoom))
  const toolbar = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect || !toolbar.current) return
      const canvas = anchor.current?.closest('main')?.getBoundingClientRect()
      const leftBound = canvas ? canvas.left + 12 : 12
      const rightBound = canvas ? canvas.right - 12 : window.innerWidth - 12
      toolbar.current.style.maxWidth = `${Math.max(160,(rightBound-leftBound)/scale)}px`
      const width = toolbar.current.offsetWidth*scale, height = toolbar.current.offsetHeight*scale
      const above = rect.y - height - 10
      const top = above >= 80 ? above : rect.bottom + 10
      setPosition({ left: Math.max(leftBound, Math.min(rect.x + rect.width / 2 - width / 2, rightBound - width)), top:Math.min(top,window.innerHeight-height-12) })
    }
    update()
    const observer = new ResizeObserver(update)
    if (anchor.current) observer.observe(anchor.current)
    const canvas = anchor.current?.closest('main')
    if (canvas) observer.observe(canvas)
    if (toolbar.current) observer.observe(toolbar.current)
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [anchor, revision, scale])
  const actions = [
    { id: 'edit', label: '编辑', icon: PencilLine },
    { id: 'redraw', label: '引用生成', icon: Sparkles },
    { id: 'extract', label: '提取资产', icon: Scissors },
    { id: 'separate', label: '多图层', icon: Layers },
    { id: 'background', label: '去背景', icon: Scan },
    { id: 'erase', label: '消除', icon: Eraser },
    { id: 'expand', label: '扩图', icon: Expand },
    { id: 'upscale', label: '变清晰', icon: ScanLine },
  ]
  return createPortal(<div ref={toolbar} role="toolbar" aria-label="图片快捷修改" className="image-toolbar image-edit-toolbar small-image-toolbar" style={{ left: position?.left || 12, top: position?.top || 80, transform:`scale(${scale})`,transformOrigin:'top left',visibility: position ? 'visible' : 'hidden' }} onPointerDown={e => e.stopPropagation()}>
    {onCompare&&<button title="滑块对比" onClick={onCompare}><Columns2 size={14}/><span>滑块对比</span></button>}
    {onSaveAsset&&<button disabled={assetSaved} onClick={onSaveAsset}><Archive size={14}/><span>{assetSaved?'已入库':'保存资产'}</span></button>}
    {actions.map((action,index)=><button key={action.id} className={index===2?'with-divider':''} title={action.label} onClick={()=>onAction(action.id)}><action.icon size={14}/><span>{action.label}</span></button>)}
    <button className="with-divider" aria-label="下载原图" title="下载原图" onClick={onDownload}><Download size={15}/></button>

  </div>, document.body)
}
