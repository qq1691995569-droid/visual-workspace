import type {Node,Edge} from '@xyflow/react'
import {absolutePosition} from './graphLayout.ts'
export function independentImage<N extends Node>(node:N):N {
 const copy=structuredClone(node)
 for(const key of ['parentId','extent','expandParent','hidden','dragging','resizing'] as const)delete copy[key]
 for(const key of ['imageJob','extraction','skillState','pendingResult','task','skillResult','iterationContext','localEdit','composerRequest','refinementDraft','version','comparison','canvasOperation','canvasParameters','tool','final','generatedSkill','imageOutput'])delete copy.data[key]
 copy.data.provenanceLinked=true
 copy.selected=true
 return copy
}
export function copyCanvasImages<N extends Node>(nodes:N[],_edges:Edge[]){
 const groups=new Set(nodes.filter(n=>n.selected&&n.data.kind==='group').map(n=>n.id))
 const images=nodes.filter(n=>n.data.kind==='image'&&(n.selected||n.parentId&&groups.has(n.parentId))&&n.data.src&&!n.data.pendingResult&&!n.data.task&&(!n.data.imageJob||n.data.imageOutput))
 return {nodes:images.map(n=>({...independentImage(n),position:absolutePosition(n.id,nodes)})),edges:[] as Edge[]}
}
export function pasteCanvasImages<N extends Node>(graph:{nodes:N[];edges:Edge[]},at:{x:number;y:number},id:()=>string){
 const map=new Map(graph.nodes.map(n=>[n.id,id()]))
 const left=Math.min(...graph.nodes.map(n=>n.position.x)),top=Math.min(...graph.nodes.map(n=>n.position.y))
 return {nodes:graph.nodes.map(n=>({...independentImage(n),id:map.get(n.id)!,position:{x:n.position.x-left+at.x,y:n.position.y-top+at.y},selected:true})),edges:[] as Edge[]}
}
