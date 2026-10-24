import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Check, MousePointer2, Plus, RotateCcw } from 'lucide-react'
import type { InlineParameters } from './builtinSkills'

type Box=[number,number,number,number]
type Region={id:string;box:Box}
type Point={x:number;y:number}
type Crop={x:number;y:number;width:number;height:number;frameWidth:number;frameHeight:number}
type Geometry={left:number;top:number;width:number;height:number}
const clamp=(value:number)=>Math.max(0,Math.min(999,Math.round(value)))
const sortedBox=(a:Point,b:Point):Box=>[Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y)]

export function InteractiveImageEdit({anchor,revision,crop,onCancel,onConfirm}:{anchor:RefObject<HTMLDivElement|null>;revision:string;crop?:Crop;onCancel:()=>void;onConfirm:(parameters:InlineParameters)=>void}){
  const overlay=useRef<HTMLDivElement>(null)
  const bar=useRef<HTMLDivElement>(null)
  const editor=useRef<HTMLDivElement>(null)
  const start=useRef<Point|null>(null)
  const savedRange=useRef<Range|null>(null)
  const nextRegionId=useRef(1)
  const [geometry,setGeometry]=useState<Geometry>({left:0,top:0,width:100,height:100})
  const [barPoint,setBarPoint]=useState({left:12,top:80})
  const [regions,setRegions]=useState<Region[]>([])
  const [draft,setDraft]=useState<Box|null>(null)
  const [focusedRegion,setFocusedRegion]=useState<number|null>(null)
  const [menuOpen,setMenuOpen]=useState(false)
  const [mentionedIds,setMentionedIds]=useState<string[]>([])
  const [hasInstruction,setHasInstruction]=useState(false)
  const boxes=regions.map(region=>region.box)
  const includedCount=mentionedIds.length
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){if(menuOpen)setMenuOpen(false);else onCancel()}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[menuOpen,onCancel])
  useEffect(()=>{if(!menuOpen)return;const close=(event:globalThis.PointerEvent)=>{if(!bar.current?.contains(event.target as Node))setMenuOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[menuOpen])
  useEffect(()=>{
    editor.current?.querySelectorAll<HTMLElement>('.interactive-edit-mention').forEach(mention=>{
      const index=regions.findIndex(region=>region.id===mention.dataset.regionId)
      if(index<0){mention.remove();return}
      const number=mention.querySelector('b')
      if(number)number.textContent=String(index+1)
      mention.setAttribute('aria-label',`区域 ${index+1}`)
    })
  },[regions])
  const refreshEditor=()=>{
    const root=editor.current
    if(!root)return
    setMentionedIds(Array.from(root.querySelectorAll<HTMLElement>('.interactive-edit-mention'),node=>node.dataset.regionId||''))
    setHasInstruction(Array.from(root.childNodes).some(node=>node.nodeType===Node.TEXT_NODE&&Boolean(node.textContent?.trim())))
  }
  const rememberCaret=()=>{
    const selection=window.getSelection(),root=editor.current
    if(selection?.rangeCount&&root?.contains(selection.anchorNode))savedRange.current=selection.getRangeAt(0).cloneRange()
  }
  const insertMention=(id:string,index:number,atCaret=false)=>{
    const root=editor.current
    if(!root)return
    const range=atCaret&&savedRange.current&&root.contains(savedRange.current.commonAncestorContainer)
      ?savedRange.current.cloneRange():document.createRange()
    if(!atCaret||!savedRange.current||!root.contains(savedRange.current.commonAncestorContainer)){
      range.selectNodeContents(root);range.collapse(false)
    }
    range.deleteContents()
    const mention=document.createElement('span')
    mention.className='interactive-edit-mention'
    mention.contentEditable='false'
    mention.dataset.regionId=id
    mention.setAttribute('aria-label',`区域 ${index}`)
    const badge=document.createElement('b');badge.textContent=String(index)
    mention.append(badge,document.createTextNode('区域'))
    const fragment=document.createDocumentFragment()
    if(root.textContent?.trim())fragment.append(document.createTextNode(' '))
    const trailing=document.createTextNode('\u00a0')
    fragment.append(mention,trailing)
    range.insertNode(fragment)
    root.focus()
    const caret=document.createRange();caret.setStartAfter(trailing);caret.collapse(true)
    const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(caret)
    savedRange.current=caret.cloneRange()
    refreshEditor()
  }
  const removeMention=(id:string)=>{
    editor.current?.querySelectorAll<HTMLElement>(`.interactive-edit-mention[data-region-id="${id}"]`).forEach(mention=>{
      let next=mention.nextSibling
      while(next&&!(next instanceof HTMLElement&&next.classList.contains('interactive-edit-mention'))){
        const following=next.nextSibling;next.parentNode?.removeChild(next);next=following
      }
      mention.remove()
    })
    savedRange.current=null
    refreshEditor()
  }
  const editorPrompt=()=>Array.from(editor.current?.childNodes||[]).map(node=>{
    if(node instanceof HTMLElement&&node.classList.contains('interactive-edit-mention')){
      const index=regions.findIndex(region=>region.id===node.dataset.regionId)
      return index<0?'':`区域 ${index+1}：`
    }
    return node.textContent||''
  }).join('').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()
  useLayoutEffect(()=>{
    const node=anchor.current, image=node?.querySelector<HTMLImageElement>('.image-body img')
    if(!node)return
    const update=()=>{
      const card=node.getBoundingClientRect(),body=node.querySelector('.image-body')?.getBoundingClientRect()||card
      if(!card.width||!card.height)return
      let left=body.left,top=body.top,width=body.width,height=body.height
      if(!crop&&image?.naturalWidth&&image.naturalHeight){
        const ratio=image.naturalWidth/image.naturalHeight,slot=body.width/body.height
        if(ratio>slot){height=body.width/ratio;top=body.top+(body.height-height)/2}
        else{width=body.height*ratio;left=body.left+(body.width-width)/2}
      }
      setGeometry({left:(left-card.left)/card.width*100,top:(top-card.top)/card.height*100,width:width/card.width*100,height:height/card.height*100})
      const barWidth=bar.current?.offsetWidth||420,barHeight=bar.current?.offsetHeight||66
      setBarPoint({left:Math.max(12,Math.min(left+width/2-barWidth/2,window.innerWidth-barWidth-12)),top:body.bottom+barHeight+24<window.innerHeight?body.bottom+12:Math.max(12,body.top-barHeight-12)})
    }
    update()
    const observer=new ResizeObserver(update);observer.observe(node);if(bar.current)observer.observe(bar.current)
    image?.addEventListener('load',update);window.addEventListener('resize',update)
    return()=>{observer.disconnect();image?.removeEventListener('load',update);window.removeEventListener('resize',update)}
  },[anchor,revision,crop])
  const pointAt=(event:PointerEvent<HTMLDivElement>):Point=>{
    const rect=overlay.current!.getBoundingClientRect()
    return {x:clamp((event.clientX-rect.left)/rect.width*999),y:clamp((event.clientY-rect.top)/rect.height*999)}
  }
  const finish=(event:PointerEvent<HTMLDivElement>)=>{
    event.stopPropagation()
    if(!start.current)return
    const end=pointAt(event),next=sortedBox(start.current,end)
    if(next[2]-next[0]>=8&&next[3]-next[1]>=8&&boxes.length<12){
      const id=String(nextRegionId.current++)
      setRegions(current=>[...current,{id,box:next}])
      insertMention(id,boxes.length+1)
    }
    start.current=null;setDraft(null)
    if(overlay.current?.hasPointerCapture(event.pointerId))overlay.current.releasePointerCapture(event.pointerId)
  }
  const submit=()=>{
    if(!hasInstruction||!boxes.length)return
    const mapped:Box[]=crop?boxes.map(([x1,y1,x2,y2])=>[
      clamp((crop.x+x1/999*crop.width)/crop.frameWidth*999),
      clamp((crop.y+y1/999*crop.height)/crop.frameHeight*999),
      clamp((crop.x+x2/999*crop.width)/crop.frameWidth*999),
      clamp((crop.y+y2/999*crop.height)/crop.frameHeight*999),
    ]):boxes
    const prompt=editorPrompt()
    onConfirm({prompt,boxes:mapped})
  }
  const all=draft?[...boxes,draft]:boxes
  return <>
    <div ref={overlay} className="interactive-edit-overlay nodrag nopan" aria-label="在图片中拖拽框选编辑区域" style={{left:`${geometry.left}%`,top:`${geometry.top}%`,width:`${geometry.width}%`,height:`${geometry.height}%`}}
      onPointerDown={event=>{if(event.button!==0||boxes.length>=12)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);start.current=pointAt(event);setDraft(sortedBox(start.current,start.current))}}
      onPointerMove={event=>{if(!start.current)return;event.preventDefault();event.stopPropagation();setDraft(sortedBox(start.current,pointAt(event)))}}
      onPointerUp={finish} onPointerCancel={event=>{event.stopPropagation();start.current=null;setDraft(null)}} onClick={event=>event.stopPropagation()}>
      {all.map((box,index)=><span key={index} className={`interactive-edit-box${index===boxes.length?' is-draft':''}${index===focusedRegion?' is-focused':''}`} style={{left:`${box[0]/999*100}%`,top:`${box[1]/999*100}%`,width:`${(box[2]-box[0])/999*100}%`,height:`${(box[3]-box[1])/999*100}%`}}><b>{index+1}</b></span>)}
      {!boxes.length&&!draft&&<span className="interactive-edit-hint"><MousePointer2 size={14}/> 在图片上拖拽框选要编辑的位置</span>}
    </div>
    {createPortal(<div ref={bar} className="interactive-edit-bar" role="toolbar" aria-label="图片交互编辑" style={{left:barPoint.left,top:barPoint.top,width:Math.min(window.innerWidth-24,Math.min(620,Math.max(330,205+includedCount*130)))}}>
      <div className="interactive-edit-compose">
        <div className="interactive-edit-add-wrap">
          <button type="button" className="interactive-edit-add" aria-label="添加或管理框选区域" aria-expanded={menuOpen}
            onClick={()=>setMenuOpen(open=>!open)}><Plus size={16}/></button>
          {menuOpen&&<div className="interactive-edit-picker" role="menu" aria-label="选择框选区域"
            style={barPoint.top<180?{top:'calc(100% + 6px)',bottom:'auto'}:undefined}>
            <span>框选区域</span>
            {regions.length?regions.map((region,index)=><button key={region.id} type="button" role="menuitemcheckbox" aria-label={`引用区域 ${index+1}`} aria-checked={mentionedIds.includes(region.id)}
              onClick={()=>{if(mentionedIds.includes(region.id))removeMention(region.id);else insertMention(region.id,index+1,true);setFocusedRegion(null);setMenuOpen(false)}}>
              <b>{index+1}</b>区域 {index+1}{mentionedIds.includes(region.id)&&<Check size={13}/>}
            </button>):<small>先在图片上框选区域</small>}
          </div>}
        </div>
        <div ref={editor} className="interactive-edit-input" role="textbox" aria-label="图片修改要求" aria-multiline="false"
          contentEditable suppressContentEditableWarning data-placeholder={regions.length?'输入修改要求，＋可引用区域':'先在图片上框选区域'}
          onInput={()=>{refreshEditor();rememberCaret()}} onClick={rememberCaret} onKeyUp={rememberCaret} onBlur={rememberCaret}
          onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();submit()}}}
          onPaste={event=>{
            event.preventDefault()
            const text=event.clipboardData.getData('text/plain').replace(/[\r\n]+/g,' ')
            const selection=window.getSelection()
            if(!selection?.rangeCount)return
            const range=selection.getRangeAt(0);range.deleteContents()
            const node=document.createTextNode(text);range.insertNode(node)
            range.setStartAfter(node);range.collapse(true)
            selection.removeAllRanges();selection.addRange(range)
            refreshEditor();rememberCaret()
          }}
          onMouseOver={event=>{
            const mention=(event.target as HTMLElement).closest<HTMLElement>('.interactive-edit-mention')
            if(mention)setFocusedRegion(regions.findIndex(region=>region.id===mention.dataset.regionId))
          }} onMouseLeave={()=>setFocusedRegion(null)}/>
        <div className="interactive-edit-actions">
          <button type="button" aria-label="撤销框选" title="撤销框选" disabled={!boxes.length}
            onClick={()=>{const last=regions.at(-1);if(last)removeMention(last.id);setRegions(current=>current.slice(0,-1));setFocusedRegion(null)}}><RotateCcw size={15}/></button>
          <button type="button" onClick={onCancel}>取消</button>
          <button type="button" className="confirm" aria-label="生成图片" title="生成图片" disabled={!hasInstruction} onClick={submit}><ArrowUp size={17}/></button>
        </div>
      </div>
    </div>,document.body)}
  </>
}
