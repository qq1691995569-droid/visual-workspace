import type {Node} from '@xyflow/react'
import {absolutePosition,fitGroupNodes} from './graphLayout.ts'
export const arrangementOptions=[['left','左对齐','←'],['center','水平居中',''],['right','右对齐','→'],['top','顶对齐','↑'],['middle','垂直居中',''],['bottom','底对齐','↓'],['horizontal','水平等距','H'],['vertical','垂直等距','V'],['grid','网格排列','G']] as const
export type Arrangement=typeof arrangementOptions[number][0] | 'row'
function size(n:Node){return {w:Number(n.style?.width)||n.measured?.width||340,h:Number(n.style?.height)||(n.data.collapsed? n.measured?.height: (n.data.expandedSize as {height?:number})?.height)||n.measured?.height||350}}
export function avoidExpandedOverlap<N extends Node>(nodes:N[],id:string):N[]{
 const fitted=fitGroupNodes(nodes),original=fitted.find(n=>n.id===id);if(!original)return fitted
 const root=original.parentId?fitted.find(n=>n.id===original.parentId)||original:original
 const {w,h}=size(root),at=root.position,gap=36
 const obstacles=fitted.filter(n=>n.id!==root.id&&!n.parentId&&!n.hidden).map(n=>({...n.position,...size(n)}))
 const clear=(p:{x:number;y:number})=>!obstacles.some(o=>p.x<o.x+o.w+gap&&p.x+w+gap>o.x&&p.y<o.y+o.h+gap&&p.y+h+gap>o.y)
 if(clear(at))return fitted
 const candidates=obstacles.flatMap(o=>[{x:o.x+o.w+gap,y:at.y},{x:o.x-w-gap,y:at.y},{x:at.x,y:o.y+o.h+gap},{x:at.x,y:o.y-h-gap}])
 candidates.push({x:Math.max(at.x,...obstacles.map(o=>o.x+o.w))+gap,y:at.y})
 const position=candidates.filter(clear).sort((a,b)=>(a.x-at.x)**2+(a.y-at.y)**2-((b.x-at.x)**2+(b.y-at.y)**2))[0]
 return fitted.map(n=>n.id===root.id?{...n,position}:n)
}
export function arrangeCanvas<N extends Node>(nodes:N[],action:Arrangement):N[]{
 const ids=new Set(nodes.filter(n=>n.selected).map(n=>n.id))
 const chosen=nodes.filter(n=>n.selected&&!n.hidden&&(action==='row'?n.data.kind==='image':!(n.parentId&&ids.has(n.parentId))))
 if(chosen.length<2)return nodes
 const items=chosen.map(n=>({n,p:absolutePosition(n.id,nodes),...size(n)}))
 const left=Math.min(...items.map(i=>i.p.x)),right=Math.max(...items.map(i=>i.p.x+i.w)),top=Math.min(...items.map(i=>i.p.y)),bottom=Math.max(...items.map(i=>i.p.y+i.h))
 const places=new Map<string,{x:number;y:number}>()
 if(action==='row'){
  let x=left
  items.sort((a,b)=>a.p.x-b.p.x||a.p.y-b.p.y).forEach(i=>{places.set(i.n.id,{x,y:top});x+=i.w+36})
 }else if(action==='grid'){
  const cols=Math.ceil(Math.sqrt(items.length)),cellW=Math.max(...items.map(i=>i.w))+36,cellH=Math.max(...items.map(i=>i.h))+36
  items.sort((a,b)=>a.p.y-b.p.y||a.p.x-b.p.x).forEach((i,index)=>places.set(i.n.id,{x:left+(index%cols)*cellW,y:top+Math.floor(index/cols)*cellH}))
 }else if(action==='horizontal'||action==='vertical'){
  const horizontal=action==='horizontal',sorted=items.sort((a,b)=>horizontal?a.p.x-b.p.x:a.p.y-b.p.y),start=horizontal?left:top,end=horizontal?right:bottom,total=items.reduce((s,i)=>s+(horizontal?i.w:i.h),0),gap=Math.max(36,(end-start-total)/(items.length-1))
  let cursor=start;for(const i of sorted){places.set(i.n.id,horizontal?{x:cursor,y:i.p.y}:{x:i.p.x,y:cursor});cursor+=(horizontal?i.w:i.h)+gap}
 }else for(const i of items)places.set(i.n.id,{x:action==='left'?left:action==='right'?right-i.w:action==='center'?(left+right-i.w)/2:i.p.x,y:action==='top'?top:action==='bottom'?bottom-i.h:action==='middle'?(top+bottom-i.h)/2:i.p.y})
 return fitGroupNodes(nodes.map(n=>{const p=places.get(n.id);if(!p)return n;const parent=n.parentId?absolutePosition(n.parentId,nodes):{x:0,y:0};return {...n,position:{x:p.x-parent.x,y:p.y-parent.y}}}))
}
export function toolPlacement(sourceId:string|undefined,nodes:Node[],at:{x:number;y:number}|undefined,fallback:{x:number;y:number}){
 if(at)return {...at}
 const source=nodes.find(n=>n.id===sourceId);if(!source)return fallback
 const origin=absolutePosition(source.id,nodes)
 return {x:origin.x+(Number(source.style?.width)||source.measured?.width||340)+110,y:origin.y}
}

