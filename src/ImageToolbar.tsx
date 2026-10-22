import {useFunctionEnabled} from './functionFlags'
import { useStore } from '@xyflow/react'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Sparkles, Layers, Scan, Eraser, Expand, ScanLine, Download, Scissors, Archive, Columns2 } from 'lucide-react'

export function ImageToolbar({ anchor, revision, onAction, onDownload, onSaveAsset, assetSaved, onCompare }: {
  anchor: RefObject<HTMLDivElement | null>; revision: string
  onAction: (operation: string) => void; onDownload: () => void; onSaveAsset?:()=>void; assetSaved?:boolean; onCompare?:()=>void
}) {
  const functionEnabled=useFunctionEnabled()
  const zoom=useStore(state=>state.transform[2])
  const scale=Math.max(.15,Math.min(1,zoom))
  const dragging=useStore(state=>state.nodes.some(node=>node.dragging))
  const toolbar = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; scale: number } | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect || !toolbar.current) return
      const canvas = anchor.current?.closest('main')?.getBoundingClientRect()
      const leftBound = canvas ? canvas.left + 12 : 12
      const rightBound = canvas ? canvas.right - 12 : window.innerWidth - 12
      const displayScale = Math.min(scale, Math.max(0, rightBound-leftBound) / toolbar.current.offsetWidth)
      const width = toolbar.current.offsetWidth * displayScale
      const left = Math.max(leftBound, Math.min(rect.left + rect.width / 2 - width / 2, rightBound-width))
      const top = rect.top - toolbar.current.offsetHeight * displayScale - 6
      setPosition({ left, top, scale: displayScale })
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
  const commands = [
    ...(onCompare ? [{ id: 'compare', label: '滑块对比', icon: Columns2, run: onCompare }] : []),
    ...actions.filter(action=>functionEnabled(action.id)).map(action => ({...action, run: () => onAction(action.id)})),
    ...(onSaveAsset ? [{ id: 'save', label: assetSaved ? '已入库' : '保存资产', icon: Archive, run: onSaveAsset, disabled: assetSaved }] : []),
    { id: 'download', label: '下载原图', icon: Download, run: onDownload },
  ]
  const renderButton = (command: typeof commands[number]) => <button key={command.id} title={command.label} aria-label={command.label} disabled={'disabled' in command && command.disabled} onClick={command.run}><command.icon size={16}/><span>{command.label}</span></button>
  return createPortal(<div ref={toolbar} role="toolbar" aria-label="图片快捷修改" className={`image-toolbar image-edit-toolbar single-row-image-toolbar`} style={{ left: position?.left ?? 12, top: position?.top ?? 80, transform:`scale(${position?.scale ?? scale})`,transformOrigin:'top left',visibility: position && position.scale > 0 && position.top >= 68 && !dragging ? 'visible' : 'hidden' }} onPointerDown={e => e.stopPropagation()}>
    <div className="image-toolbar-row">{commands.map(renderButton)}</div>
  </div>, document.body)
}
