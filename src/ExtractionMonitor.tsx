import {personDisplayViews} from './personPresentation'
import {useEffect,useRef} from 'react'
import type {ExtractionSnapshot} from './canvasExtraction'
export function ExtractionMonitor({id,kind,onState}:{id:string;kind?:string;onState:(state:ExtractionSnapshot)=>void}) {
  const callback=useRef(onState)
  useEffect(()=>{callback.current=onState},[onState])
  useEffect(()=>{
    let live=true,timer:ReturnType<typeof setTimeout>
    async function poll(){try{
      const response=await fetch((kind==='person'?'/api/skills/images/tasks/':'/api/skills/assets/extract/tasks/')+id),result=await response.json()
      if(!live)return
      if(!response.ok)throw Error(result.error||'查询失败')
      if(kind==='person'){
        if(result.status==='complete'&&!result.asset){result.status='restoring';result.message='正在保存人物参考图；不会重复生图'}
        const asset=result.asset
        const views=asset?await personDisplayViews(asset):[]
        if(!live)return
        callback.current({id,status:result.status==='submit_error'?'paused':result.status,message:result.message,createdAt:result.createdAt,
          items:[0,1].map(index=>({id:id+'-'+index,name:index?'综合细节图':'全身照',status:views[index]?'complete':result.status,message:result.message})),
          results:views.slice(0,2).map((view:{label:string;image:string},index:number)=>({id:id+'-'+index,asset:{...asset,image:view.image,name:asset.name+' · '+view.label},archived:true}))})
        if(['complete','paused','submit_error'].includes(result.status))sessionStorage.removeItem('canvas-person-asset-task')
      }else callback.current(result)
      if(['complete','paused','submit_error'].includes(result.status))return
    }catch{if(live)callback.current({id,status:'restoring',message:'正在恢复提取任务状态；不会重新提交生图'})}
    if(live)timer=setTimeout(()=>void poll(),4000)}
    void poll();return()=>{live=false;clearTimeout(timer)}
  },[id,kind])
  return null
}