// Lay out the selected dependency graph in columns with branch-aware ordering.
export function arrangeWorkflow<N extends Node>(nodes:N[],edges:{source:string;target:string}[]):N[]{
 const selected=new Set(nodes.filter(n=>n.selected&&!n.hidden).map(n=>n.id))
 const chosen=nodes.filter(n=>{if(!selected.has(n.id))return false;let parent=n.parentId;const seen=new Set<string>();while(parent&&!seen.has(parent)){if(selected.has(parent))return false;seen.add(parent);parent=nodes.find(p=>p.id===parent)?.parentId}return true})
 if(chosen.length<2)return nodes
 const byId=new Map(chosen.map(n=>[n.id,n])),positions=new Map(chosen.map(n=>[n.id,absolutePosition(n.id,nodes)]))
 const compare=(a:string,b:string)=>positions.get(a)!.y-positions.get(b)!.y||positions.get(a)!.x-positions.get(b)!.x||a.localeCompare(b)
 const incoming=new Map(chosen.map(n=>[n.id,new Set<string>()])),outgoing=new Map(chosen.map(n=>[n.id,new Set<string>()]))
 const link=(source:string,target:string)=>{if(source!==target&&byId.has(source)&&byId.has(target)){incoming.get(target)!.add(source);outgoing.get(source)!.add(target)}}
 edges.forEach(e=>link(e.source,e.target))
 chosen.forEach(n=>{const result=(n.data.skillResult||n.data.pendingResult) as {sourceNode?:string}|undefined;if(result?.sourceNode)link(result.sourceNode,n.id)})
 const remaining=new Set(chosen.map(n=>n.id)),components:string[][]=[]
 while(remaining.size){const queue=[[...remaining].sort(compare)[0]],component:string[]=[];remaining.delete(queue[0]);while(queue.length){const id=queue.shift()!;component.push(id);for(const next of [...incoming.get(id)!,...outgoing.get(id)!])if(remaining.delete(next))queue.push(next)}components.push(component)}
 const left=Math.min(...[...positions.values()].map(p=>p.x));let top=Math.min(...[...positions.values()].map(p=>p.y))
 const places=new Map<string,{x:number;y:number}>()
 for(const component of components){
  const pending=new Set(component),rank=new Map<string,number>()
  while(pending.size){
   // Cyclic user connections are broken for layout only; actual edges stay intact.
   const ready=[...pending].filter(id=>[...incoming.get(id)!].every(p=>!pending.has(p))).sort(compare)
   const id=(ready.length?ready:[...pending].sort(compare))[0]
   rank.set(id,Math.max(0,...[...incoming.get(id)!].filter(p=>rank.has(p)).map(p=>rank.get(p)!+1)));pending.delete(id)
  }
  const layers=Array.from({length:Math.max(...rank.values())+1},(_,level)=>component.filter(id=>rank.get(id)===level).sort(compare))
  const order=new Map<string,number>()
  const refresh=()=>layers.forEach(layer=>layer.forEach((id,i)=>order.set(id,i)))
  // Barycentric sweeps bring connected branches together instead of sorting by
  // the old arbitrary screen coordinates. Backward cycle edges remain unchanged.
  refresh()
  for(let pass=0;pass<6;pass++){
   const forward=pass%2===1,indices=layers.map((_,i)=>i)
   if(!forward)indices.reverse()
   for(const level of indices){
    const neighbours=forward?incoming:outgoing
    const score=(id:string)=>{const peers=[...neighbours.get(id)!].filter(p=>rank.get(p)!==level && (forward?rank.get(p)!<level:rank.get(p)!>level));return peers.length?peers.reduce((sum,p)=>sum+order.get(p)!,0)/peers.length:order.get(id)!}
    layers[level].sort((a,b)=>score(a)-score(b)||order.get(a)!-order.get(b)!||a.localeCompare(b));refresh()
   }
  }
  const gapY=64,gapX=160,centers=new Map<string,number>()
  const heights=layers.map(layer=>layer.reduce((sum,id)=>sum+size(byId.get(id)!).h,0)+Math.max(0,layer.length-1)*gapY)
  const maxHeight=Math.max(...heights)
  layers.forEach((layer,l)=>{let y=(maxHeight-heights[l])/2;for(const id of layer){const h=size(byId.get(id)!).h;centers.set(id,y+h/2);y+=h+gapY}})
  // Center parents on their children and chains on their inputs, while packing
  // each column with actual node heights so labels and large tools do not overlap.
  for(let pass=0;pass<8;pass++){
   const forward=pass%2===0,indices=layers.map((_,i)=>i);if(!forward)indices.reverse()
   for(const l of indices){
    const layer=layers[l],neighbours=forward?incoming:outgoing
    const desired=layer.map(id=>{const peers=[...neighbours.get(id)!].filter(p=>forward?rank.get(p)!<l:rank.get(p)!>l);return peers.length?peers.reduce((sum,p)=>sum+centers.get(p)!,0)/peers.length:centers.get(id)!})
    const packed:number[]=[]
    layer.forEach((id,i)=>{const h=size(byId.get(id)!).h;packed.push(Math.max(desired[i],i?packed[i-1]+size(byId.get(layer[i-1])!).h/2+h/2+gapY:-Infinity))})
    const shift=packed.reduce((sum,y,i)=>sum+y-desired[i],0)/Math.max(1,layer.length)
    layer.forEach((id,i)=>centers.set(id,packed[i]-shift))
   }
  }
  const minY=Math.min(...component.map(id=>centers.get(id)!-size(byId.get(id)!).h/2))
  let x=left,componentHeight=0
  for(const layer of layers){
   for(const id of layer){const {h}=size(byId.get(id)!);const y=centers.get(id)!-h/2-minY;places.set(id,{x,y:top+y});componentHeight=Math.max(componentHeight,y+h)}
   x+=Math.max(...layer.map(id=>size(byId.get(id)!).w))+gapX
  }
  top+=componentHeight+160
 }
 return fitGroupNodes(nodes.map(n=>{const p=places.get(n.id);if(!p)return n;const parent=n.parentId?absolutePosition(n.parentId,nodes):{x:0,y:0};return {...n,position:{x:p.x-parent.x,y:p.y-parent.y}}}))
}
