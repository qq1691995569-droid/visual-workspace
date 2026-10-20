import {useEffect,useState} from 'react'
import {Plus,Search,X,MoreHorizontal,Image as ImageIcon,ArrowLeft,FolderOpen,Trash2} from 'lucide-react'
import {canvasProjects} from './canvasStorage'
import type {ProjectSummary} from './projectCatalog'
import './ProjectManager.css'
export function ProjectManager({onClose,onCreate,onImport,onOpen,onBackup,onDelete}:{onClose:()=>void;onCreate:()=>Promise<void>;onImport:()=>void;onOpen:(id:string)=>Promise<void>;onBackup:()=>void;onDelete:(id:string)=>Promise<void>}){
 const [projects,setProjects]=useState<ProjectSummary[]>([]),[active,setActive]=useState(''),[query,setQuery]=useState(''),[sort,setSort]=useState('updated'),[trash,setTrash]=useState(false),[menu,setMenu]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[renaming,setRenaming]=useState<ProjectSummary|null>(null),[title,setTitle]=useState('')
 async function refresh(){const [items,id]=await Promise.all([canvasProjects.list(),canvasProjects.active()]);setProjects(items);setActive(id)}
 useEffect(()=>{void Promise.all([canvasProjects.list(),canvasProjects.active()]).then(([items,id])=>{setProjects(items);setActive(id)}).catch(e=>setError(String(e)));const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose])
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();await refresh();setMenu(null)}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试')}finally{setBusy(false)}}
 const visible=projects.filter(p=>!!p.deletedAt===trash&&p.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):b.updatedAt-a.updatedAt)
 const total=projects.filter(p=>!p.deletedAt)
 return <div className="project-manager" role="dialog" aria-modal="true" aria-label="画布项目管理" onKeyDown={e=>e.stopPropagation()} onCopy={e=>e.stopPropagation()} onPaste={e=>e.stopPropagation()}>
  <div className="project-manager-shell">
   <nav><span className="pm-brand"><FolderOpen size={19}/> VISUAL WORKSPACE</span><button onClick={onClose}><ArrowLeft size={16}/>返回画布</button></nav>
   <section className="pm-hero"><div><span className="pm-eyebrow">YOUR CREATIVE SPACE</span><h1>画布项目</h1><p>让每一次创作，都有自己的空间。</p><div className="pm-stats">{total.length} 个项目<span>·</span>{total.reduce((sum,p)=>sum+p.count,0)} 张图片<span>·</span>保存在当前浏览器</div></div><button className="pm-primary" disabled={busy} onClick={()=>void run(onCreate)}><Plus size={19}/>新建画布</button></section>
   <section className="pm-library">
    <div className="pm-library-heading"><div><h2>{trash?'回收站':'我的项目'}</h2><p>{trash?'删除的项目保留在这里，可随时恢复。':'从上次停下的地方，继续创作。'}</p></div><button onClick={()=>{setTrash(!trash);setMenu(null)}}><Trash2 size={15}/>{trash?'返回项目':'回收站'}</button></div>
    <div className="pm-tools"><label><Search size={17}/><input aria-label="搜索项目" placeholder="搜索项目名称" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="项目排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">最近更新</option><option value="name">项目名称</option></select><button disabled={busy} onClick={onImport}><FolderOpen size={15}/>导入项目</button></div>
    {error&&<div className="pm-error" role="alert">{error}</div>}
    <div className="pm-grid">
     {!trash&&!query&&<button className="pm-create-tile" disabled={busy} onClick={()=>void run(onCreate)}><span><Plus size={28}/></span><strong>开启新的画布</strong><small>自由构思，从这里开始</small></button>}
     {visible.map(p=><article className="pm-card" key={p.id}>
      <button className="pm-cover" disabled={busy||trash} onClick={()=>void run(()=>onOpen(p.id))} aria-label={`打开画布 ${p.name}`}>{p.cover?<img src={p.cover} alt="" loading="lazy"/>:<span><ImageIcon size={32}/><small>空白画布</small></span>}{p.id===active&&<b>当前画布</b>}</button>
      <div className="pm-card-body"><div className="pm-card-title"><button disabled={busy||trash} onClick={()=>void run(()=>onOpen(p.id))}>{p.name}</button><button aria-label={`${p.name}的更多操作`} onClick={()=>setMenu(menu===p.id?null:p.id)}><MoreHorizontal size={19}/></button></div><div className="pm-card-meta"><span>{p.count} 张图片</span><time>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</time></div>
       {menu===p.id&&<div className="pm-card-menu">{trash?<button disabled={busy} onClick={()=>void run(()=>canvasProjects.trash(p.id,false))}>恢复项目</button>:<><button onClick={()=>{setRenaming(p);setTitle(p.name);setMenu(null)}}>重命名</button><button disabled={busy} onClick={()=>void run(()=>canvasProjects.duplicate(p.id))}>复制项目</button><button className="pm-danger" disabled={busy} onClick={()=>void run(()=>onDelete(p.id))}>移入回收站</button></>}</div>}
      </div>
     </article>)}
    </div>
    {!visible.length&&(trash||query)&&<div className="pm-empty">{query?'没有找到匹配的项目':'回收站是空的'}</div>}
   </section><footer>项目与图片存储在当前浏览器，建议定期导出备份。<button onClick={onBackup}>下载旧版画布备份</button></footer>
  </div>
  {renaming&&<div className="pm-rename"><form onSubmit={e=>{e.preventDefault();void run(async()=>{await canvasProjects.rename(renaming.id,title);setRenaming(null);if(renaming.id===active)await onOpen(active)})}}><div><h2>重命名画布</h2><button type="button" aria-label="关闭重命名" onClick={()=>setRenaming(null)}><X size={18}/></button></div><input autoFocus aria-label="新的项目名称" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/><button className="pm-primary" disabled={busy||!title.trim()}>保存名称</button></form></div>}
 </div>
}
