import {useFunctionEnabled} from './functionFlags'
import { CanvasSelect } from './CanvasSelect'
import type { ToneSettings } from './ToneSkillNode'
import {LightingControls,type LightingSettings} from './LightingControls'
import { type TaskTimingState } from './TaskTiming'
import { useEffect, useState } from 'react'
import { Play, X, MousePointer2, Pencil } from 'lucide-react'
import './SkillNode.css'
import type { LocalEditRecipe } from './AssetLibrary'

export type SkillInput = { id: string; src: string; previewSrc?: string; label: string; role?: string | null }
export type SkillOptions = { model: string; resolution: string; ratio: string; count: number }
export type SkillState = TaskTimingState & {
  lighting?: LightingSettings;
  baseId?: string; referenceIds?: string[]; supplement?: string; options?: SkillOptions;
  protection?: string; confirmed?: boolean; planText?: string;
  preparation?: { id: string; gray: string; line: string; ratio: string; width: number; height: number };
  jobId?: string; requestId?: string; message?: string; status?: string;
}
export type SkillResult = { toneSettings?: ToneSettings; index: number; src: string; review: Record<string, string> }
type Job = TaskTimingState & { id: string; status: string; message: string; taskId?: string; warning?: string; images: SkillResult[] }
type Model = { model: string; display_name?: string; supported_resolutions: string[]; supported_aspects: string[]; supported_counts?: number[]; max_images_per_call: number }
const defaultOptions: SkillOptions = { model: 'doubao-seedream-5-0-pro-260628', resolution: '2K', ratio: 'auto', count: 4 }
async function api<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const result = await response.json()
  if (!response.ok) throw Error(result.error || '功能请求失败')
  return result
}
function moduleWheel(event:React.WheelEvent<HTMLElement>){
  if(event.ctrlKey||event.metaKey)return
  const field=(event.target as HTMLElement).closest('textarea')
  if(field&&field.scrollHeight>field.clientHeight+1){
    const canScroll=event.deltaY<0?field.scrollTop>0:field.scrollTop+field.clientHeight<field.scrollHeight-1
    if(canScroll)event.stopPropagation()
  }
}
export function SkillNode({ tool, inputs, state, onChange, onAssetEdit, localEdit, onLocalRun, localBusy, localAttention }: { tool: string; inputs: SkillInput[]; state: SkillState; onChange: (value: SkillState) => void; onResults: (job: string, results: SkillResult[]) => void; onAssetEdit?: (baseId:string)=>void; localEdit?:LocalEditRecipe; onLocalRun?:()=>void; localBusy?:boolean; localAttention?:boolean }) {
  const enabled=useFunctionEnabled()(tool)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const uniqueInputs = inputs.filter((input, index) => inputs.findIndex(other => other.id === input.id) === index)
  const base = uniqueInputs.find(input => input.id === state.baseId) || uniqueInputs.find(input => input.role !== 'style') || uniqueInputs[0]
  const references = (state.referenceIds ? state.referenceIds.map(id => uniqueInputs.find(input => input.id === id)) : uniqueInputs.filter(input => input.id !== base?.id)).filter((input): input is SkillInput => !!input && input.id !== base?.id)
  const options = { ...defaultOptions, ...state.options }
  const model = models.find(model => model.model === options.model)
  const running = !!state.jobId && !['complete','paused'].includes(state.status || '')
  const locked = !enabled || busy || running
  useEffect(() => {
    let active = true
    api<{models: Model[]}>('/api/skills/status').then(result => { if (active) setModels(result.models) }).catch(() => { if (active) setError('本地功能服务不可用') })
    return () => { active = false }
  }, [tool])
  function changeOptions(next: SkillOptions) { onChange({ ...state, options: next, requestId: undefined }); setError('') }
  function chooseModel(id: string) {
    const selected = models.find(model => model.model === id)
    if (!selected) return
    const resolutions = selected.supported_resolutions || [], ratios = selected.supported_aspects || []
    const counts = selected.supported_counts?.filter(count=>count>=1 && count<=4) || [1,2,3,4].filter(count => count <= selected.max_images_per_call)
    changeOptions({ ...options, model: id, resolution: resolutions.includes(options.resolution) ? options.resolution : resolutions[0], ratio: options.ratio === 'auto' || ratios.includes(options.ratio) ? options.ratio : 'auto', count: counts.includes(options.count) ? options.count : counts[0] })
  }
  async function run() {
    setBusy(true); setError('')
    try {
      if (!base || tool !== 'light' && (references.length < 1 || references.length > 3)) throw Error('请连接一张底图与 1–3 张风格参考')
      const requestId = state.jobId && ['complete','paused'].includes(state.status || '') ? crypto.randomUUID() : state.requestId || crypto.randomUUID()
      onChange({ ...state, options, baseId:base!.id, requestId })
      const job = await api<Job>(tool === 'light' ? '/api/skills/light/run' : '/api/skills/style/run', { requestId, base: base!.src, ...(tool === 'light' ? {lighting:state.lighting||{}} : {references: references.map(r => r.src)}), options, supplement: state.supplement || '' })
      onChange({ ...state, options, requestId, baseId:base!.id, jobId: job.id, createdAt: job.createdAt, finishedAt: job.finishedAt, serverNow: job.serverNow, status: job.status, message: job.message })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '功能执行失败') }
    finally { setBusy(false) }
  }
  if (['material','furniture'].includes(tool)) return <fieldset disabled={localBusy||!enabled} style={{border:0,margin:0,minWidth:0}} className="skill-body compact-skill nopan" onWheelCapture={moduleWheel}>
    <div className="skill-input-row"><div className="skill-field-label">底图</div><div className="skill-input-surface">{base ? <><img draggable={false} className="skill-thumbnail" src={base.previewSrc || base.src} alt={base.label}/><span className="asset-binding-label" title={base.label}>{base.label}</span></> : <small>请连接一张底图</small>}</div></div>
    <div className="skill-binding-field">
      <div className="skill-binding-heading"><span>{tool==='material'?'材质':'模型'}</span><button type="button" className="nodrag nopan skill-binding-edit" disabled={!base} onClick={()=>base&&onAssetEdit?.(base.id)}>{localEdit?<><Pencil size={11}/> 编辑</>:<><MousePointer2 size={12}/> 选择</>}</button></div>
      <button type="button" className={`nodrag nopan skill-binding-card ${localEdit?'is-bound':'is-empty'}`} disabled={!base} aria-label={tool==='material'?(localEdit?'调整对象与材质':'选择对象与材质'):(localEdit?'调整对象与模型':'选择对象与模型')} onClick={()=>base&&onAssetEdit?.(base.id)}>
      {localEdit?<span className="skill-binding-items">{(localEdit.regions||[localEdit]).map((region,index)=><span className="skill-binding-item" key={index} title={`${index+1}. ${region.target} → ${region.asset.name}`}><img draggable={false} src={region.asset.image} alt={`${index+1}号 ${region.asset.name}`}/><span className="skill-binding-detail"><span className="skill-binding-object"><strong title={region.target}>对象 {index+1}</strong></span><small title={region.asset.name}>{region.asset.name}</small></span></span>)}</span>:<span className="skill-binding-empty">{base?'点选底图中的对象，为每个对象绑定资产':'请先连接一张底图'}</span>}

      </button>
    </div>
    <div className="skill-public-options"><label>生图模型<CanvasSelect className="nodrag nopan" aria-label="功能生图模型" value={options.model} onChange={e=>chooseModel(e.target.value)}>{!models.some(m=>m.model===options.model)&&<option value={options.model}>Seedream 5.0 Pro</option>}{models.map(m=><option key={m.model} value={m.model}>{m.display_name||m.model}</option>)}</CanvasSelect></label><div><label>画质<CanvasSelect className="nodrag nopan" aria-label="功能分辨率" value={options.resolution} onChange={e=>changeOptions({...options,resolution:e.target.value})}>{(model?.supported_resolutions||['2K']).map(r=><option key={r}>{r}</option>)}</CanvasSelect></label><label>比例<CanvasSelect className="nodrag nopan" aria-label="功能尺寸比例" value={options.ratio} onChange={e=>changeOptions({...options,ratio:e.target.value})}><option value="auto">沿用原图</option>{(model?.supported_aspects||[]).filter(r=>/^\d+:\d+$/.test(r)).map(r=><option key={r}>{r}</option>)}</CanvasSelect></label><label>张数<CanvasSelect className="nodrag nopan" aria-label="功能生成张数" value={options.count} onChange={e=>changeOptions({...options,count:Number(e.target.value)})}>{[1,2,3,4].map(c=><option key={c} value={c}>{c} 张</option>)}</CanvasSelect></label></div></div>
    <small className="skill-hint" title="优先沿用原图比例；模型不支持时匹配相近比例。手动改比例可能改变构图。">比例自动适配，改比例需复核构图。</small><label className="skill-supplement">补充说明<textarea className="nodrag nopan" aria-label="功能补充说明" value={state.supplement||''} maxLength={5000} onChange={e=>onChange({...state,supplement:e.target.value})}/></label>
    <button className="nodrag nopan primary skill-run" disabled={!base||!localEdit} onClick={onLocalRun}><Play size={14}/>{localAttention?'请先核对任务状态':localBusy?'正在生成…':'生成图片'}</button>
  </fieldset>
  return <div className="skill-body compact-skill nopan" onWheelCapture={moduleWheel}>
    <div className="skill-input-row"><div className="skill-field-label">底图</div><div className="skill-input-surface">{base ? <><img draggable={false} className="skill-thumbnail" width={45} height={45} style={{ width: 45, height: 45, maxWidth: 45, maxHeight: 45, flex: '0 0 45px', objectFit: 'cover', display: 'block' }} src={base.previewSrc || base.src} alt={base.label} /><CanvasSelect className="nodrag nopan" aria-label="场景底图" disabled={locked} value={base.id} onChange={e => onChange({ ...state, baseId: e.target.value, referenceIds: undefined, requestId: undefined })}>{uniqueInputs.map(input => <option key={input.id} value={input.id}>{input.label}</option>)}</CanvasSelect></> : <small>连接产品场景图</small>}</div></div>
    {tool !== 'light' && <div className="skill-input-row references"><div className="skill-field-label">参考图</div><div className="skill-input-surface">{references.map((input, index) => <div className="compact-reference" style={{ width: 45, height: 45, flex: '0 0 45px' }} key={input.id}><img draggable={false} className="skill-thumbnail" width={45} height={45} style={{ width: 45, height: 45, maxWidth: 45, maxHeight: 45, objectFit: 'cover', display: 'block' }} src={input.previewSrc || input.src} alt={input.label} title={index === 0 ? '主参考' : '补充参考'} /><button className="nodrag nopan" aria-label={`移除参考 ${index + 1}`} disabled={locked} onClick={() => onChange({ ...state, referenceIds: references.filter(r => r.id !== input.id).map(r => r.id), requestId: undefined })}><X size={10} /></button></div>)}{!references.length && <small>连接 1–3 张参考图</small>}</div></div>}
    {tool !== 'light' && uniqueInputs.some(input => input.id !== base?.id && !references.some(r => r.id === input.id)) && <CanvasSelect className="nodrag nopan" aria-label="添加已连接风格参考" value="" disabled={locked} onChange={e => onChange({ ...state, referenceIds: [...references.map(r => r.id), e.target.value], requestId: undefined })}><option value="">＋ 添加参考</option>{uniqueInputs.filter(input => input.id !== base?.id && !references.some(r => r.id === input.id)).map(input => <option key={input.id} value={input.id}>{input.label}</option>)}</CanvasSelect>}
    {tool === 'light' && <LightingControls value={state.lighting||{}} disabled={locked} onChange={lighting=>onChange({...state,lighting,referenceIds:[],requestId:undefined})}/>}
    <div className="skill-public-options"><label>生图模型<CanvasSelect className="nodrag nopan" aria-label="功能生图模型" value={options.model} disabled={locked} onChange={e => chooseModel(e.target.value)}>{!models.some(model => model.model === options.model) && <option value={options.model}>Seedream 5.0 Pro</option>}{models.map(model => <option key={model.model} value={model.model}>{model.display_name || model.model}</option>)}</CanvasSelect></label><div><label>画质<CanvasSelect className="nodrag nopan" aria-label="功能分辨率" value={options.resolution} disabled={locked} onChange={e => changeOptions({ ...options, resolution: e.target.value })}>{(model?.supported_resolutions || ['2K']).filter(r => ['1K','2K','4K'].includes(r)).map(r => <option key={r}>{r}</option>)}</CanvasSelect></label><label>尺寸比例<CanvasSelect className="nodrag nopan" aria-label="功能尺寸比例" value={options.ratio} disabled={locked} onChange={e => changeOptions({ ...options, ratio: e.target.value })}><option value="auto">沿用原图</option>{(model?.supported_aspects || ['3:4','4:3','1:1','16:9','9:16']).filter(r => r !== 'auto' && r !== 'custom').map(r => <option key={r}>{r}</option>)}</CanvasSelect></label><label>张数<CanvasSelect className="nodrag nopan" aria-label="功能生成张数" value={options.count} disabled={locked} onChange={e => changeOptions({ ...options, count: Number(e.target.value) })}>{(model?.supported_counts || [1,2,3,4].filter(count => count <= (model?.max_images_per_call || 4))).filter(count => count <= 4).map(count => <option key={count} value={count}>{count} 张</option>)}</CanvasSelect></label></div></div>
    <small className="skill-hint" title="优先沿用原图比例；模型不支持时匹配相近比例。手动改比例可能改变构图。">比例自动适配，改比例需复核构图。</small><label className="skill-supplement">补充说明 <small>优先于内置规则</small><textarea className="nodrag nopan" aria-label="功能补充说明" disabled={locked} maxLength={5000} placeholder={tool==='light'?'例如：阳光偏暖一点，保留沙发原色，暗部不要太黑…':'可选，例如：沙发保持原色，只换墙面与地面…'} value={state.supplement || ''} onChange={e => onChange({ ...state, supplement: e.target.value, requestId: undefined })} /></label>
    <button className="nodrag nopan primary skill-run" disabled={locked || !['style','light'].includes(tool) || !base || tool === 'style' && (!references.length || references.length > 3)} onClick={() => void run()}><Play size={14} />{busy || running ? '正在处理…' : state.jobId ? '再次生成' : '生成图片'}</button>
    {error && <div className="skill-status error" role="status">{error}</div>}
  </div>
}
