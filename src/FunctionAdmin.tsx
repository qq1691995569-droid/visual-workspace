import {TaskMonitor} from './TaskMonitor'
import {useState} from 'react'
import {BookOpen, Settings2, Workflow, PanelTop, Archive} from 'lucide-react'
import {CanvasSelect} from './CanvasSelect'
import {ThemeToggle} from './ThemeToggle'
import './VisualSystem.css'
import './FunctionAdmin.css'
type Feature={id:string;name:string;enabled:boolean;persona:string;text:string}
type Config={schema:1;revision:number;features:Feature[];switches?:Record<string,boolean>}
type Registry={builtinRules?:Record<string,string>;switchDefinitions?:{id:string;name:string}[];draft:Config;active:Config;versions:Config[];editRevision:number;audit:{at:string;revision:number;action:string}[]}
const directoryGroups = [
 {id:'connection',name:'连线技能',description:'从图片连线后选择',icon:Workflow,ids:['style','model','material','light']},
 {id:'toolbar',name:'图片工具栏',description:'选中图片后，上方显示',icon:PanelTop,ids:['edit','redraw','separate','background','erase','expand','upscale']},
]
const otherGroup={id:'other',name:'其他功能',description:'兼容保留的处理规则',icon:Archive,ids:[] as string[]}
const directoryLabels:Record<string,string>={light:'光影优化',redraw:'引用生成',separate:'多图层'}
export default function FunctionAdmin(){
 const [key,setKey]=useState(''),[data,setData]=useState<Registry>(),[draft,setDraft]=useState<Config>(),[selected,setSelected]=useState('style'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[rollback,setRollback]=useState('')
 const feature=draft?.features.find(f=>f.id===selected)
 const [section,setSection]=useState<'skills'|'system'|'tasks'>('skills')
 const system=section==='system'
 const groups=[...directoryGroups,otherGroup].map(group=>({...group,features:(draft?.features||[]).filter(f=>group===otherGroup?!directoryGroups.some(g=>g.ids.includes(f.id)):group.ids.includes(f.id))})).filter(group=>group.features.length)
 const selectedGroup=groups.find(group=>group.features.some(f=>f.id===selected))
 const switchItems=[...(draft?.features||[]),...(data?.switchDefinitions||[]).map(f=>({...f,enabled:true}))]
 function toggleFeature(id:string,enabled:boolean){setDraft(c=>c&&({...c,switches:{...c.switches,[id]:enabled},features:c.features.map(f=>f.id===id?{...f,enabled}:f)}));setDirty(true)}
 async function request(action='',body?:object){
  setBusy(true);setMessage('')
  try{const response=await fetch('/api/skills/config-admin'+action,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw Error(result.error||'操作失败');setData(previous=>({...previous,...result}));setDraft(result.draft);setDirty(false);setMessage(action==='/publish'?`V${result.active.revision} 已发布到 GitHub，新任务自动获取。`:action==='/draft'?'草稿已保存，尚未影响正式任务。':'已加载配置')}
  catch(e){setMessage(e instanceof Error?e.message:'请求失败')}finally{setBusy(false)}
 }
 function change(patch:Partial<Feature>){setDraft(current=>current&&({...current,features:current.features.map(f=>f.id===selected?{...f,...patch}:f)}));setDirty(true)}
 return <main className="function-admin"><div role="banner" className="admin-page-header ui-panel-header"><div><h1>画布功能管理</h1><p>人设与 Skill · 草稿编辑 · 版本发布</p></div><ThemeToggle/></div>
 {!data?<section className="ui-panel-card admin-login"><h2>本机管理验证</h2><p>管理口令保存在本机 .canvas-data/config-admin-key.txt。口令仅用于此后台，不是 DREO 或生图密钥。</p><form onSubmit={e=>{e.preventDefault();void request()}}><input aria-label="管理口令" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/><button disabled={busy||!key}>进入后台</button></form></section>:
 <><nav className="admin-sections ui-panel-tabs" aria-label="后台栏目"><button type="button" aria-pressed={section==='skills'} className={section==='skills'?'selected':''} onClick={()=>setSection('skills')}><BookOpen size={18}/><span>人设与 Skill<small>编辑每个功能的角色与处理规则</small></span></button><button type="button" aria-pressed={system} className={system?'selected':''} onClick={()=>setSection('system')}><Settings2 size={18}/><span>系统配置<small>统一管理画板功能的显示与启停</small></span></button><button type="button" aria-pressed={section==='tasks'} className={section==='tasks'?'selected':''} onClick={()=>setSection('tasks')}><Workflow size={18}/><span>任务监控<small>查看提交阶段与失败原因</small></span></button><span className="admin-section-status">{dirty?'有未保存的修改':`当前发布 V${data.active.revision}`}</span></nav>{section==='tasks'?<TaskMonitor adminKey={key}/>:<div className={`admin-layout${system?' admin-system-layout':''}`}>{!system&&<nav className="ui-panel-card admin-navigation" aria-label="功能列表"><div className="admin-nav-heading">功能目录<span>{draft?.features.length} 项</span></div>{groups.map(group=><section className="admin-directory-group" key={group.id} aria-label={group.name}><div className="admin-directory-heading"><group.icon size={15}/><h3>{group.name}</h3><span>{group.features.length}</span></div><p>{group.description}</p><div className="admin-directory-items">{group.features.map(f=><button type="button" aria-current={selected===f.id?'page':undefined} className={selected===f.id?'selected':''} key={f.id} onClick={()=>setSelected(f.id)}>{directoryLabels[f.id]||f.name}<small>{f.enabled&&draft?.switches?.[f.id]!==false?'已启用':'已停用'}</small></button>)}</div></section>)}</nav>}
 <section className="ui-panel-card admin-editor">{(feature||system)&&<>{system?<><div className="admin-editor-heading"><h2>系统配置 · 功能开关</h2><span>正式 V{data.active.revision}</span></div><p>关闭并发布后，同事画板隐藏入口并停止接受新任务。已有图片和任务记录保留。</p><div className="admin-switch-list">{switchItems.map(f=>{const enabled=f.enabled&&draft?.switches?.[f.id]!==false;return <div className="admin-switch-row" key={f.id}><div><strong>{f.name}</strong><small>{enabled?'对用户显示 · 允许使用':'隐藏入口 · 禁止新任务'}</small></div><button type="button" role="switch" aria-label={f.name+'功能开关'} aria-checked={enabled} className="admin-feature-switch" disabled={busy} onClick={()=>toggleFeature(f.id,!enabled)}><span/></button></div>})}</div><p>开关对包括你在内的标准画板生效。离线用户在重新联网同步后更新；自行修改源码的副本无法强制限制。</p></>:feature&&<><div className="admin-editor-heading"><div><div className="admin-entry-location">{selectedGroup?.name} · {selectedGroup?.description}</div><h2>{directoryLabels[feature.id]||feature.name}</h2></div><span>正式 V{data.active.revision}{dirty?' · 未保存':''}</span></div>
 <p className="admin-editor-note">配置发布后会同步给同事，请勿填写密钥。</p>
 
 <p className="admin-check">功能显示与启停请切换顶部「系统配置」。</p>
 <label className="admin-field"><span>AI 人设<small>定义角色与处理偏好</small></span><textarea rows={3} value={feature.persona} disabled={busy} placeholder="留空时沿用原有身份设定" onChange={e=>change({persona:e.target.value})}/></label>
 {data.builtinRules?.[selected]&&<label className="admin-field"><span>内置 Skill · 当前执行规则<small>由程序维护，下方可追加补充规则</small></span><textarea className="admin-rules" readOnly value={data.builtinRules[selected]} aria-label="内置执行规则"/></label>}
 <label className="admin-field"><span>{data.builtinRules?.[selected]?'补充规则（可选）':'Skill / 处理规则'}<small>{data.builtinRules?.[selected]?'留空仍执行上方内置规则':'保留文件头，仅修改正文规则'}</small></span><textarea className="admin-rules" spellCheck={false} value={feature.text} disabled={busy} placeholder="填写此功能的补充规则" onChange={e=>change({text:e.target.value})}/></label>
 </>}<div className="admin-publishing"><h3>保存与发布</h3><footer className="ui-panel-footer"><button disabled={busy||!dirty} onClick={()=>void request('/draft',{expected:data.editRevision,config:draft})}>保存草稿</button><button className="admin-publish-button" disabled={busy||dirty} onClick={()=>void request('/publish',{expected:data.editRevision})}>发布到 GitHub</button><button disabled={busy||dirty} onClick={()=>void request()}>刷新版本</button></footer>
 <p>先保存草稿，再发布新版本。新版画板约每分钟检查更新，断网沿用已缓存配置。</p><details className="admin-version-tools"><summary>历史版本与回退</summary>
 <div className="admin-rollback"><CanvasSelect aria-label="历史版本" value={rollback} onChange={e=>setRollback(e.target.value)}><option value="">选择历史版本</option>{data.versions.map(v=><option key={v.revision} value={v.revision}>V{v.revision}</option>)}</CanvasSelect><button disabled={busy||dirty||rollback===''} onClick={()=>void request('/publish',{expected:data.editRevision,rollback:Number(rollback)})}>以此版本重新发布</button></div>
 </details><details className="admin-version-tools"><summary>发布记录</summary>{data.audit.slice().reverse().map(a=><p key={a.revision}>V{a.revision} · {a.action==='rollback'?'回退发布':'发布'} · {new Date(a.at).toLocaleString()}</p>)}</details></div>
 </>}</section></div>}</>}
 <p role="status" className={`admin-message${system?' admin-message-wide':''}`}>{busy?'正在处理，请勿重复提交…':message}</p></main>
}
