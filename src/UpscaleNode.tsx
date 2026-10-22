import {useFunctionEnabled} from './functionFlags'
import {useEffect,useRef,useState} from 'react'
import {Play,RefreshCw} from 'lucide-react'
import {CanvasSelect} from './CanvasSelect'
import type {ImageJobState} from './ImageJob'
import type {SkillInput} from './SkillNode'
import {TaskNotice} from './TaskNotice'
import './UpscaleNode.css'

type Parameter={name:string;display_name?:string;input_type:string;default?:unknown;min?:number;max?:number;step?:number;options?:(string|number|boolean|{value:string|number|boolean;label?:string})[];help_text?:string}
type Workflow={id:string;name:string;description?:string;version:number;is_default?:boolean;editable_params:{node_id:string;params:Parameter[]}[]}
export type UpscaleState={baseId?:string;workflowId?:string;workflowVersion?:number;paramValues?:Record<string,Record<string,unknown>>}
async function api(url:string,body?:object){const response=await fetch(url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'图像放大请求失败'),{rejected:true});return result}
export function UpscaleNode({inputs,state,job,onChange,onJob}:{inputs:SkillInput[];state:UpscaleState;job?:ImageJobState;onChange:(state:UpscaleState)=>void;onJob:(job:ImageJobState)=>void}){
 const [catalog,setCatalog]=useState<{items:Workflow[];credits?:number}>({items:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[submitting,setSubmitting]=useState(false)
 const enabled=useFunctionEnabled()('platform-upscale')
 const guard=useRef(false)
 const locked=!enabled||submitting||!!job&&!['complete','paused','submit_error'].includes(job.status)
 const base=inputs.find(input=>input.id===state.baseId)||inputs[0]
 const workflow=catalog.items.find(item=>item.id===state.workflowId)||catalog.items.find(item=>item.is_default)||catalog.items[0]
 const values=state.workflowId===workflow?.id&&state.workflowVersion===workflow?.version?state.paramValues||{}:{}
 async function refresh(){setLoading(true);setError('');try{setCatalog(await api('/api/skills/upscale/workflows'))}catch(e){setError(e instanceof Error?e.message:'无法读取放大工作流')}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[])
 function defaults(item:Workflow){return Object.fromEntries(item.editable_params.map(group=>[group.node_id,Object.fromEntries(group.params.map(param=>[param.name,param.default]))]))}
 function choose(item:Workflow){onChange({...state,workflowId:item.id,workflowVersion:item.version,paramValues:defaults(item)})}
 function parameterInput(group:{node_id:string},param:Parameter){
  const current=values[group.node_id]?.[param.name]??param.default
  const change=(value:unknown)=>onChange({...state,workflowId:workflow!.id,workflowVersion:workflow!.version,paramValues:{...defaults(workflow!),...values,[group.node_id]:{...defaults(workflow!)[group.node_id],...values[group.node_id],[param.name]:value}}})
  if(param.input_type==='boolean')return <input aria-label={param.display_name||param.name} type="checkbox" disabled={locked} checked={current===true} onChange={e=>change(e.target.checked)}/>
  if(param.input_type==='select')return <CanvasSelect aria-label={param.display_name||param.name} disabled={locked} value={String(current??'')} onChange={e=>{const option=param.options?.find(option=>String(typeof option==='object'?option.value:option)===e.target.value);change(typeof option==='object'?option.value:option)}}>{param.options?.map(option=>{const value=typeof option==='object'?option.value:option;return <option key={String(value)} value={String(value)}>{typeof option==='object'?option.label||String(value):String(value)}</option>})}</CanvasSelect>
  return <input aria-label={param.display_name||param.name} disabled={locked} type={['int','float'].includes(param.input_type)?'number':'text'} min={param.min} max={param.max} step={param.step||1} value={String(current??'')} onChange={e=>change(['int','float'].includes(param.input_type)?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/>
 }
 async function run(){if(guard.current||locked||!base||!workflow)return;guard.current=true;setSubmitting(true);setError('');const requestId=crypto.randomUUID();onChange({...state,baseId:base.id,workflowId:workflow.id,workflowVersion:workflow.version,paramValues:values});onJob({requestId,status:'submitting',message:'正在提交图像放大…',createdAt:new Date().toISOString()});try{const result=await api('/api/skills/upscale/tasks',{requestId,base:base.src,workflowId:workflow.id,workflowVersion:workflow.version,paramValues:values});onJob({...result,id:result.id||requestId})}catch(e){const rejected=e instanceof Error&&'rejected' in e;onJob({...(!rejected?{requestId}:{}),status:rejected?'submit_error':'submission_unknown',message:e instanceof Error?e.message:'提交结果未确认，请核对平台任务；不会自动重试'})}finally{guard.current=false;setSubmitting(false)}}
 return <div className="skill-body upscale-node nodrag nopan" onWheelCapture={event=>event.stopPropagation()}>
  <label>底图<CanvasSelect aria-label="放大底图" value={base?.id||''} disabled={locked||!inputs.length} onChange={e=>onChange({...state,baseId:e.target.value})}>{!inputs.length&&<option value="">连接一张需要放大的图片</option>}{inputs.map(input=><option key={input.id} value={input.id}>{input.label}</option>)}</CanvasSelect></label>
  {base&&<img className="upscale-source" src={base.previewSrc||base.src} alt={base.label}/>}
  <label>放大工作流<CanvasSelect aria-label="放大工作流" value={workflow?.id||''} disabled={locked||loading||!catalog.items.length} onChange={e=>choose(catalog.items.find(item=>item.id===e.target.value)!)}>{!catalog.items.length&&<option value="">{loading?'正在读取…':'暂无可用工作流'}</option>}{catalog.items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</CanvasSelect></label>
  {workflow?.description&&<p className="upscale-hint">{workflow.description}</p>}
  {workflow?.editable_params.flatMap(group=>group.params.map(param=><label key={`${group.node_id}.${param.name}`}>{param.display_name||param.name}{parameterInput(group,param)}{param.help_text&&<small>{param.help_text}</small>}</label>))}
  <button className="skill-run primary" disabled={locked||loading||!base||!workflow} onClick={()=>void run()}><Play size={14}/>{locked?'任务处理中':'开始放大'}</button>
  <button className="upscale-refresh" disabled={locked||loading} onClick={()=>void refresh()}><RefreshCw size={12}/>刷新工作流</button>
  {error&&<TaskNotice status="paused" message={error}/>}
 </div>
}
