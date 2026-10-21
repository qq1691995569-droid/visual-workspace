import { CanvasSelect } from './CanvasSelect'
import {usePersonViews} from './personPresentation'
import {AssetCategoryHome} from './AssetCategoryHome'
import {AssetCardContent} from './AssetCardContent'
import {AssetDetail} from './AssetDetail'
import {assetCategory,materialCategories} from './assetCategory'
import {MultiMaterialEditor} from './MultiMaterialEditor'
import {AssetExtraction} from './AssetExtraction'
import {PersonExtraction} from './PersonExtraction'
import {ObjectSelection,type SelectionStroke} from './ObjectSelection'
import { useEffect, useRef, useState } from 'react'
import { Archive, Box, Check, Maximize2, Minimize2, Minus, Download, LoaderCircle, Palette, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { defaultGeneration, modelOptions, type Generation } from './generation'
import './AssetLibrary.css'

export type AssetKind = 'material' | 'model' | 'person'
export type VisualAsset = { materialCategory?:string; sourceImage?:string; previewType?:'furniture'|'space'; reviewStatus?:'pending'|'confirmed'; sourceObject?:string; objectDescription?:string; views?: {label:string;image:string}[]; generatedViews?: boolean; id?: string; kind: AssetKind; name: string; image: string; prompt: string; tags: string[]; notes: string; confidence?: string; source?: string; createdAt?: string }
export type MaterialRegion={useImageReference?:boolean;id?:string;target:string;points:number[][];strokes?:SelectionStroke[];mark?:number[];selectionReviewed?:boolean;asset:VisualAsset}
export type LocalEditRecipe = { useImageReference?:boolean; deferredSelection?:boolean; regions?:MaterialRegion[]; kind: AssetKind; target: string; points: number[][]; strokes?: SelectionStroke[]; mark?: number[]; selectionReviewed?: boolean; asset: VisualAsset; supplement: string }
type Source = { id: string; image: string; label: string }
export type AssetSession = { mode: 'browse' | 'extract' | 'edit' | 'save'; asset?:VisualAsset; saveNodeId?:string; kind: AssetKind; source?: Source; nodeId?: string; recipe?: LocalEditRecipe; options?: Generation }
async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body ? { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : undefined)
  const result = await response.json()
  if (!response.ok) throw Error(result.error || '资产操作失败')
  return result
}
const emptyAsset = (kind: AssetKind, image=''): VisualAsset => ({kind,image,name:'',prompt:'',tags:[],notes:'',confidence:'unknown'})
export function AssetLibrary({ session, onClose, onEdit, onAdd, onExtract, onSaved }: { session: AssetSession; onClose:()=>void; onEdit:(sourceId:string,recipe:LocalEditRecipe,options:Generation)=>Promise<void>; onAdd:(asset:VisualAsset)=>void;onExtract:(sourceId:string,kind:'material'|'model'|'person',focus:string)=>void;onSaved?:(asset:VisualAsset)=>void }) {
  const [kind,setKind]=useState(session.kind), [assets,setAssets]=useState<VisualAsset[]>([]), [search,setSearch]=useState(''), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState('')
  const [points,setPoints]=useState<number[][]>(session.recipe?.points || []), [target,setTarget]=useState(session.recipe?.target || ''), [candidates,setCandidates]=useState<VisualAsset[]>([]), [draft,setDraft]=useState<VisualAsset|null>(session.asset||null), [chosen,setChosen]=useState<VisualAsset|null>(session.recipe?.asset || null)
  const [supplement,setSupplement]=useState(session.recipe?.supplement || ''), [options,setOptions]=useState<Generation>(session.options || {...defaultGeneration,model:'doubao-seedream-5-0-pro-260628',count:4})
  const [strokes,setStrokes]=useState<SelectionStroke[]>(session.recipe?.strokes || []),[mark,setMark]=useState<number[]|undefined>(session.recipe?.mark),[reviewed,setReviewed]=useState(session.recipe?.selectionReviewed ?? !!session.recipe?.points.length)
  const [detailView,setDetailView]=useState<{label:string;image:string}|null>(null)
  const [previewAsset,setPreviewAsset]=useState<VisualAsset|null>(null),[category,setCategory]=useState('全部')
  const [coverSize,setCoverSize]=useState(session.mode==='browse'?190:145),[expanded,setExpanded]=useState(false),[sort,setSort]=useState('recent')
  const [browseFilter,setBrowseFilter]=useState<AssetKind|'all'>('all')
  const fileInput=useRef<HTMLInputElement>(null), importInput=useRef<HTMLInputElement>(null)
  const source=session.source, mode=session.mode
  const personViews=usePersonViews(chosen)
  async function refresh() { const result=await api<{assets:VisualAsset[]}>('/api/skills/assets'); setAssets(result.assets); return result.assets }
  useEffect(()=>{
    let live=true,running=false,revision=''
    const controller=new AbortController()
    async function sync(){
      if(!live||running||document.hidden)return
      running=true
      try{
        const response=await fetch('/api/skills/assets/revision',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
        if(!response.ok)throw Error('资产库同步失败')
        const next=await response.json()
        if(next.revision!==revision){
          const list=await fetch('/api/skills/assets',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
          if(!list.ok)throw Error('资产库读取失败')
          const result=await list.json()
          if(live){setAssets(result.assets);revision=next.revision}
        }
      }catch(error){if(live)setError(error instanceof Error?error.message:'资产同步失败')}finally{running=false}
    }
    void sync()
    const timer=setInterval(()=>void sync(),3000)
    const wake=()=>void sync()
    window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake)
    return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)}
  },[])
  function changeKind(next:AssetKind) {setSearch('');setCategory('全部');setBrowseFilter(next);setPoints([]);setStrokes([]);setMark(undefined);setReviewed(false);setKind(next);setChosen(null);setDraft(null);setCandidates([]);setNotice('');setError('')}
  function changedSelection(next:number[][]) {setPoints(next);setCandidates([]);setDraft(null);setNotice('')}
  async function deleteAsset(asset:VisualAsset) {
    if(busy||!asset.id||!window.confirm(`删除「${asset.name}」？\n画布中已使用的图片和材质绑定会保留。`))return
    setBusy('delete');setError('')
    try {
      await api('/api/skills/assets/delete',{id:asset.id})
      setAssets(current=>current.filter(item=>item.id!==asset.id))
      if(chosen?.id===asset.id)setChosen(null)
      if(previewAsset?.id===asset.id)setPreviewAsset(null)
      setNotice(`「${asset.name}」已从资产库删除`)
    }catch(error){setError(error instanceof Error?error.message:'删除失败')}finally{setBusy('')}
  }
  async function save() {
    if(!draft)return
    setBusy('save');setError('')
    try {const result=await api<{asset:VisualAsset;duplicate:boolean}>('/api/skills/assets/save',{...draft,kind,reviewStatus:'confirmed'}); const updated=await refresh();if(!updated.some(a=>a.id===result.asset.id))throw Error('保存后未能在资产列表中找到，请刷新核对');setNotice(result.duplicate?'该资产已在库中，未重复新增':`「${result.asset.name}」已保存到${kind==='person'?'AI 人物':kind==='material'?'AI 材质':'AI 模型／对象'}库`);setChosen(result.asset);if(mode==='save'){onSaved?.(result.asset);onClose()}setDraft(null);setCandidates(current=>current.filter(c=>c.prompt!==draft.prompt))} catch(e){setError(e instanceof Error?e.message:'保存失败')} finally{setBusy('')}
  }
  async function generate() {
    if(!source||!chosen)return
    setBusy('generate');setError('')
    try {await onEdit(source.id,{kind,target:target.trim(),points,strokes,mark,selectionReviewed:reviewed,asset:chosen,supplement},options);onClose()}catch(e){setError(e instanceof Error?e.message:'提交失败')}finally{setBusy('')}
  }
  async function readImage(file?:File) {if(!file)return;setError('');try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('请选择 20MB 内的 PNG、JPG 或 WebP 图片');const image=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('图片读取失败'));r.readAsDataURL(file)});setDraft({...emptyAsset(kind,image),name:file.name.replace(/\.[^.]+$/,''),source:'手动导入'});setCandidates([])}catch(e){setError(e instanceof Error?e.message:'读取失败')}}
  async function importLibrary(file?:File) {
    if(!file)return;setBusy('import');setError('')
    let imported=0
    try {if(file.size>90*1024*1024)throw Error('备份文件超过 90MB');const raw=JSON.parse(await file.text()), list=Array.isArray(raw)?raw:raw.assets;if(!Array.isArray(list)||list.length>200)throw Error('需要包含 assets 数组的资产备份（最多 200 项）');for(const item of list){const candidate={...emptyAsset(item.kind==='model'||item.category==='object'?'model':'material'),...item,image:item.image||item.imageUrl,prompt:item.prompt||item.promptZh||item.promptEn,kind:item.kind|| (item.category==='material'?'material':item.category==='object'?'model':undefined),source:item.source||'资产备份导入'};await api('/api/skills/assets/save',candidate);imported++}setNotice(`已导入 ${imported} 项资产`)}catch(e){setError(`已处理 ${imported} 项；${e instanceof Error?e.message:'导入失败'}`)}finally{await refresh().catch(()=>{});setBusy('')}
  }
  function exportLibrary(){const blob=new Blob([JSON.stringify({format:'canvas-assets',version:1,assets})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='画布资产库.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  const categoryHome=mode==='browse'&&browseFilter==='all'
  const kindAssets=assets.filter(a=>mode==='browse'&&browseFilter==='all'||a.kind===kind)
  const categories=['全部',...new Set([...(browseFilter==='all'||kind==='material'?Object.values(materialCategories):[]),...kindAssets.map(assetCategory)])]
  const filtered=assets.filter(a=>(mode==='browse'&&browseFilter==='all'||a.kind===kind) && (category==='全部'||assetCategory(a)===category) && `${a.name} ${a.prompt} ${a.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):(b.createdAt||'').localeCompare(a.createdAt||''))
  return <div className={mode==='browse'?`asset-backdrop asset-browser ${expanded?'asset-browser-expanded':''}`:'asset-backdrop'} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&(!busy||mode==='extract')){if(detailView)setDetailView(null);else onClose()}}} onClick={()=>{if(!busy||mode==='extract')onClose()}}><section role={mode==='browse'?'region':'dialog'} aria-modal={mode==='browse'?undefined:true} aria-label="画布资产库" className={`asset-workspace ui-side-panel ${source?'with-source':''}`} onClick={e=>e.stopPropagation()}>
    <header className="asset-header ui-panel-header"><div><Archive size={19}/><span><strong>{mode==='save'?'保存到资产库':mode==='extract'?'从画面提取资产':mode==='edit'?'选择对象与资产':'资产管理'}</strong><small>{mode==='browse'?'保存可复用的材质与对象外观':source?.label}</small></span></div><>{mode==='browse'&&<button aria-label={expanded?'收起资产库':'展开资产库'} title={expanded?'收起资产库':'展开资产库'} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>}</><button autoFocus disabled={!!busy&&mode!=='extract'} aria-label="关闭资产库" onClick={onClose}><X size={18}/></button></header>
    {mode==='edit'&&(kind==='material'||kind==='model')&&source?<MultiMaterialEditor kind={kind} image={source.image} assets={assets} recipe={session.recipe} initialOptions={options} onClose={onClose} onGenerate={(recipe,options)=>onEdit(source.id,recipe,options)}/>:<div className="asset-workspace-body">{source && <div className="asset-source-column">{mode==='extract' ? kind==='person' ? <PersonExtraction image={source.image} onStart={focus=>onExtract(source.id,'person',focus)}/> : <AssetExtraction key={kind} image={source.image} kind={kind==='model'?'model':'material'} onStart={(kind,focus)=>onExtract(source.id,kind,focus)}/> : <><ObjectSelection image={source.image} kind={kind} points={points} strokes={strokes} mark={mark} onMark={setMark} onPoints={changedSelection} onStrokes={next=>{setStrokes(next);setCandidates([]);setDraft(null)}} target={target} onTarget={setTarget} reviewed={reviewed} onReview={setReviewed} busy={busy} onBusy={setBusy} onError={setError}/><label className="asset-field">对象／部位名称<input aria-label="资产目标对象" disabled={!!busy} value={target} maxLength={200} onChange={e=>setTarget(e.target.value)}/></label><small className="asset-service-note">选区仅用于局部修改，提取资产无需圈选。</small></>}</div>}
    <div className="asset-library-column">{mode!=='save'&&<div className="asset-kind-tabs ui-panel-tabs">{mode==='browse'&&<button className={browseFilter==='all'?'active':''} onClick={()=>{setCategory('全部');setBrowseFilter('all');setChosen(null);setDraft(null)}}>全部资产</button>}<button disabled={!!busy || mode==='edit' && kind!=='material'} className={kind==='material'&&(mode!=='browse'||browseFilter!=='all')?'active':''} onClick={()=>changeKind('material')}><Palette size={15}/>AI 材质</button><button disabled={!!busy || mode==='edit' && kind!=='model'} className={kind==='model'&&(mode!=='browse'||browseFilter!=='all')?'active':''} onClick={()=>changeKind('model')}><Box size={15}/>AI 模型／对象</button>{mode!=='edit'&&<button disabled={!!busy} className={kind==='person'&&(mode!=='browse'||browseFilter!=='all')?'active':''} onClick={()=>changeKind('person')}><Box size={15}/>AI 人物</button>}</div>}
      {!draft&&!(mode==='browse'&&chosen)&&<><div className="asset-library-actions"><label><Search size={14}/><input aria-label="搜索资产" placeholder={categoryHome?"搜索分类或分类中的资产":"搜索名称、对象、标签"} value={search} onChange={e=>setSearch(e.target.value)}/></label>{!categoryHome&&<button disabled={!!busy} aria-label="添加图片资产" title="添加图片资产" onClick={()=>fileInput.current?.click()}><Plus size={17}/></button>}</div>{categoryHome?<AssetCategoryHome assets={assets} search={search} coverSize={coverSize} onSelect={changeKind}/>:<>{<div className="asset-category-filter">{categories.map(label=><button key={label} className={category===label?'active':''} onClick={()=>setCategory(label)}>{label}<span>{label==='全部'?kindAssets.length:kindAssets.filter(a=>assetCategory(a)===label).length}</span></button>)}</div>}{<div className="asset-list-heading"><div><strong>{category==='全部'?(kind==='material'?'AI 材质':kind==='model'?'AI 模型／对象':'AI 人物'):category}</strong><span>{filtered.length} 项</span></div><div className="asset-cover-controls"><CanvasSelect aria-label="资产排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">最近保存</option><option value="name">名称排序</option></CanvasSelect><label><Minus size={11}/><input aria-label="资产封面大小" type="range" min="135" max="310" step="5" value={coverSize} onChange={e=>setCoverSize(Number(e.target.value))}/><Plus size={11}/></label></div></div>}<div className="asset-grid" style={{gridTemplateColumns:`repeat(auto-fill,minmax(min(100%,${coverSize}px),1fr))`}}>{filtered.map(asset=><div className="asset-tile-wrapper" key={asset.id}><button disabled={!!busy} className={`asset-tile ${chosen?.id===asset.id?'chosen':''}`} onClick={()=>{if(mode==='browse')setPreviewAsset(asset);else setChosen(asset);setError('');setNotice('')}}><AssetCardContent asset={asset}/>{chosen?.id===asset.id&&<Check className="asset-tile-check" size={15}/>}</button>{asset.id&&<button type="button" className="asset-delete" disabled={!!busy} aria-label={`删除资产：${asset.name}`} title="删除资产" onClick={()=>void deleteAsset(asset)}><Trash2 size={14}/></button>}</div>)}{!filtered.length&&<div className="asset-empty"><Archive size={29}/><strong>{search?'没有匹配的资产':'把好用的素材，留在这里'}</strong><p>{source&&mode==='extract'?'确认对象后在画布生成，满意后入库。':'可添加图片和描述，或导入资产备份。'}</p></div>}</div></>}</>}
      {candidates.length>1&&<div className="asset-candidates">{candidates.map((candidate,i)=><button disabled={!!busy} key={i} onClick={()=>setDraft({...candidate,source:source?.label})}>{candidate.name}</button>)}</div>}
      {draft&&<div className="asset-review"><div className="asset-review-title"><strong>校对后入库</strong><button disabled={!!busy} aria-label="取消资产入库" onClick={()=>{if(mode==='save')onClose();else setDraft(null)}}><X size={15}/></button></div><img src={draft.image} alt="待入库资产裁片"/>{draft.kind==='material'&&<label className="asset-field">材质分类<CanvasSelect aria-label="材质分类" disabled={!!busy} value={draft.materialCategory||'other'} onChange={e=>setDraft({...draft,materialCategory:e.target.value})}>{Object.entries({fabric:'织物／面料',wood:'木材',stone:'石材',metal:'金属',leather:'皮革',glass:'玻璃',ceramic:'陶瓷',paint:'涂料／灰泥',other:'其他／待确认'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</CanvasSelect></label>}<label className="asset-field">资产名称<input aria-label="资产名称" value={draft.name} disabled={!!busy} maxLength={120} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="asset-field">可复用提示词<textarea aria-label="资产提示词" value={draft.prompt} disabled={!!busy} maxLength={10000} onChange={e=>setDraft({...draft,prompt:e.target.value})}/></label><label className="asset-field">标签<input aria-label="资产标签" value={draft.tags.join('、')} disabled={!!busy} onChange={e=>setDraft({...draft,tags:e.target.value.split(/[、,，]/).filter(Boolean)})}/></label><p>{draft.notes}</p><small>置信度：{({high:'高',medium:'中',low:'低',unknown:'未确认'} as Record<string,string>)[draft.confidence||'unknown']} · 请核对颜色、纹理与不确定项</small><button className="asset-primary" disabled={!!busy||!draft.name.trim()||!draft.prompt.trim()} onClick={()=>void save()}><Archive size={14}/>确认入库</button></div>}
      {chosen&&!draft&&<div className="asset-use">{mode==='browse'&&<button className="asset-detail-back" onClick={()=>setChosen(null)}>← 返回资产列表</button>}<strong>{chosen.name}</strong>{!chosen.previewType&&chosen.kind!=='person'&&<button className="person-view-open asset-detail-cover" aria-label="预览资产图片" onClick={()=>setDetailView({label:chosen.name,image:chosen.image})}><img src={chosen.image} alt={chosen.name}/></button>}{chosen.previewType&&<><div className="asset-preview-pair"><figure><button className="person-view-open" onClick={()=>setDetailView({label:'生成预览',image:chosen.image})}><img src={chosen.image} alt="生成的资产预览"/></button><figcaption>{chosen.previewType==='space'?'空间应用预览':'白底特写预览'}</figcaption></figure>{chosen.sourceImage&&<figure><button className="person-view-open" onClick={()=>setDetailView({label:'来源原图',image:chosen.sourceImage!})}><img src={chosen.sourceImage} alt="来源原图"/></button><figcaption>来源原图</figcaption></figure>}</div><p className="asset-notice">{chosen.reviewStatus==='confirmed'?'已确认入库':'自动入库 · 待核对颜色、纹理与光泽'}</p>{chosen.notes&&<small className="asset-service-note">{chosen.notes}</small>}</>}{chosen.kind==='person'&&<div className="person-view-gallery">{[...personViews].reverse().map(view=><figure key={view.label}><button className="person-view-open" aria-label={view.label} onClick={()=>setDetailView(view)}><img src={view.image} alt={view.label}/></button><figcaption>{view.label}</figcaption></figure>)}<small>AI 多视图，请核对人物一致性</small></div>}<label className="asset-field">{mode==='edit'?'本次使用的描述 · 不覆盖库中原文':'资产提示词'}<textarea aria-label="本次资产提示词" readOnly={mode!=='edit'} value={chosen.prompt} maxLength={10000} onChange={e=>setChosen({...chosen,prompt:e.target.value})}/></label>{mode==='browse'&&<button className="asset-primary" onClick={()=>onAdd(chosen)}>添加参考图片到画布</button>}</div>}
      {mode==='edit'&&<div className="asset-edit-options"><label className="asset-field">补充说明<textarea aria-label="局部编辑补充说明" disabled={!!busy} value={supplement} maxLength={5000} placeholder="仅作用于选区；优先于资产描述和内置规则" onChange={e=>setSupplement(e.target.value)}/></label>{!session.nodeId&&<div className="asset-model-options"><label className="asset-field">生图模型<CanvasSelect aria-label="局部编辑生图模型" disabled={!!busy} value={options.model} onChange={e=>setOptions({...options,model:e.target.value})}>{modelOptions.filter(m=>m.tag!=='待接入').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</CanvasSelect></label><div><label className="asset-field">画质<CanvasSelect aria-label="局部编辑画质" disabled={!!busy} value={options.resolution} onChange={e=>setOptions({...options,resolution:e.target.value as Generation['resolution']})}>{['1K','2K','4K'].map(r=><option key={r}>{r}</option>)}</CanvasSelect></label><label className="asset-field">比例<CanvasSelect disabled aria-label="局部编辑比例"><option>沿用底图</option></CanvasSelect></label><label className="asset-field">张数<CanvasSelect aria-label="局部编辑张数" disabled={!!busy} value={options.count} onChange={e=>setOptions({...options,count:Number(e.target.value)})}>{[1,2,3,4].map(c=><option key={c} value={c}>{c} 张</option>)}</CanvasSelect></label></div></div>}<small>{session.nodeId?'选区与资产保存到功能节点，生成参数在节点内调整。':'仅修改确认范围；选区外保留原图，选区内细节请复核。'}</small><button className="asset-primary" disabled={!!busy||!chosen?.prompt.trim()||points.length<3||!reviewed||!target.trim()} onClick={()=>void generate()}>{busy==='generate'?<LoaderCircle className="asset-spin" size={15}/>:<Palette size={15}/>}{session.nodeId ? '保存到功能节点' : `生成 ${options.count} 张新版本`}</button></div>}
      {error&&<p className="asset-error" role="alert">{error}</p>}{notice&&<p className="asset-notice" role="status">{notice}</p>}
      <footer className="asset-library-footer ui-panel-footer"><span>本机画布库 · {assets.length} 项</span><button disabled={!!busy} title="导入资产 JSON 备份" onClick={()=>importInput.current?.click()}><Upload size={12}/>导入</button><button disabled={!!busy||!assets.length} onClick={exportLibrary}><Download size={12}/>备份</button></footer><small className="asset-service-note">资产保存在本机，可随时导入与备份。</small>
    </div></div>}<input hidden ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void readImage(e.target.files?.[0]);e.currentTarget.value=''}}/><input hidden ref={importInput} type="file" accept=".json" onChange={e=>{void importLibrary(e.target.files?.[0]);e.currentTarget.value=''}}/>
    {detailView&&<div className="person-detail-backdrop" role="dialog" aria-modal="true" aria-label={detailView.label} onClick={()=>setDetailView(null)}><div onClick={e=>e.stopPropagation()}><button aria-label="关闭人物细节" onClick={()=>setDetailView(null)}><X size={18}/></button><img src={detailView.image} alt={detailView.label}/><strong>{detailView.label}</strong></div></div>}
  </section>{previewAsset&&<AssetDetail key={previewAsset.id||previewAsset.name} asset={previewAsset} assets={filtered} onChoose={setPreviewAsset} onClose={()=>setPreviewAsset(null)} onAdd={asset=>{onAdd(asset);setPreviewAsset(null)}}/>}</div>
}
