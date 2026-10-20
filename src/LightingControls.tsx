import {useId,useState} from 'react'
import {GripVertical,Plus} from 'lucide-react'
import type {ReactNode} from 'react'
import './LightingControls.css'
type LightingValues = {
 sunlight?: boolean; temperature?: number; intensity?: number; hardness?: number;
 mode?: 'optimize' | 'reshape'; direction?: string; lamps?: string; weather?: string; time?: string; exterior?: string;
}
export type LightingSettings = LightingValues & { remembered?: LightingValues; moduleOrder?: (keyof LightingValues)[]; hiddenModules?: (keyof LightingValues)[] }
export function LightingControls({value,onChange,disabled=false}:{value:LightingSettings;onChange:(value:LightingSettings)=>void;disabled?:boolean}){
 const id=useId()
 const [dragged,setDragged]=useState<keyof LightingValues|null>(null)
 const labels:Record<keyof LightingValues,string>={sunlight:'阳光',temperature:'色温',intensity:'阳光强度',hardness:'阴影软硬',mode:'处理方式',direction:'入光方向',lamps:'室内灯光',weather:'天气',time:'时间',exterior:'外景'}
 const keys=Object.keys(labels) as (keyof LightingValues)[]
 const order=[...new Set([...(value.moduleOrder||[]),...keys])].filter(key=>keys.includes(key))
 const visible=order.filter(key=>!value.hiddenModules?.includes(key))
 const move=(from:keyof LightingValues,to:keyof LightingValues)=>{const targetIndex=order.indexOf(to);const next=order.filter(key=>key!==from);next.splice(targetIndex,0,from);onChange({...value,moduleOrder:next})}
 const remove=(key:keyof LightingValues)=>onChange({...value,[key]:undefined,remembered:{...value.remembered,[key]:value[key]??value.remembered?.[key]},hiddenModules:[...(value.hiddenModules||[]),key]})
 const update=(patch:Partial<LightingSettings>)=>onChange({...value,...patch})
 const defaults:Required<LightingValues>={sunlight:true,temperature:0,intensity:50,hardness:50,mode:'optimize',direction:'auto',lamps:'keep',weather:'keep',time:'keep',exterior:'keep'}
 const toggle=(key:keyof LightingValues)=>{
  if(value[key]!==undefined)onChange({...value,remembered:{...value.remembered,[key]:value[key]},[key]:undefined})
  else update({[key]:value.remembered?.[key]??defaults[key]})
 }
 const row=(key:keyof LightingValues,label:string,content:ReactNode,blocked=false)=><div key={key} onDragOver={e=>{if(dragged&&!disabled)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(dragged&&!disabled)move(dragged,key);setDragged(null)}} className={`lighting-module${value[key]===undefined?' inherited':''}${blocked?' blocked':''}`}>
  <button type="button" className="lighting-grip" draggable={!disabled} aria-label={`排序${label}`} title="拖动排序，或使用上下方向键" onDragStart={e=>{setDragged(key);e.dataTransfer.setData('text/plain',key);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onKeyDown={e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const target=visible[visible.indexOf(key)+(e.key==='ArrowUp'?-1:1)];if(target)move(key,target)}}><GripVertical size={12}/></button>
  <span className="lighting-module-label">{label}</span><div className="lighting-module-content">{content}</div>
  <button type="button" className="lighting-switch" role="switch" aria-label={`启用${label}`} aria-checked={value[key]!==undefined} disabled={disabled||blocked} title={value[key]===undefined?'沿用底图，点击启用调整':'停用调整，沿用底图'} onClick={()=>toggle(key)}><span/></button>
  <button type="button" className="lighting-remove" aria-label={`移除${label}模块`} onClick={()=>remove(key)}>移除</button>
 </div>
 const capsules=(key:'sunlight'|'mode'|'direction'|'lamps'|'weather'|'time'|'exterior',options:readonly (readonly [boolean|string,string])[])=> <div className="lighting-capsules" role="group" aria-label={key==='sunlight'?'阳光状态':labels[key]}>{options.map(([option,label])=><button key={String(option)} type="button" aria-pressed={value[key]===option} onClick={()=>update({[key]:option})}>{label}</button>)}</div>
 const slider=(key:'temperature'|'intensity'|'hardness',label:string,left:string,right:string)=>{
  const blocked=key!=='temperature'&&value.sunlight===false,current=value[key],shown=current??value.remembered?.[key]??defaults[key]
  const description=blocked?'无直射光':current===undefined?'沿用底图':key==='temperature'?(current===0?'中性':`${current<0?'偏冷':'偏暖'} ${Math.abs(current)}`):`${current}%`
  return row(key,label,<div className={`lighting-slider ${key}`}><div><span>{left}</span><output>{description}</output><span>{right}</span></div><input id={`${id}-${key}`} aria-label={label} type="range" min={key==='temperature'?-100:0} max={100} step={1} value={shown} disabled={disabled||blocked} aria-valuetext={description} onChange={e=>update({[key]:Number(e.target.value)})}/></div>,blocked)
 }
 return <fieldset className="lighting-controls nodrag nopan" disabled={disabled} aria-label="自然光设置">
  <div className="lighting-heading"><span>光影模块</span><button type="button" onClick={()=>onChange({})}>恢复底图</button></div>
  <div className="lighting-module-list">{visible.map(key=>{
   if(key==='temperature')return slider(key,'色温','冷','暖')
   if(key==='intensity')return slider(key,'阳光强度','弱','强')
   if(key==='hardness')return slider(key,'阴影软硬','柔','硬')
   const options=key==='weather'?[['keep','沿用'],['sunny','晴天'],['overcast','阴天'],['rainy','雨天']] as const:key==='time'?[['keep','沿用'],['morning','清晨'],['noon','正午'],['afternoon','午后'],['night','夜晚']] as const:key==='exterior'?[['keep','沿用'],['residential','小区'],['city','城市'],['forest','森林'],['ocean','海洋']] as const:key==='sunlight'?[[true,'开启'],[false,'关闭']] as const:key==='mode'?[['optimize','优化'],['reshape','重塑']] as const:key==='lamps'?[['keep','沿用'],['on','开启'],['off','关闭']] as const:[['auto','自动'],['left','左'],['right','右'],['front','前'],['back','后']] as const
   return row(key,labels[key],capsules(key,options))
  })}</div>
  {!!value.hiddenModules?.length&&<div className="lighting-add"><Plus size={12}/><select aria-label="添加光影模块" value="" onChange={e=>update({hiddenModules:value.hiddenModules?.filter(key=>key!==e.target.value)})}><option value="">添加模块</option>{order.filter(key=>value.hiddenModules?.includes(key)).map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></div>}
  <p>未启用项沿用底图 · 补充说明优先</p>
 </fieldset>
}
