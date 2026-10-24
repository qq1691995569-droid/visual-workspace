import {useFunctionEnabled} from './functionFlags'
import { useStore } from '@xyflow/react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Layers, Scan, Eraser, Expand, ScanLine, Download, Scissors, Archive, Columns2, MoreHorizontal } from 'lucide-react'

export function ImageToolbar({ anchor, revision, onAction, onDownload, onSaveAsset, assetSaved, onCompare, layerMode }: {
  anchor: RefObject<HTMLDivElement | null>; revision: string
  onAction: (operation: string) => void; onDownload: () => void; onSaveAsset?:()=>void; assetSaved?:boolean; onCompare?:()=>void; layerMode?:boolean
}) {
  const functionEnabled=useFunctionEnabled()
  const zoom=useStore(state=>state.transform[2])
  const scale=Math.max(.15,Math.min(1,zoom))
  const dragging=useStore(state=>state.nodes.some(node=>node.dragging))
  const toolbar = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; scale: number } | null>(null)
  const [moreOpen,setMoreOpen] = useState(false)
  useEffect(()=>{
    if(!moreOpen)return
    const close=(event:PointerEvent)=>{if(!toolbar.current?.contains(event.target as HTMLElement))setMoreOpen(false)}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMoreOpen(false)}
    document.addEventListener('pointerdown',close)
    document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}
  },[moreOpen])
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
  const renderButton = (command: typeof commands[number]) => <button key={command.id} title={command.label} aria-label={command.label} disabled={'disabled' in command && command.disabled} onClick={()=>{setMoreOpen(false);command.run()}}><command.icon size={16}/><span>{command.label}</span></button>
  const primaryCommands=layerMode?commands.filter(command=>['edit','download'].includes(command.id)):commands
  const extraCommands=layerMode?commands.filter(command=>!['edit','download'].includes(command.id)):[]
  return createPortal(<div ref={toolbar} role="toolbar" aria-label="图片快捷修改" className={`image-toolbar image-edit-toolbar single-row-image-toolbar`} style={{ left: position?.left ?? 12, top: position?.top ?? 80, transform:`scale(${position?.scale ?? scale})`,transformOrigin:'top left',visibility: position && position.scale > 0 && position.top >= 68 && !dragging ? 'visible' : 'hidden' }} onPointerDown={e => e.stopPropagation()}>
    <div className="image-toolbar-row">{primaryCommands.filter(command=>command.id!=='download').map(renderButton)}{extraCommands.length>0&&<button type="button" aria-label="更多图层操作" title="更多图层操作" aria-expanded={moreOpen} onClick={()=>setMoreOpen(open=>!open)}><MoreHorizontal size={16}/></button>}{primaryCommands.filter(command=>command.id==='download').map(renderButton)}</div>
    {moreOpen&&<div className="image-layer-more" role="menu" aria-label="更多图层操作">{extraCommands.map(renderButton)}</div>}
  </div>, document.body)
}
