import { CanvasSelect } from './CanvasSelect'
import {assetCategory,materialCategories} from './assetCategory'
import {useRef,useState} from 'react'
import {Search,Trash2,Check} from 'lucide-react'
import {ObjectSelection} from './ObjectSelection'
import type {LocalEditRecipe,MaterialRegion,VisualAsset} from './AssetLibrary'
import {type Generation} from './generation'
const colors=['#8b5cf6','#06b6d4','#f59e0b','#ec4899']
type Region=Partial<MaterialRegion>&{id:string;target:string;points:number[][];status:'locating'|'ready'|'error';error?:string}
function contains(point:number[],polygon:number[][]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function MultiMaterialEditor({kind,image,assets,recipe,initialOptions,onClose,onGenerate}:{kind:'material'|'model';image:string;assets:VisualAsset[];recipe?:LocalEditRecipe;initialOptions:Generation;onClose:()=>void;onGenerate:(recipe:LocalEditRecipe,options:Generation)=>Promise<void>}){
  const noun=kind==='material'?'材质':'模型'
  const [regions,setRegions]=useState<Region[]>(()=>{
    const saved:MaterialRegion[]=recipe?.regions||(recipe?.points.length?[recipe]:[])
    return saved.map(r=>({...r,id:r.id||crypto.randomUUID(),mark:r.mark||[r.points.reduce((sum,p)=>sum+p[0],0)/r.points.length,r.points.reduce((sum,p)=>sum+p[1],0)/r.points.length],status:'ready'}))
  })
  const [activeId,setActiveId]=useState(''),[search,setSearch]=useState(''),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const [category,setCategory]=useState('全部')
  const available=assets.filter(a=>a.kind===kind)
  const categories=['全部',...new Set([...(kind==='material'?Object.values(materialCategories):[]),...available.map(assetCategory)])]
  const visible=available.filter(a=>(category==='全部'||assetCategory(a)===category)&&`${a.name} ${a.tags.join(' ')} ${a.prompt}`.toLowerCase().includes(search.toLowerCase()))
  const guard=useRef(false)
  const active=regions.find(r=>r.id===activeId)||regions[0],activeIndex=regions.findIndex(r=>r.id===active?.id)
  function patch(id:string,fields:Partial<Region>){setRegions(all=>all.map(r=>r.id===id?{...r,...fields}:r))}
  function patchActive(fields:Partial<Region>){if(active)patch(active.id,fields)}
  function addPoint(mark:number[]){
    if(submitting)return
    const existing=regions.find(r=>contains(mark,r.points)||r.mark&&Math.hypot(mark[0]-r.mark[0],mark[1]-r.mark[1])<.02)
    if(existing){setActiveId(existing.id);return}
    if(regions.length>=4){setError('最多同时调整 4 个对象，可删除标记后重新点选');return}
    const region:Region={id:crypto.randomUUID(),mark,target:`对象 ${regions.length+1}`,points:[],strokes:[],status:'ready'}
    setRegions(all=>[...all,region]);setActiveId(region.id);setError('');
  }
  function remove(id:string){setRegions(all=>all.filter(r=>r.id!==id));if(activeId===id)setActiveId('');setError('')}
  const ready=regions.length>0&&regions.every(r=>r.mark?.length===2&&r.target.trim()&&r.asset?.kind===kind&&r.asset.prompt.trim())
  async function generate(){
    if(!ready||guard.current)return
    guard.current=true;setSubmitting(true);setError('')
    const saved:MaterialRegion[]=regions.map(r=>({id:r.id,target:r.target,points:r.points,strokes:r.strokes,mark:r.mark,selectionReviewed:false,useImageReference:r.useImageReference===true,asset:r.asset!}))
    try{await onGenerate({...saved[0],kind,regions:saved,deferredSelection:true,supplement:recipe?.supplement||''},initialOptions);onClose()}
    catch(cause){setError(cause instanceof Error?cause.message:'提交失败');guard.current=false;setSubmitting(false)}
  }
  return <div className="asset-workspace-body multi-material-editor">
    <div className="asset-source-column"><ObjectSelection pointOnly image={image} kind={kind} points={active?.points||[]} strokes={active?.strokes||[]} mark={active?.mark} onMark={mark=>patchActive({mark})} onPoints={points=>patchActive({points,selectionReviewed:false})} onStrokes={strokes=>patchActive({strokes,selectionReviewed:false})} target={active?.target||''} onTarget={target=>patchActive({target})} reviewed={false} onReview={()=>{}} busy={active?.status==='locating'?'locate':''} onBusy={()=>{}} onError={setError} onPoint={addPoint} activeId={active?.id} activeColor={colors[Math.max(0,activeIndex)]} markers={regions.map((r,index)=>({...r,color:colors[index]}))} onMarker={setActiveId} statusText="点选立即标号；绑定完成后回到画布生成，后台再统一识别范围"/>

    </div>
    <div className="asset-library-column"><div className="material-binding-title"><div><span className="binding-step-number">02</span><strong>选择{noun}</strong></div><small>{regions.filter(r=>r.asset).length}/{regions.length} 已绑定</small></div>
      <div className="binding-object-tabs" aria-label="切换编辑对象">{regions.map((r,index)=><div className={active?.id===r.id?'active':''} key={r.id}><button className="binding-object-tab" aria-pressed={active?.id===r.id} title={`${r.target} · ${r.asset?.name||'未绑定'}`} onClick={()=>setActiveId(r.id)}><b style={{background:colors[index]}}>{index+1}</b><span>对象 {index+1}</span>{r.asset&&<Check size={12}/>}</button><button className="binding-object-remove" aria-label={`删除对象 ${index+1}`} onClick={()=>remove(r.id)}><Trash2 size={12}/></button></div>)}</div>
      {active?<div className="binding-current-object"><input aria-label="当前点选对象名称" value={active.target} disabled={submitting} onChange={e=>patchActive({target:e.target.value})}/><span title={active.asset?.name}>{active.asset?.name||`尚未选择${noun}`}</span></div>:<p className="binding-empty-hint">先在左侧图片上点选对象，最多 4 个。</p>}
      <div className="binding-filter-row"><label><Search size={14}/><input aria-label={`搜索绑定${noun}`} placeholder={`搜索${noun}`} value={search} onChange={e=>setSearch(e.target.value)}/></label><CanvasSelect aria-label={`${noun}分类`} value={category} onChange={e=>setCategory(e.target.value)}>{categories.filter(label=>label==='全部'||label===category||available.some(a=>assetCategory(a)===label)).map(label=><option key={label} value={label}>{label}</option>)}</CanvasSelect></div>
      <div className="binding-list-caption"><span>{category==='全部'?`全部${noun}`:category}</span><small>{visible.length} 项</small></div>
      <div className="asset-grid material-choice-grid">{visible.map(asset=><button disabled={!active||submitting} key={asset.id} title={asset.prompt} className={`asset-tile ${active?.asset?.id===asset.id?'chosen':''}`} onClick={()=>patchActive({asset})}><div className="binding-card-cover"><img loading="lazy" src={asset.image} alt={asset.name}/>{active?.asset?.id===asset.id&&<span><Check size={14}/></span>}</div><strong title={asset.name}>{asset.name}</strong><small title={asset.prompt}>{assetCategory(asset)}</small></button>)}{!visible.length&&<p className="asset-service-note">{available.length?'此分类或搜索条件下没有匹配资产，请切换到全部查看。':`暂无${noun}资产，请先保存到资产库。`}</p>}</div>
    </div>
    <footer className="material-binding-footer">
      {kind==='material'&&<div className="asset-field"><label className="material-image-guidance"><input type="checkbox" aria-label="使用当前材质图片作为参考" disabled={!active?.asset||submitting} checked={active?.useImageReference===true} onChange={e=>patchActive({useImageReference:e.target.checked})}/> 使用当前材质图片作为参考</label><small>{active?.useImageReference?'当前对象按图片材质外观优化，提示词补充细节；补充说明优先。':'默认按材质提示词优化，资产封面仅用于预览，不参与生图。'}</small></div>}
      <small className="asset-service-note">生成参数在画布节点设置。</small>
      {error&&<p className="asset-error" role="alert">{error}</p>}
      <div className="binding-footer-actions"><button className="binding-cancel" onClick={onClose} disabled={submitting}>取消</button><button className="asset-primary material-generate" disabled={!ready||submitting} onClick={()=>void generate()}>{submitting?'正在保存…':'保存并返回画布'}</button></div>
    </footer>
  </div>
}
