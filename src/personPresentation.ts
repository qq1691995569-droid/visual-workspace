import {useEffect,useState} from 'react'
import type {VisualAsset} from './AssetLibrary'
export async function personDisplayViews(asset:VisualAsset){
  const full={label:'全身照',image:asset.image}
  const sheet=asset.views?.find(v=>v.label==='综合细节图')
  if(sheet)return [full,sheet]
  if(asset.views?.length!==9)return [full]
  // Older assets retain all nine originals; compose a display sheet without generation.
  const images=await Promise.all(asset.views.map(v=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('人物参考图读取失败'));image.src=v.image})))
  const tile=Math.min(768,Math.max(...images.map(image=>Math.max(image.naturalWidth,image.naturalHeight))))
  const canvas=document.createElement('canvas');canvas.width=canvas.height=tile*3
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)
  images.forEach((image,index)=>{const scale=Math.min(tile/image.naturalWidth,tile/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,index%3*tile+(tile-w)/2,Math.floor(index/3)*tile+(tile-h)/2,w,h)})
  return [full,{label:'综合细节图',image:canvas.toDataURL('image/png')}]
}
export function usePersonViews(asset:VisualAsset|null){
  const [presentation,setPresentation]=useState<{asset:VisualAsset;views:{label:string;image:string}[]}|null>(null)
  useEffect(()=>{let live=true;if(asset?.kind==='person')void personDisplayViews(asset).then(views=>{if(live)setPresentation({asset,views})}).catch(()=>{});return()=>{live=false}},[asset])
  if(!asset)return []
  return presentation?.asset===asset?presentation.views:asset.views?.length===2?asset.views:[{label:'全身照',image:asset.image}]
}
