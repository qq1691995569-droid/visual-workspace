import type {Node} from '@xyflow/react'
import type {VisualAsset} from './AssetLibrary'
export type ExtractionTask={id:string;sourceId?:string;index:number;plannedCount?:number;kind:'material'|'model'|'person';focus:string;status:string;message:string;createdAt:string;finishedAt?:string;itemStatus?:string;itemMessage?:string}
export type ExtractedAsset={asset:VisualAsset;archived:boolean}
export type ExtractionSnapshot={id:string;status:string;message:string;createdAt?:string;results?:{id:string;asset:VisualAsset;archived:boolean}[];items?:{id:string;name:string;status:string;message:string}[]}
export function applyExtractionState<N extends Node>(nodes:N[],snapshot:ExtractionSnapshot):N[] {
  const root=nodes.find(n=>(n.data.extraction as ExtractionTask|undefined)?.id===snapshot.id)
  if(!root)return nodes
  const base=root.data.extraction as ExtractionTask
  const indices=snapshot.items?.length?snapshot.items.map((_,index)=>index):nodes.filter(n=>(n.data.extraction as ExtractionTask|undefined)?.id===snapshot.id).map(n=>(n.data.extraction as ExtractionTask).index)
  const output=[...nodes]
  for(const index of indices){
    const id=`extract-${snapshot.id}-${index}`,previous=output.find(n=>n.id===id),item=snapshot.items?.[index],result=snapshot.results?.find(r=>r.id===item?.id)
    if(!previous&&index<(base.plannedCount||1))continue
    const data={...(previous?.data||{}),kind:'image',imagePresentationVersion:1,extraction:{...base,index,status:snapshot.status,message:snapshot.message,createdAt:snapshot.createdAt||base.createdAt,finishedAt:['complete','paused'].includes(snapshot.status)?base.finishedAt||new Date().toISOString():undefined,itemStatus:item?.status,itemMessage:item?.message},...(result?{src:result.asset.image,label:previous?.data.src?previous.data.label:result.asset.name,extractedAsset:(previous?.data.extractedAsset as ExtractedAsset|undefined)?.archived?previous!.data.extractedAsset:{asset:result.asset,archived:result.archived}}:{label:item?.name||previous?.data.label||'资产提取'})}
    data.extraction.plannedCount=Math.max(base.plannedCount||1,snapshot.items?.length||1)
    const newX=Math.max(root.position.x+(index-base.index)*380,...output.filter(n=>n.parentId===root.parentId&&n.data.kind!=='group').map(n=>n.position.x+(n.measured?.width||Number(n.style?.width)||340)))+40
    const next={...(previous||{...root,id,position:{x:newX,y:root.position.y},selected:false,style:{width:340,height:340}}),data} as N
    const at=output.findIndex(n=>n.id===id);if(at<0)output.push(next);else output[at]=next
  }
  return output
}
