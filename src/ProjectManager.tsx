import { CanvasSelect } from './CanvasSelect'
import {useEffect,useRef,useState} from 'react'
import {Plus,Search,SquarePen,ListChecks,RotateCcw,Image as ImageIcon,ArrowLeft,FolderOpen,Trash2} from 'lucide-react'
import {canvasProjects} from './canvasStorage'
import type {ProjectSummary} from './projectCatalog'
import './ProjectManager.css'
export function ProjectManager({onClose,onCreate,onImport,onOpen,onBackup,onDelete,onRename}:{onRename:(name:string)=>void;onClose:()=>void;onCreate:()=>Promise<void>;onImport:()=>void;onOpen:(id:string)=>Promise<void>;onBackup:()=>void;onDelete:(id:string)=>Promise<void>}){
 const [projects,setProjects]=useState<ProjectSummary[]>([]),[active,setActive]=useState(''),[query,setQuery]=useState(''),[sort,setSort]=useState('updated'),[trash,setTrash]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[renaming,setRenaming]=useState<ProjectSummary|null>(null),[title,setTitle]=useState('')
 const [batch,setBatch]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set())
 function toggleProject(id:string){setSelected(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next})}
 function exitBatch(){setBatch(false);setSelected(new Set())}
 const renameBusy=useRef(false),renameCancelled=useRef(false)
 function beginRename(p:ProjectSummary){renameCancelled.current=false;setRenaming(p);setTitle(p.name)}
 async function saveRename(){
  if(!renaming||renameBusy.current||renameCancelled.current)return
  const name=title.trim();if(!name){setTitle(renaming.name);setRenaming(null);return}
  if(name===renaming.name){setRenaming(null);return}
  renameBusy.current=true;setBusy(true);setError('')
  try{await canvasProjects.rename(renaming.id,name);if(renaming.id===active)onRename(name);await refresh();setRenaming(null)}catch(e){setError(e instanceof Error?e.message:'名称保存失败，请重试')}finally{renameBusy.current=false;setBusy(false)}
 }
 async function refresh(){const [items,id]=await Promise.all([canvasProjects.list(),canvasProjects.active()]);setProjects(items);setActive(id)}
 useEffect(()=>{void Promise.all([canvasProjects.list(),canvasProjects.active()]).then(([items,id])=>{setProjects(items);setActive(id)}).catch(e=>setError(String(e)));const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose])
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试')}finally{setBusy(false)}}
 const visible=projects.filter(p=>!!p.deletedAt===trash&&p.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):b.updatedAt-a.updatedAt)
 const selectedVisible=visible.filter(p=>selected.has(p.id))
 async function deleteBatchPermanently(){
  if(busy||!trash||!selectedVisible.length)return
  const ids=selectedVisible.map(p=>p.id)
  if(!window.confirm(`彻底删除选中的 ${ids.length} 个项目？删除后无法恢复。`))return
  await run(async()=>{await canvasProjects.purge(ids);exitBatch()})
 }
 async function applyBatch(){await run(async()=>{
  // The active project reloads the canvas when trashed, so process it last.
  for(const p of [...selectedVisible].sort((a,b)=>Number(a.id===active)-Number(b.id===active))){
   if(trash)await canvasProjects.trash(p.id,false);else await onDelete(p.id)
   setSelected(previous=>{const next=new Set(previous);next.delete(p.id);return next})
  }
  exitBatch()
 })}
 const total=projects.filter(p=>!p.deletedAt)
 return <div className="project-manager" role="dialog" aria-modal="true" aria-label="画布项目管理" onKeyDown={e=>e.stopPropagation()} onCopy={e=>e.stopPropagation()} onPaste={e=>e.stopPropagation()}>
  <div className="project-manager-shell">
   <nav><span className="pm-brand"><FolderOpen size={19}/> VISUAL WORKSPACE</span><button onClick={onClose}><ArrowLeft size={16}/>返回画布</button></nav>
   <section className="pm-hero"><div><h1>画布项目</h1><div className="pm-stats"><span>{total.length} 个项目</span><span>·</span><span>{total.reduce((sum,p)=>sum+p.count,0)} 张图片</span></div></div><button className="pm-primary" disabled={busy} onClick={()=>void run(onCreate)}><Plus size={19}/>新建画布</button></section>
   <section className="pm-library">
    <div className="pm-library-heading"><div><h2>{trash?'回收站':'我的项目'}</h2>{trash&&<p>删除的项目保留在这里，可随时恢复。</p>}</div></div>
    <div className="pm-tools"><label><Search size={17}/><input aria-label="搜索项目" placeholder="搜索项目名称" value={query} onChange={e=>{setQuery(e.target.value);setSelected(new Set())}}/></label><CanvasSelect aria-label="项目排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">最近更新</option><option value="name">项目名称</option></CanvasSelect><button disabled={busy} onClick={onImport}><FolderOpen size={15}/>导入项目</button><button disabled={busy} aria-pressed={batch} onClick={()=>{if(batch)exitBatch();else{setBatch(true);setRenaming(null)}}}><ListChecks size={16}/>{batch?'完成选择':'批量操作'}</button><button disabled={busy} onClick={()=>{setTrash(!trash);exitBatch()}}><Trash2 size={15}/>{trash?'返回项目':'回收站'}</button></div>
    {batch&&<div className="pm-batch-bar" role="toolbar" aria-label="批量项目操作"><label><input type="checkbox" aria-label="全选当前项目" disabled={busy||!visible.length} checked={visible.length>0&&selectedVisible.length===visible.length} ref={el=>{if(el)el.indeterminate=selectedVisible.length>0&&selectedVisible.length<visible.length}} onChange={e=>setSelected(new Set(e.target.checked?visible.map(p=>p.id):[]))}/>全选</label><span aria-live="polite">已选 {selectedVisible.length} 项</span><button disabled={busy||!selectedVisible.length} onClick={()=>void applyBatch()}>{trash?<RotateCcw size={15}/>:<Trash2 size={15}/>}{trash?'恢复所选':'移入回收站'}</button>{trash&&<button disabled={busy||!selectedVisible.length} onClick={()=>void deleteBatchPermanently()}><Trash2 size={15}/>彻底删除</button>}<button disabled={busy} onClick={exitBatch}>取消</button></div>}
    {error&&<div className="pm-error" role="alert">{error}</div>}
    <div className="pm-grid">
     {!trash&&!query&&!batch&&<button className="pm-create-tile" disabled={busy} onClick={()=>void run(onCreate)}><span><Plus size={28}/></span><strong>开启新的画布</strong><small>自由构思，从这里开始</small></button>}
     {visible.map(p=><article className={`pm-card${p.id===active?' pm-card-current':''}${renaming?.id===p.id?' pm-card-editing':''}${batch&&selected.has(p.id)?' pm-card-picked':''}`} key={p.id}>
      {batch&&<label className="pm-project-check"><input type="checkbox" aria-label={`选择 ${p.name}`} checked={selected.has(p.id)} disabled={busy} onChange={()=>toggleProject(p.id)}/></label>}
      {!batch&&<button className="pm-cover-action" disabled={busy} aria-label={`${trash?'恢复':'删除'} ${p.name}`} title={trash?'恢复项目':'移入回收站'} onClick={()=>void run(()=>trash?canvasProjects.trash(p.id,false):onDelete(p.id))}>{trash?<RotateCcw size={15}/>:<Trash2 size={15}/>}</button>}
      <button className="pm-cover" disabled={busy||(!batch&&trash)} onClick={()=>batch?toggleProject(p.id):void run(()=>onOpen(p.id))} aria-label={`打开画布 ${p.name}`}>{p.cover?<img src={p.cover} alt="" loading="lazy"/>:<span><ImageIcon size={32}/><small>空白画布</small></span>}{p.id===active&&<span className="pm-current-badge">当前画布</span>}</button>
      <div className="pm-card-body"><div className="pm-card-title">
       {renaming?.id===p.id?<form className="pm-inline-rename" onSubmit={e=>{e.preventDefault();void saveRename()}}><input autoFocus aria-label="新的项目名称" maxLength={100} disabled={busy} value={title} onFocus={e=>e.target.select()} onChange={e=>setTitle(e.target.value)} onBlur={()=>void saveRename()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();renameCancelled.current=true;setRenaming(null)}}}/></form>:<><button className="pm-project-title" disabled={busy||(!batch&&trash)} onClick={()=>batch?toggleProject(p.id):void run(()=>onOpen(p.id))} title={p.name}>{p.name}</button>{!trash&&!batch&&<button className="pm-rename-trigger" disabled={busy} aria-label={`重命名 ${p.name}`} title="重命名画布" onClick={()=>beginRename(p)}><SquarePen size={16}/></button>}</>}
       </div><div className="pm-card-meta"><time>更新于 {new Date(p.updatedAt).toLocaleDateString('zh-CN')}</time><span>{p.count} 张图片</span></div>

      </div>
     </article>)}
    </div>
    {!visible.length&&(trash||query)&&<div className="pm-empty">{query?'没有找到匹配的项目':'回收站是空的'}</div>}
   </section><footer>项目与图片存储在当前浏览器，建议定期导出备份。<button onClick={onBackup}>下载旧版画布备份</button></footer>
  </div>

 </div>
}
