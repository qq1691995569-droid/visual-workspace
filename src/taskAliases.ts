import type {Node,Edge} from '@xyflow/react'
type ResultData={src?:string;pendingResult?:{jobId:string;index:number};skillResult?:{jobId:string}}
// Older canvases used the child generation ID; the pipeline now owns the result row.
export function mergeTaskAliases<N extends Node,E extends Edge>(nodes:N[],edges:E[],aliases:{alias:string;canonical:string}[]){
 const remap=new Map<string,string>(),replacements=new Map<string,N>(),removed=new Set<string>()
 for(const {alias,canonical} of aliases){
  if(alias===canonical)continue
  for(const n of nodes){
   const d=n.data as ResultData
   if(d.pendingResult?.jobId!==alias&&d.skillResult?.jobId!==alias)continue
   const index=d.pendingResult?.index??Number(n.id.split('-').at(-1));if(!Number.isInteger(index))continue
   const id=`skill-${canonical}-${index}`,existing=nodes.find(x=>x.id===id)
   // Preserve a separately edited image instead of discarding user work.
   if(existing&&d.src&&existing.data.src&&d.src!==existing.data.src)continue
   remap.set(n.id,id);removed.add(n.id)
   if(!existing||!existing.data.src&&d.src)replacements.set(id,{...n,id,position:existing?.position||n.position,data:{...n.data,...(d.pendingResult?{pendingResult:{...d.pendingResult,jobId:canonical}}:{}),...(d.skillResult?{skillResult:{...d.skillResult,jobId:canonical}}:{})}})
  }
 }
 if(!remap.size)return {nodes,edges}
 const next=nodes.filter(n=>!removed.has(n.id)).map(n=>replacements.get(n.id)||n)
 for(const [id,n] of replacements)if(!next.some(x=>x.id===id))next.push(n)
 const seen=new Set<string>(),nextEdges:E[]=[]
 for(const e of edges){const source=remap.get(e.source)||e.source,target=remap.get(e.target)||e.target,key=JSON.stringify([source,target,e.sourceHandle,e.targetHandle]);if(source===target||seen.has(key))continue;seen.add(key);nextEdges.push(source===e.source&&target===e.target?e:{...e,source,target})}
 return {nodes:next,edges:nextEdges}
}
