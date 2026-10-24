import {useEffect,useState} from 'react'
import {Cable,RefreshCw} from 'lucide-react'
import {CanvasSelect} from './CanvasSelect'

type Connection={id:string;name:string;configured:boolean}
type FeatureRoute={id:string;name:string;description:string;compatible:string[];provider:string;editable:boolean;explicit:boolean}
type Routing={connections:Connection[];features:FeatureRoute[]}

export function ApiRoutingAdmin({adminKey}:{adminKey:string}){
 const [routing,setRouting]=useState<Routing>()
 const [choices,setChoices]=useState<Record<string,string>>({})
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 async function request(feature?:string,provider?:string){
  setBusy(true);setMessage('')
  try{
   const response=await fetch('/api/skills/config-admin/api-routing',{method:feature?'POST':'GET',headers:{Authorization:`Bearer ${adminKey}`,'Content-Type':'application/json'},...(feature?{body:JSON.stringify({feature,provider})}:{})})
   const result=await response.json()
   if(!response.ok)throw Error(result.error||'API 配置读取失败')
   setRouting(result)
   setChoices(Object.fromEntries(result.features.map((route:FeatureRoute)=>[route.id,route.provider])))
   setMessage(feature?'已保存接口分配，仅影响之后新建的任务。':'')
  }catch(error){setMessage(error instanceof Error?error.message:'API 配置读取失败')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void request()},[adminKey])
 const connections=Object.fromEntries((routing?.connections||[]).map(connection=>[connection.id,connection]))
 return <section className="ui-panel-card admin-editor admin-api-panel" aria-label="API 管理">
  <div className="admin-editor-heading"><div><div className="admin-entry-location">接口连接 · 功能分配</div><h2>API 管理</h2></div><Cable size={22} aria-hidden="true"/></div>
  <p>每个功能单独选择兼容的接口。新的功能接入后会加入下方列表，不需要再建一个后台栏目。</p>
  {routing&&<>
   <div className="admin-api-section-heading"><h3>已接入的接口</h3><button type="button" disabled={busy} onClick={()=>void request()}><RefreshCw size={14}/>刷新状态</button></div>
   <div className="admin-api-connections">{routing.connections.map(connection=><div key={connection.id}><strong>{connection.name}</strong><span data-ready={connection.configured}>{connection.configured?'本机凭据已配置':'尚未配置'}</span></div>)}</div>
   <div className="admin-api-section-heading"><h3>按功能分配</h3><span>切换仅影响新任务</span></div>
   <div className="admin-api-routes">{routing.features.map(route=>{
    const choice=choices[route.id]||route.provider,connection=connections[choice]
    return <div className="admin-api-route" key={route.id}>
     <div className="admin-api-route-title"><strong>{route.name}</strong><small>{route.description}</small></div>
     {route.editable?<div className="admin-api-route-control"><CanvasSelect aria-label={`${route.name}使用的接口`} value={choice} disabled={busy} onChange={event=>setChoices(current=>({...current,[route.id]:event.target.value}))}>{route.compatible.map(id=><option key={id} value={id} disabled={!connections[id]?.configured}>{connections[id]?.name||id}</option>)}</CanvasSelect><button className="admin-publish-button" type="button" disabled={busy||choice===route.provider||!connection?.configured} onClick={()=>void request(route.id,choice)}>保存</button></div>:<span className="admin-api-fixed">{connection?.name||choice} · 固定</span>}
     {route.id==='separate'&&choice==='dreo'&&<p className="admin-api-route-note">DREO 原生拆层能力尚待服务端确认；凭据已配置不代表拆层参数已获支持。</p>}
    </div>
   })}</div>
  </>}
  <p className="admin-api-footnote">后台不会显示或发布密钥。不同服务的请求格式需要先接入对应适配器，完成后即可在此为兼容功能分配；同事在各自服务器上单独配置凭据。</p>
  <p role="status" className="admin-api-message">{busy?'正在读取接口配置…':message}</p>
 </section>
}
