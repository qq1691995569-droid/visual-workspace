import {useEffect,useRef,useState} from 'react'
import {ChevronDown,ChevronUp,Ungroup} from 'lucide-react'
export function GroupActions({collapsed,onFold,onExpand,onUngroup,hasGroups}:{collapsed:boolean;onFold:()=>void;onExpand:()=>void;onUngroup:()=>void;hasGroups:boolean}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[open])
 const act=(fn:()=>void)=>{setOpen(false);fn()}
 return <div className="group-action-menu" ref={root}>
  <button ref={trigger} aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(!open)}><ChevronUp size={18}/>{collapsed?'展开 / 折叠':'折叠'}<ChevronDown size={14}/></button>
  {open&&<div className="group-action-options" aria-label="收纳操作">
   <button onClick={()=>act(onFold)}><ChevronUp size={18}/><span>折叠收纳<small>将所选内容收起为卡片</small></span></button>
   <button disabled={!hasGroups&&!collapsed} onClick={()=>act(onExpand)}><ChevronDown size={18}/><span>展开内容<small>保留分组，显示组内节点</small></span></button>
   <button disabled={!hasGroups} onClick={()=>act(onUngroup)}><Ungroup size={18}/><span>解开折叠（解散分组）<small>恢复独立节点，保留位置和连线</small></span></button>
  </div>}
 </div>
}
