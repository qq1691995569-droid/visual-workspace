import type {Edge,Node} from '@xyflow/react'
// Presentation only: keep original endpoints in the persisted graph.
export function groupConnection(edge:Edge,nodes:Map<string,Node>,focused:Set<string>,selected:Set<string>,excluded:Set<string>){
 const folded=(id:string)=>{const node=nodes.get(id);return node?.parentId&&nodes.get(node.parentId)?.data.collapsed?node.parentId:undefined}
 const source=edge.source,target=edge.target
 const unavailable=!!folded(source)||!!folded(target)||nodes.get(source)?.data.kind==='group'||nodes.get(target)?.data.kind==='group'
 const inGroup=!!nodes.get(edge.source)?.parentId||!!nodes.get(edge.target)?.parentId
 return {...edge,source,target,sourceHandle:source===edge.source?edge.sourceHandle:undefined,targetHandle:target===edge.target?edge.targetHandle:undefined,
 hidden:unavailable||excluded.has(source)||excluded.has(target)||source===target||!(edge.selected||inGroup||selected.has(source)||selected.has(target)||focused.has(edge.source)&&focused.has(edge.target)),
 reconnectable:edge.reconnectable!==false&&source===edge.source&&target===edge.target}
}
