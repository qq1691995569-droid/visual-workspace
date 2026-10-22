import './TextureRestoreNode.css'
import {useEffect,useRef,useState} from 'react'
import {ImagePlus,Play} from 'lucide-react'
import {GenerationControls} from './GenerationControls'
import type {Generation} from './generation'
import type {SkillInput} from './SkillNode'
import type {ImageJobState} from './ImageJob'
import {TaskNotice} from './TaskNotice'
import {prepareUploadedImage} from './imageImport'
import {useFunctionEnabled} from './functionFlags'
export type TextureState={base?:string;reference?:string;preparationId?:string;options?:Generation;supplement?:string;includeReference?:boolean}
export const textureDefaults:Generation={model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto' as Generation['ratio'],quality:'auto',count:4}
async function api(path:string,body?:unknown){const r=await fetch('/api/skills/texture-restore/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||data.message||'请求失败');return data}
export function TextureRestoreNode({inputs,state,onChange,onJob,job}:{inputs:SkillInput[];state:TextureState;onChange:(s:TextureState)=>void;onJob:(j:ImageJobState)=>void;job?:ImageJobState}){
 const enabled=useFunctionEnabled()('texture-restore'),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const base=state.base||inputs.find(i=>i.role!=='style')?.src,reference=state.reference||inputs.find(i=>i.role==='style')?.src||inputs.find(i=>i.src!==base)?.src
 const latest=useRef({state,onChange,onJob,job});latest.current={state,onChange,onJob,job}
 useEffect(()=>{
  if(state.preparationId&&latest.current.job?.id!==state.preparationId)latest.current.onJob({id:state.preparationId,status:'restoring',message:'正在恢复重绘任务'})
 },[state.preparationId])
 const running=busy||!!job&&!['complete','paused','submit_error'].includes(job.status)
 async function upload(file:File|undefined,key:'base'|'reference'){if(!file)return;try{const image=await prepareUploadedImage(file);onChange({...state,[key]:image.src,preparationId:undefined})}catch(e){setError(String(e))}}
 async function prepare(){if(!base||!reference)return;setBusy(true);setError('');const id=crypto.randomUUID();onJob({id,status:'submitting',message:'正在提交重绘任务',createdAt:new Date().toISOString()});try{await api('prepare',{requestId:id,base,reference,automatic:true,options:state.options||textureDefaults,supplement:state.supplement||'',includeReference:!!state.includeReference});onChange({...state,base,reference,preparationId:id});onJob({id,status:'running',message:'正在准备重绘图片…',createdAt:new Date().toISOString()})}catch(e){setError(String(e));onJob({id,status:'connection_lost',message:'提交状态未确认，请查询原任务；不会自动重新提交'});onChange({...state,base,reference,preparationId:id})}finally{setBusy(false)}}
 return <div className="skill-body compact-skill texture-restore-node nodrag nopan nowheel">
  {(['base','reference'] as const).map((key,index)=><label className="tone-image-field" key={key}>{index?'风格参考图':'构图原图'}<span className="tone-image-select">{(index?reference:base)?<img src={index?reference:base} alt={index?'风格参考图':'构图原图'}/>:<ImagePlus size={18}/>}<span className="tone-image-name">{(index?reference:base)?'点击替换':'上传或连接图片'}</span><input type="file" accept="image/png,image/jpeg" disabled={running} onChange={e=>{void upload(e.target.files?.[0],key);e.target.value=''}}/></span></label>)}
  <label>补充说明<textarea value={state.supplement||''} maxLength={5000} onChange={e=>onChange({...state,supplement:e.target.value})} placeholder="可选：补充材质、色彩或光影要求"/></label>
  <label className="texture-check"><input type="checkbox" checked={!!state.includeReference} onChange={e=>onChange({...state,includeReference:e.target.checked})}/>同时将风格参考图用于重绘</label>
  <GenerationControls mode="redraw" placement="node" value={state.options||textureDefaults} onChange={options=>onChange({...state,options})}/>
  <button className="primary skill-run" disabled={!enabled||running||!base||!reference} onClick={()=>void prepare()}><Play size={14}/>{running?'重绘处理中…':'开始重绘'}</button>
  {job&&<p role="status">{job.message}</p>}
  {error&&<TaskNotice message={error}/>}
 </div>
}
