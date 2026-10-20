import type {Node,Edge} from '@xyflow/react'
import type {LocalEditRecipe} from './AssetLibrary'
import {absolutePosition} from './graphLayout.ts'
type Link={ownerId:string;key:string}
export function syncMaterialReferences<N extends Node>(nodes:N[],edges:Edge[]) {
 let next=nodes;const wanted:Edge[]=[]
 for(const owner of nodes){
  const recipe=owner.data.localEdit as LocalEditRecipe|undefined
  if(owner.data.kind!=='tool'||!recipe||recipe.kind!=='material')continue
  for(const [index,region] of (recipe.regions||[recipe]).entries()){
   if(!region.useImageReference)continue
   const key=String('id' in region&&region.id||index),id=`material-ref-${owner.id}-${key}`,edgeId=`material-link-${owner.id}-${key}`
   const existing=next.find(n=>n.id===id),label=`参考 ${index+1} · ${region.target} · ${region.asset.name}`
   if(!existing){
    const origin=absolutePosition(owner.id,nodes),x=origin.x-260;let y=origin.y+180
    const obstacles=next.filter(n=>!n.parentId).map(n=>({...n.position,w:Number(n.style?.width)||n.measured?.width||340,h:Number(n.style?.height)||n.measured?.height||420}))
    while(obstacles.some(n=>x<n.x+n.w+24&&x+200+24>n.x&&y<n.y+n.h+24&&y+200+24>n.y))y=Math.max(...obstacles.filter(n=>x<n.x+n.w+24&&x+200+24>n.x&&y<n.y+n.h+24&&y+200+24>n.y).map(n=>n.y+n.h+24))
    next=[...next,{id,type:'card',position:{x,y},style:{width:200,height:200},data:{kind:'image',src:region.asset.image,label,imagePresentationVersion:1,materialReference:{ownerId:owner.id,key}}} as unknown as N]
   }else if(existing.data.src!==region.asset.image||existing.data.label!==label){next=next.map(n=>n.id===id?{...n,data:{...n.data,src:region.asset.image,label}}:n)}
   wanted.push({id:edgeId,source:id,target:owner.id,targetHandle:'style',reconnectable:false,data:{materialReference:true}})
  }
 }
 const wantedIds=new Set(wanted.map(e=>e.id))
 let links=edges.filter(e=>!e.data?.materialReference||wantedIds.has(e.id))
 for(const edge of wanted)if(!links.some(e=>e.id===edge.id))links=[...links,edge]
 if(links.length===edges.length&&links.every((e,i)=>e===edges[i]))links=edges
 return {nodes:next,edges:links}
}
export function unlinkMaterialReferences<N extends Node>(nodes:N[],removedSources:Set<string>) {
 const links=nodes.filter(n=>removedSources.has(n.id)&&n.data.materialReference).map(n=>n.data.materialReference as Link)
 return nodes.map(n=>{
  const keys=new Set(links.filter(r=>r.ownerId===n.id).map(r=>r.key)),recipe=n.data.localEdit as LocalEditRecipe|undefined
  if(!keys.size||!recipe)return n
  const regions=recipe.regions?.map((r,i)=>keys.has(String(r.id||i))?{...r,useImageReference:false}:r)
  return {...n,data:{...n.data,localEdit:regions?{...recipe,regions,useImageReference:regions[0]?.useImageReference}:{...recipe,useImageReference:false}}}
 })
}
