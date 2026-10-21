import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Play } from 'lucide-react'
import type { SkillInput } from './SkillNode'

export type ToneSettings = { base?: string; reference?: string; parameters?: Record<string, unknown> }
export function ToneSkillNode({inputs,state,onChange,onResult}:{
  inputs: SkillInput[]; state:ToneSettings; onChange:(s:ToneSettings)=>void
  onResult:(src:string,snapshot:ToneSettings)=>void
}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const worker=useRef<Worker|null>(null)
  const base=state.base||inputs.find(i=>i.role!=='style')?.src
  const reference=state.reference||inputs.find(i=>i.role==='style')?.src||inputs.find(i=>i.src!==base)?.src
  useEffect(()=>()=>worker.current?.terminate(),[])
  async function upload(file:File|undefined,key:'base'|'reference'){
    if(!file)return
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请上传 PNG、JPEG 或 WebP')
      const bitmap=await createImageBitmap(file)
      const tooLarge=bitmap.width*bitmap.height>50000000;bitmap.close()
      if(tooLarge)throw Error('图片超过 5000 万像素，请缩小后上传')
      const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('读取失败'));r.readAsDataURL(file)})
      onChange({...state,[key]:src,parameters:undefined});setMessage('图片已更新，下次生成将自动初调')
    }catch(e){setMessage(String(e))}
  }
  function run(sample=false){
    if(!base||!reference||busy)return
    setBusy(true);setMessage(sample?'正在取样…':'正在调色…')
    const snapshot={...state,base,reference}
    const w=new Worker('/scene-tone/skill-worker.js');worker.current=w
    const finish=()=>{w.terminate();worker.current=null;setBusy(false)}
    w.onerror=()=>{setMessage('本地调色失败，请重试');finish()}
    w.onmessage=async e=>{
      if(e.data.error){setMessage(e.data.error);finish();return}
      if(e.data.progress){setMessage(e.data.progress);return}
      try {
        const saved={...snapshot,parameters:e.data.parameters}
        onChange({...state,parameters:e.data.parameters})
        if(e.data.blob){
          const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('保存失败'));r.readAsDataURL(e.data.blob)})
          if(worker.current!==w)return
          onResult(src,saved);setMessage('已生成，参数已保存，可继续调整后重新生成')
        }else setMessage('初调完成，可继续微调参数')
      }catch(e){setMessage(String(e))}finally{finish()}
    }
    w.postMessage({base,reference,parameters:undefined,sample})
  }
  return <fieldset disabled={busy} className="skill-body compact-skill tone-skill-compact nodrag nopan nowheel" style={{border:0,margin:0,minWidth:0}}>
    {(['base','reference'] as const).map((key,index)=>{
      const src=index?reference:base, title=index?'参考图':'底图'
      const name=inputs.find(input=>input.src===src)?.label || `已上传${title}`
      return <div className="tone-image-field" key={key}>
        <div className="tone-field-heading"><span>{title}</span>{state[key]&&<button type="button" onClick={()=>onChange({...state,[key]:undefined,parameters:undefined})}>使用连线图片</button>}</div>
        <label className="tone-image-select">
          {src?<img src={src} alt={title} draggable={false}/>:<span className="tone-image-empty"><ImagePlus size={16}/></span>}
          <span className="tone-image-name" title={src?name:undefined}>{src?name:`上传或连接${title}`}</span>
          <span className="tone-image-action">{src?'替换':'上传'}</span><ChevronDown size={14}/>
          <input type="file" aria-label={`上传或替换${title}`} accept="image/png,image/jpeg,image/webp" onChange={e=>{void upload(e.target.files?.[0],key);e.target.value=''}}/>
        </label>
      </div>
    })}
    <small>生成后，点击结果的“滑块对比”微调色彩。</small>
    {message&&<p role="status">{message}</p>}
    <button className="primary skill-run" disabled={!base||!reference} onClick={()=>run()}><Play size={14}/>{busy?'调色中…':'一键调色'}</button>
  </fieldset>
}
