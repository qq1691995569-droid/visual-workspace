import { isGenerationFailure } from './generationFailure'
import {mergeTaskAliases} from './taskAliases'
import {TextureRestoreNode,textureDefaults,type TextureState} from './TextureRestoreNode'
import {FunctionFlagsProvider,useFunctionEnabled} from './functionFlags'
import {UpscaleNode,type UpscaleState} from './UpscaleNode'
import {writeImageClipboard,writeMultipleImagesClipboard,readClipboardGraph} from './imageClipboard'
import {groupConnection} from './groupConnections'
import {GroupActions} from './GroupActions'
import { pushNeighbours } from './nodeAvoidance'
import { ThemeToggle } from './ThemeToggle'
import { previewBatch } from './previewBatch'
import { pendingTask } from './pendingTask'
import {ProjectManager} from './ProjectManager'
import { CanvasImage } from './CanvasImage'
import { CanvasBackground } from './CanvasBackground'
import {ImageDimensions} from './ImageDimensions'
import {prepareUploadedImage} from './imageImport'
import {prepareLocalEditSubmission} from './localEditSubmission'
import {syncMaterialReferences,unlinkMaterialReferences} from './materialReferences'
import {latestProjectWriter} from './projectPersistence'
import {rowSelection,arrangeCanvas,arrangeWorkflow,avoidExpandedOverlap,toolPlacement,type Arrangement} from './canvasArrangement'
import {copyCanvasImages,pasteCanvasImages} from './canvasClipboard'
import {ExtractionMonitor} from './ExtractionMonitor'
import {applyExtractionState,type ExtractionTask,type ExtractedAsset,type ExtractionSnapshot} from './canvasExtraction'
import {ConnectionHandle as Handle,ConnectionGeometry} from './ConnectionHandle'
import { resultEditing } from './resultEditing'
import { AssetLibrary, type AssetSession, type VisualAsset, type LocalEditRecipe } from './AssetLibrary'
import { ImageComparison } from './ImageComparison'
import { composerBatch, composerPosition } from './composerBatch'
import { GenerationPlaceholder } from './GenerationPlaceholder'
import { resultData } from './generationResults'
import { refinementPrompt, styleRefinementBody } from './refinement'
import { graphCommand, applyGraphCommand, type GraphCommand } from './graphHistory'
import { ResultDock } from './ResultDock'
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo, createContext, useContext } from 'react'
import { getViewportForBounds, ReactFlow, ReactFlowProvider, Controls, MiniMap, Position, SelectionMode, NodeResizer, useNodesState, useEdgesState, useReactFlow, useStore, useUpdateNodeInternals, addEdge, reconnectEdge, type Node, type NodeProps, type Edge, type Viewport } from '@xyflow/react'
import { readCanvasProject, writeCanvasProject, canvasProjects, readCanvasBackup } from './canvasStorage'
import { Undo2, Redo2, Archive, Upload, Download, Layers, WandSparkles, Plus, X, ImagePlus, Pencil, Palette, Sun, Armchair, Maximize, Scan, FolderOpen, Columns2, Check, ChevronDown, ChevronUp, Group, Ungroup, GripHorizontal, MousePointer2, Map, Eye, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import './App.css'
import './WorkspaceTheme.css'
import './ComposerDesign.css'
import './VisualSystem.css'
import { CanvasEdge } from './CanvasEdge'
import { ImageJob, ImageJobControls, type ImageJobState } from './ImageJob'
import { InlineImageEdit } from './InlineImageEdit'
import { SkillNode, type SkillState, type SkillOptions, type SkillResult } from './SkillNode'
import { builtinSkills, type BuiltinOperation, type InlineParameters, type QuickTask } from './builtinSkills'
import { ToneSkillNode, type ToneSettings } from './ToneSkillNode'
import { ToneWorkbench } from './ToneWorkbench'
import { ImageToolbar } from './ImageToolbar'
import { GenerationControls } from './GenerationControls'
import { absolutePosition, groupBounds, detachGroup, nextBatchPosition, fitGroupNodes } from './graphLayout'
import { restackLayerGroups, type StackCrop } from './layerStack'
import { defaultGeneration, normalizeGeneration, modelOptions, ratioFromDimensions, targetDimensions, type Generation } from './generation'

const tools = [
  {id:'texture-restore',name:'图片重绘',detail:'线稿锁定构图 · 还原材质与光影',icon:WandSparkles},
  { id: 'edit', name: '图片编辑', detail: '框选原图中的区域，填写修改要求', icon: WandSparkles },
  { id: 'separate', name: '多图层', detail: '按独立对象拆分室内场景，保留背景与透明图层', icon: Layers },
  { id: 'background', name: '去背景', detail: '分离图片主体与背景', icon: Scan },
  { id: 'erase', name: '消除', detail: '描述需要移除的局部元素', icon: Scan },
  { id: 'expand', name: '扩图', detail: '拓展原始图片的画面边界', icon: Maximize },
  { id: 'generate', name: '文生图', detail: '从描述开始，构建新的画面', icon: ImagePlus },
  { id: 'redraw', name: '图像', detail: '基于原图重新演绎', icon: WandSparkles },
  { id: 'material', name: '材质优化', detail: '保留结构，调整表面质感', icon: Palette },
  { id: 'tone-skill', name: '场景调色', detail: '底图与参考图匹配色调 · 本地处理', icon: Palette },
  { id: 'style', name: '风格转换', detail: '使用参考图统一视觉风格', icon: Layers },
  { id: 'light', name: '光影优化', detail: '调整光线方向、明暗与色温', icon: Sun },
  { id: 'furniture', name: '模型替换', detail: '从对象资产库替换指定造型', icon: Armchair },
  { id: 'remove', name: '去背景 / 消除', detail: '分离主体或移除局部元素', icon: Scan },
  { id: 'platform-upscale', name: '图像放大', detail: '调用 DREO 放大工作流 · 保留原图', icon: Maximize },
  { id: 'upscale', name: '变清晰', detail: '拓展画面与提升细节', icon: Maximize },
]
const skillIds = ['texture-restore','tone-skill', 'style', 'material', 'light', 'furniture']
// Keep the image entry first. Append newly released canvas features to this order.
// Features from the initial release retain their relative order.
const canvasToolOrder = ['redraw', 'generate', 'material', 'style', 'light', 'furniture', 'tone-skill', 'platform-upscale', 'texture-restore']
const canvasTaskLabels: Record<BuiltinOperation, string> = {
  'white-background': '制作纯白背景', edit: '编辑图片', redraw: '引用生成', separate: '拆分图层',
  background: '去背景', erase: '消除', expand: '扩图', upscale: '变清晰',
}
// Legacy tools remain readable in saved projects, but never appear as duplicate creation entries.
const sidebarTools = tools.filter(tool => canvasToolOrder.includes(tool.id)).sort((a,b)=>canvasToolOrder.indexOf(a.id)-canvasToolOrder.indexOf(b.id)).map(tool => skillIds.includes(tool.id) ? { ...tool, name: tool.name, detail: tool.id === 'texture-restore' ? tool.detail : tool.id === 'tone-skill' ? '底图与参考图匹配色调 · 本地处理' : tool.id === 'style' ? '灰度与线稿控制 · 逐表面材质迁移' : ['material','furniture'].includes(tool.id) ? '点选对象 · 从资产库绑定外观' : '调整光线方向、明暗与色温' } : tool)

type Card = Node<{ textureState?:TextureState; upscaleState?:UpscaleState; toneSettings?: ToneSettings; canvasImageNode?:boolean; generatedSkill?:string; canvasParameters?:InlineParameters; canvasOperation?:BuiltinOperation; extraction?:ExtractionTask; extractedAsset?:ExtractedAsset; label: string; kind: 'image' | 'tool' | 'group'; src?: string; previewSrc?: string; version?: {parentId?:string;parentLabel?:string;revision:number}; tool?: string; prompt?: string; final?: boolean; dimensions?: string; generation?: Generation; imageJob?: ImageJobState; imageOutput?: boolean; skillState?: SkillState; composerRequest?: { id: string; referenceIds?: string[]; input?: {id:string;src:string;original?:string} }; localEdit?: LocalEditRecipe; comparison?: { original: string; input?: string }; skillResult?: { jobId: string; sourceNode: string; baseId?: string; review: Record<string,string> }; refinementDraft?: { prompt: string; options: SkillOptions }; submittedRefinement?: {jobId:string;prompt:string}; iterationContext?: { modification?:string; lighting?: SkillState['lighting']; tool: string; prompt: string; referenceIds: string[]; options: SkillOptions }; pendingResult?: { jobId: string; sourceNode: string; index: number; endpoint?: 'style' | 'images'; task?: ImageJobState }; provenanceLinked?: boolean; imagePresentationVersion?: number; task?: QuickTask; collectionManaged?: boolean; collapsed?: boolean; expandedSize?: { width: number; height: number }; layerStack?: boolean; layerLayoutVersion?: number; stackLayer?: boolean; stackCrop?: StackCrop; transparentLayer?: boolean; layerIndex?: number }, 'card'>
function imageOperationName(data?: Card['data']): string | undefined {
  if (!data) return undefined
  return (data.canvasOperation ? builtinSkills[data.canvasOperation]?.name : undefined)
    || (data.extraction || data.extractedAsset ? '资产提取' : undefined)
    || (data.localEdit ? data.localEdit.kind === 'material' ? '材质优化' : '模型替换' : undefined)
    || data.generatedSkill
    || tools.find(t => t.id === (data.iterationContext?.tool || data.tool))?.name
}

type Project = { format: 'visproj'; schemaVersion: 1; name: string; nodes: Card[]; edges: Edge[]; viewport: Viewport; draft?: { referenceIds?: string[]; prompt: string; generation: Generation; mode: 'generate' | 'redraw' } }
const Actions = createContext<{ skillResults: (id: string, job: string, images: SkillResult[]) => void; update: (id: string, data: Partial<Card['data']>) => void; run: (id: string) => void; addTool: (tool: string, source: string) => void; toggle: (id: string) => void; ungroup: (id: string) => void; select: (id: string) => void; selectLayer: (id: string) => void; quick: (operation: string, id: string) => void; editing: { id: string; operation: BuiltinOperation } | null; cancelEdit: () => void; confirmEdit: (parameters: InlineParameters) => void }>({ skillResults: () => {}, update: () => {}, run: () => {}, addTool: () => {}, toggle: () => {}, ungroup: () => {}, select: () => {}, selectLayer: () => {}, quick: () => {}, editing: null, cancelEdit: () => {}, confirmEdit: () => {} })
const uid = () => crypto.randomUUID()
function download(content: Blob | string, filename: string) {
  const url = typeof content === 'string' ? content : URL.createObjectURL(content)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  if (typeof content !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function validate(raw: unknown): Project {
  const p = raw as Project
  if (!p || p.format !== 'visproj' || p.schemaVersion !== 1 || typeof p.name !== 'string' || !Array.isArray(p.nodes) || !Array.isArray(p.edges) || p.nodes.length > 1000) throw Error('不支持的项目文件')
  const ids = new Set<string>()
  for (const n of p.nodes) {
    if (typeof n.id !== 'string' || ids.has(n.id) || n.type !== 'card' || !n.data || typeof n.data.label !== 'string' || !['image', 'tool', 'group'].includes(n.data.kind) || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) throw Error('项目节点数据无效')
    if (n.data.previewSrc && !/^data:image\/(png|jpeg);base64,/.test(n.data.previewSrc)) throw Error('项目预览图片无效')
    if (n.data.src && !/^data:image\/(png|jpeg|webp);base64,/.test(n.data.src)) throw Error('项目包含不支持的图片')
    if (n.data.kind === 'tool' && !tools.some(t => t.id === n.data.tool)) throw Error('未知工具')
    if (n.data.imageJob && (typeof n.data.imageJob.status !== 'string' || typeof n.data.imageJob.message !== 'string' || (n.data.imageJob.id !== undefined && typeof n.data.imageJob.id !== 'string'))) throw Error('生图任务记录无效')
    if(n.data.extraction){const e=n.data.extraction;if(!/^[a-f0-9-]{36}$/.test(e.id)||!Number.isInteger(e.index)||e.index<0||e.index>24||!['material','model','person'].includes(e.kind)||typeof e.status!=='string'||typeof e.message!=='string'||typeof e.createdAt!=='string')throw Error('Invalid extraction record')}
    if (n.data.task && (!(n.data.task.operation in builtinSkills) || n.data.task.status !== 'blocked')) throw Error('任务记录无效')
    if(n.data.kind==='tool' && /^(材质优化|风格转换|风格转化|(?:AI\s*)?光影优化|模型替换)(?:\s*·\s*技能)?$/.test(n.data.label)) n.data.label=n.data.label.replace(/\s*·\s*技能$/, '').replace(/^AI\s*光影优化$/, '光影优化')
    if (n.data.kind === 'tool') n.data.generation = normalizeGeneration(n.data.generation)
    if (n.data.kind === 'tool' && n.data.tool === 'generate') n.selected = false
    if (n.data.skillState) {
      const s = n.data.skillState
      if (typeof s !== 'object' || (s.referenceIds !== undefined && (!Array.isArray(s.referenceIds) || s.referenceIds.length > 10 || !s.referenceIds.every(id => typeof id === 'string'))) || (s.protection !== undefined && (typeof s.protection !== 'string' || s.protection.length > 10000)) || (s.planText !== undefined && (typeof s.planText !== 'string' || s.planText.length > 100000)) || (s.confirmed !== undefined && typeof s.confirmed !== 'boolean')) throw Error('功能配置无效')
      for (const key of ['baseId', 'jobId', 'requestId'] as const) if (s[key] !== undefined && typeof s[key] !== 'string') throw Error('功能引用无效')
      if (s.supplement !== undefined && (typeof s.supplement !== 'string' || s.supplement.length > 5000)) throw Error('补充说明无效')
      if (s.options && (typeof s.options.model !== 'string' || typeof s.options.resolution !== 'string' || typeof s.options.ratio !== 'string' || !Number.isInteger(s.options.count) || s.options.count < 1 || s.options.count > 4)) throw Error('功能生成参数无效')
      if (s.preparation && (typeof s.preparation.id !== 'string' || ![s.preparation.gray, s.preparation.line].every(src => typeof src === 'string' && /^data:image\/png;base64,/.test(src)))) throw Error('功能预处理记录无效')
    }
    ids.add(n.id)
  }
  for (const n of p.nodes) {
    if (n.parentId && !p.nodes.some(parent => parent.id === n.parentId && parent.data.kind === 'group' && !parent.parentId)) throw Error('分组引用无效')
    if (n.data.kind === 'group') { if (n.parentId) throw Error('暂不支持嵌套分组'); n.deletable = false; n.dragHandle = '.group-heading' }
  }
  p.nodes = restackLayerGroups([...p.nodes.filter(n => n.data.kind === 'group'), ...p.nodes.filter(n => n.data.kind !== 'group')])
  if (p.edges.some(e => typeof e.id !== 'string' || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target)) throw Error('项目连线无效')
  if (!p.viewport || !Number.isFinite(p.viewport.x) || !Number.isFinite(p.viewport.y) || !Number.isFinite(p.viewport.zoom) || p.viewport.zoom <= 0) throw Error('项目视图数据无效')
  return p
}
// Cache once per immutable node snapshot, rather than scan for every selected card.
const idleConnectionData = {transmitting:false}
const activeConnectionData = {transmitting:true}
const singleSelectionCache = new WeakMap<Node[], string | null>()
function singleSelectedNode(nodes:Node[]) {
  if(singleSelectionCache.has(nodes))return singleSelectionCache.get(nodes)
  let id:string|null=null
  for(const node of nodes)if(node.selected){if(id!==null){id=null;break}id=node.id}
  singleSelectionCache.set(nodes,id)
  return id
}
function CardNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY, width = 340, height = 340 }: NodeProps<Card>) {
  const flow = useReactFlow<Card>()
  const singleSelected = useStore(state=>selected&&singleSelectedNode(state.nodes)===id)
  // Panning only affects overlays on the selected image, not every node body.
  const transform = useStore(state => singleSelected ? state.transform : [0, 0, data.kind === 'tool' ? state.transform[2] : 1], (a,b)=>a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2])
  const nodeViewport = {x:transform[0],y:transform[1],zoom:transform[2]}
  const cardRef = useRef<HTMLDivElement>(null)
  const [resizingImage, setResizingImage] = useState(false)
  const [layerListOpen, setLayerListOpen] = useState(false)
  const { skillResults, update, run, toggle, ungroup, select, selectLayer, quick, editing, cancelEdit, confirmEdit } = useContext(Actions)
  const allEdges = useStore(state=>data.kind==='tool'?state.edges.filter(e=>e.target===id):[], (a,b)=>a.length===b.length&&a.every((e,i)=>e.id===b[i].id&&e.source===b[i].source&&e.targetHandle===b[i].targetHandle))
  const allNodes = useStore(state=>(data.kind==='group'?state.nodes.filter(n=>n.parentId===id):allEdges.map(e=>state.nodeLookup.get(e.source)).filter(Boolean)) as Card[], (a,b)=>a.length===b.length&&a.every((n,i)=>n.id===b[i].id&&n.data===b[i].data&&n.parentId===b[i].parentId&&n.selected===b[i].selected))
  const internals = useUpdateNodeInternals()
  useEffect(() => { internals(id) }, [id, data.collapsed, internals])
  // Only the second tool input changes its offset with zoom. Measure once after zoom settles.
  useEffect(() => {
    if(data.kind!=='tool'||data.collapsed)return
    const timer=setTimeout(()=>internals(id),120)
    return ()=>clearTimeout(timer)
  }, [id, data.kind, data.collapsed, nodeViewport.zoom, internals])
  const inputs = allEdges.filter(e => e.target === id).map(e => allNodes.find(n => n.id === e.source)).filter(n => n?.data.kind === 'image' && !n.data.pendingResult && !n.data.task && (!n.data.imageJob || n.data.imageOutput))
  const settings = normalizeGeneration(data.generation)
  const isSkill = skillIds.includes(data.tool || '')
  const Icon = tools.find(t => t.id === data.tool)?.icon ?? ImagePlus
  const foldedOptions = isSkill ? {model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:4,...data.skillState?.options} : settings
  const foldedJob = data.imageJob || data.skillState
  const foldedStatus = foldedJob?.status ? foldedJob.status==='complete'?'已完成':['paused','submit_error','submission_unknown','needs_attention','connection_lost'].includes(foldedJob.status)?'需处理':'处理中' : !inputs.length?'待连接底图':['material','furniture'].includes(data.tool||'')&&!data.localEdit?'待选择对象与资产':data.tool==='style'&&inputs.length<2?'待连接风格参考':'待生成'
  const foldedModel = modelOptions.find(m=>m.id===foldedOptions.model)?.name || foldedOptions.model

  const pendingSource=useStore(state=>data.pendingResult?state.nodeLookup.get(data.pendingResult.sourceNode)?.data as Card['data']|undefined:undefined)
  const pendingJob=data.pendingResult?pendingTask<ImageJobState | SkillState>(data.pendingResult.jobId,pendingSource,data.pendingResult.task):undefined
  const pendingControls=data.pendingResult&&pendingJob?<ImageJobControls job={{...pendingJob,id:data.pendingResult.jobId,status:pendingJob.status||'restoring',message:pendingJob.message||''}} onChange={task=>{
   const sourceId=data.pendingResult!.sourceNode,jobId=data.pendingResult!.jobId
   if(pendingSource?.imageJob&&[pendingSource.imageJob.id,pendingSource.imageJob.requestId].includes(jobId))update(sourceId,{imageJob:task})
   else if(pendingSource?.skillState?.jobId===jobId)update(sourceId,{skillState:{...pendingSource.skillState,...task,jobId}})
   else update(id,{pendingResult:{...data.pendingResult!,task}})
  }}/>:undefined
  const imageTask = data.extraction ? {status:data.extraction.itemStatus || data.extraction.status,message:data.extraction.itemMessage || data.extraction.message} : (data.pendingResult ? pendingJob || {status:'restoring'} : data.imageJob)
  const imageSkill = imageOperationName(data) || imageOperationName(pendingSource)
  const compactOutputFailure = !data.src && !data.previewSrc && pendingSource?.tool !== 'tone-skill' && data.tool !== 'tone-skill' && isGenerationFailure(imageTask)
  const imageStatus = compactOutputFailure || !!(data.src || data.previewSrc) && isGenerationFailure(imageTask) ? '失败' : data.task ? '待处理' : imageTask && !['complete','completed'].includes(imageTask.status || '') ? ['cancelled','canceled'].includes(imageTask.status || '') ? '已取消' : ['paused','needs_attention','submit_error','submission_unknown','connection_lost','failed','error'].includes(imageTask.status || '') ? '需处理' : imageTask.status==='restoring'?'查询中':'生成中' : '已完成'
  const previewStatusLabel = imageSkill || (data.pendingResult?.endpoint === 'style' ? '风格转换' : '图像')
  const imageTag = data.kind==='image' && !data.stackLayer && imageTask && !['complete','completed'].includes(imageTask.status || '') ? <div className="image-origin-label" data-status={imageStatus} title={`${previewStatusLabel} · ${imageStatus}${data.label?' · '+data.label:''}`}>{compactOutputFailure?<ImagePlus size={13}/>:<Pencil size={13}/>}<span>{previewStatusLabel}</span><i/><small>{imageStatus}</small></div> : null
  const cropScale = data.stackCrop ? width / data.stackCrop.width : 1
  if (data.kind === 'group') {
    const children = allNodes.filter(n => n.parentId === id)
    if (data.layerStack) return <div className={`workflow-group layer-stack ${selected ? 'selected' : ''}`} onClick={()=>setLayerListOpen(true)}>
      <div className="group-heading layer-stack-heading"><Layers size={16}/><button type="button" className="layer-stack-title nodrag nopan" aria-label="查看分层图片" aria-expanded={layerListOpen} onClick={event=>{event.stopPropagation();setLayerListOpen(open=>!open)}}>多图层结果</button>{children.length===0&&<button type="button" className="nodrag nopan" aria-label="删除空多图层结果" title="删除空多图层结果" onClick={event=>{event.stopPropagation();void flow.deleteElements({nodes:[{id}]})}}><Trash2 size={14}/> 删除</button>}</div>
      {layerListOpen && <div className="layer-stack-list nodrag nopan" role="group" aria-label="独立 PNG 图层">{children.map((child,index)=><div className="layer-stack-row" key={child.id}><button type="button" className={child.selected?'chosen':''} onClick={event=>{event.stopPropagation();selectLayer(child.id)}}><span>{String(index+1).padStart(2,'0')}</span><strong>{child.data.label}</strong>{child.selected&&<Check size={14}/>}</button><button type="button" title={`下载 ${child.data.label}`} aria-label={`下载 ${child.data.label}`} onClick={event=>{event.stopPropagation();if(child.data.src)download(child.data.src,`${child.data.label}.png`)}}><Download size={14}/></button></div>)}<button type="button" className="layer-stack-separate" onClick={event=>{event.stopPropagation();ungroup(id)}}><Ungroup size={14}/> 分开到画布</button></div>}
    </div>
    const cover = children.find(n => n.data.final && n.data.src) || children.find(n => n.data.kind === 'image' && n.data.src && !n.data.task)
    const tasks = children.map(n => n.data.skillState?.jobId ? n.data.skillState : n.data.imageJob).filter(Boolean)
    const running = tasks.some(t => !['complete','paused','submit_error','submission_unknown'].includes(t!.status || ''))
    const failed = tasks.some(t => ['paused','submit_error','submission_unknown'].includes(t!.status || ''))
    return <div style={{'--group-edge-scale':'var(--port-scale, 1)'} as React.CSSProperties} className={`workflow-group ${selected ? 'selected' : ''} ${data.collapsed ? 'collection-folded' : ''}`}>
      {!data.collapsed && <NodeResizer isVisible={singleSelected} minWidth={280} minHeight={180} />}
      <div className="group-heading">{data.collapsed ? <span className="collection-icon"><Layers size={18}/></span> : <GripHorizontal size={17} />}<input aria-label="工作流分组名称" className="nodrag nopan" value={data.label} maxLength={60} onChange={e => update(id, { label: e.target.value })} /><button className="nodrag nopan" title="收拢 / 展开 · Ctrl+G" aria-label={data.collapsed ? '展开卡片组' : '收拢卡片组'} onClick={e => { e.stopPropagation(); toggle(id) }}>{data.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button></div>
      {data.collapsed ? <><div className="collection-cover">{data.previewSrc || cover ? <CanvasImage src={data.previewSrc || cover?.data.previewSrc || cover?.data.src || ''} alt="分组封面" width={340} height={240} /> : <Layers size={42} />}</div><div className="collection-footer"><div className="collection-summary"><span className="collection-count"><b>{children.length}</b> 个节点</span><span className={`collection-status ${failed ? 'failed' : running ? 'running' : ''}`}><i />{failed ? '需要检查' : running ? '处理中' : tasks.length ? '已完成' : '已收纳'}</span></div><button className="nodrag nopan" onClick={e => { e.stopPropagation(); toggle(id) }}>展开<ChevronRight size={14}/></button></div></> : <><div className="group-caption">{children.length} 个节点 · 拖动标题整体移动</div><button className="group-ungroup nodrag nopan" onClick={() => ungroup(id)}><Ungroup size={13} />取消收纳</button></>}
    </div>
  }
  if(data.extraction&&!data.src)return <>{imageTag}<GenerationPlaceholder task={{...data.extraction,status:data.extraction.itemStatus||data.extraction.status,message:data.extraction.itemMessage||data.extraction.message}} index={data.extraction.index}><Handle type="target" position={Position.Left}/></GenerationPlaceholder></>
  if (data.kind === 'image' && data.pendingResult) {
    return <>{imageTag}<GenerationPlaceholder compactFailure={pendingSource?.tool !== 'tone-skill'} task={pendingJob || { status: 'restoring', message: '正在查询原任务状态，请稍候' }} index={data.pendingResult.index} action={pendingControls}><Handle type="target" position={Position.Left} />{data.imageJob && <Handle type="source" position={Position.Right} />}</GenerationPlaceholder></>
  }
  if (data.kind === 'image') return <div ref={cardRef} style={{'--image-hover-scale':'var(--port-scale, 1)','--image-meta-scale':`min(var(--port-scale, 1), ${width/210})`} as React.CSSProperties} className={['card image clean-image', data.stackLayer ? 'stack-layer' : '', data.stackCrop ? 'stack-cropped' : '', data.skillResult && !data.pendingResult && (!data.imageJob || data.imageOutput) ? 'generation-result' : '', selected ? 'active' : '', data.collapsed ? 'folded-image' : ''].join(' ')}>
    {imageTag}
    {selected && !data.stackLayer && !editing && <span className="image-selection-badge" aria-label="图片已选中"><Check size={12} strokeWidth={2}/></span>}
    {selected && !resizingImage && !data.task && (!data.imageJob || data.imageOutput) && !editing && singleSelected && <ImageToolbar layerMode={data.stackLayer} onSaveAsset={data.extractedAsset?()=>quick('save-asset',id):undefined} assetSaved={data.extractedAsset?.archived} anchor={cardRef} revision={[positionAbsoluteX, positionAbsoluteY, nodeViewport.x, nodeViewport.y, nodeViewport.zoom, data.collapsed].join(':')} onCompare={!data.stackLayer && (data.comparison?.original || data.comparison?.input || data.skillResult?.baseId || data.version?.parentId) ? ()=>quick('compare',id) : undefined} onAction={operation => quick(operation, id)} onDownload={() => data.src && download(data.src, data.label)} />}
    {singleSelected && !data.stackLayer && data.src && !data.task && (!data.imageJob || data.imageOutput) && !editing && <ImageDimensions src={data.src} previewSrc={data.previewSrc} dimensions={data.dimensions}/>}
    <NodeResizer isVisible={singleSelected && (!data.stackLayer || !!data.stackCrop) && !data.collapsed && !editing && !data.task && (!data.imageJob || data.imageOutput)} minWidth={data.stackCrop?12:40} minHeight={data.stackCrop?12:40} keepAspectRatio onResizeStart={() => setResizingImage(true)} onResizeEnd={(_, size) => { setResizingImage(false); update(id, { expandedSize: { width: size.width, height: size.height } }) }} />
    <Handle type="target" position={Position.Left} isConnectable={false} aria-hidden="true" />
    <div className={data.task || data.imageJob && !data.imageOutput ? 'image-body task-input-preview' : 'image-body'}>{data.stackCrop ? <span className="stack-crop-frame" style={{width:data.stackCrop.frameWidth*cropScale,height:data.stackCrop.frameHeight*cropScale,left:-data.stackCrop.x*cropScale,top:-data.stackCrop.y*cropScale}}><CanvasImage src={data.previewSrc || data.src || ''} alt={data.label} width={data.stackCrop.frameWidth*cropScale} height={data.stackCrop.frameHeight*cropScale}/></span> : <CanvasImage src={data.previewSrc || data.src || ''} alt={data.task ? '输入图片预览，尚未生成结果' : data.label} width={width} height={height} />}</div>
    {data.task && <div className="quick-task-state" role="status"><strong>{builtinSkills[data.task.operation].name}</strong><span>旧版任务，请重新发起</span><small>尚未生成 · 底图仅为输入预览</small></div>}
    {data.imageJob && !data.imageOutput && <div className="generation-overlay"><GenerationPlaceholder task={data.imageJob} preview={data.previewSrc || data.src} frame={data.canvasParameters?.frame} operation={data.canvasOperation ? canvasTaskLabels[data.canvasOperation] : undefined} action={<ImageJobControls job={data.imageJob} onChange={imageJob=>update(id,{imageJob})}/>}/></div>}
    {editing?.id === id && <InlineImageEdit key={editing.operation} anchor={cardRef} sourceLabel={data.label} sourceImage={data.previewSrc || data.src} operation={editing.operation} revision={[positionAbsoluteX, positionAbsoluteY, nodeViewport.x, nodeViewport.y, nodeViewport.zoom].join(':')} crop={data.stackCrop} onCancel={cancelEdit} onConfirm={confirmEdit} />}
    <Handle type="source" position={Position.Right} />
  </div>
  if(data.canvasImageNode)return <div className={`image-generator-node ${selected?'active':''}`}>
    <Handle type="target" position={Position.Left}/><span className="generator-ports" aria-hidden="true">·<br/>·<br/>·</span>
    <div className="generator-identity"><span className="generator-icon"><ImagePlus size={32}/></span></div>
    {data.imageJob&&data.imageJob.status!=='complete'&&<div className="generation-overlay"><GenerationPlaceholder task={data.imageJob} action={<ImageJobControls job={data.imageJob} onChange={imageJob=>update(id,{imageJob})}/>}/></div>}
    <NodeResizer isVisible={singleSelected} minWidth={160} minHeight={100}/>
    <Handle type="source" position={Position.Right}/>
  </div>
  return <div ref={cardRef} className={`card ${data.kind} ${selected ? 'active' : ''} ${data.collapsed ? 'folded' : ''}`}>
    {isSkill ? <><Handle type="target" id="base" position={Position.Left} style={{ top: data.collapsed ? 45 : 80 }} /><Handle type="target" id="style" position={Position.Left} style={{ top: data.collapsed ? Math.max(78,45+26/nodeViewport.zoom) : Math.max(148,80+26/nodeViewport.zoom) }} /></> : <Handle type="target" position={Position.Left} />}
    <div className="card-title"><span><Icon size={14} />{data.label}</span><div><input type="checkbox" className="nodrag nopan node-select" aria-label="选择节点" checked={!!selected} onClick={e => e.stopPropagation()} onChange={() => select(id)} />{data.final && <b><Check size={12} /> 定稿</b>}<button className="nodrag nopan fold-button" aria-label={data.collapsed ? '展开节点' : '折叠节点'} onClick={() => toggle(id)}>{data.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div></div>
    {data.tool==='texture-restore' && !data.collapsed ? <TextureRestoreNode inputs={inputs.filter((input):input is Card=>!!input).map(input=>({id:input.id,src:input.data.src!,label:input.data.label,role:allEdges.find(e=>e.target===id&&e.source===input.id)?.targetHandle}))} state={data.textureState||{}} job={data.imageJob} onChange={textureState=>update(id,{textureState})} onJob={imageJob=>update(id,{imageJob,generation:data.textureState?.options||textureDefaults})}/> : data.tool==='platform-upscale' && !data.collapsed ? <UpscaleNode inputs={inputs.filter((input): input is Card => !!input).map(input=>({id:input.id,src:input.data.src!,previewSrc:input.data.previewSrc,label:input.data.label}))} state={data.upscaleState||{}} job={data.imageJob} onChange={upscaleState=>update(id,{upscaleState,skillState:{...data.skillState,baseId:upscaleState.baseId}})} onJob={imageJob=>update(id,{imageJob})}/> : data.tool==='tone-skill' && !data.collapsed ? <ToneSkillNode inputs={inputs.filter((input): input is Card => !!input).map(input=>({id:input.id,src:input.data.src!,label:input.data.label,role:allEdges.find(e=>e.source===input.id)?.targetHandle}))} state={data.toneSettings||{}} onChange={toneSettings=>update(id,{toneSettings})} onResult={(src,toneSettings)=>skillResults(id,crypto.randomUUID(),[{index:0,src,review:{},toneSettings}])}/> : isSkill && !data.collapsed ? <SkillNode localAttention={!!data.imageJob && ['connection_lost','needs_attention','submission_unknown'].includes(data.imageJob.status)} localBusy={!!data.imageJob && !['complete','paused','submit_error'].includes(data.imageJob.status)} localEdit={data.localEdit} onLocalRun={() => quick('run-asset', id)} onAssetEdit={baseId => quick('configure-asset:'+baseId, id)} tool={data.tool!} state={data.skillState || {}} inputs={inputs.filter((input): input is Card => !!input).map(input => ({ id: input.id, src: input.data.src!, previewSrc: input.data.previewSrc, label: input.data.label, role: allEdges.find(edge => edge.target === id && edge.source === input.id)?.targetHandle }))} onChange={skillState => update(id, { skillState })} onResults={(job, images) => skillResults(id, job, images)} /> : data.collapsed ? <div className="folded-summary">{data.src ? <img src={data.previewSrc || data.src} alt={data.label} /> : <span className="folded-icon"><Icon size={21} /></span>}<div><strong>{`${foldedOptions.resolution} · ${foldedOptions.count} 张 · ${foldedOptions.ratio==='auto' ? '沿用底图' : foldedOptions.ratio}`}</strong><small>{foldedStatus} · {foldedModel}</small></div></div> : <div className="tool-body"><div className="node-inputs"><span className="node-section-label">INPUT IMAGES <small>{inputs.length}</small></span><div>{inputs.length ? inputs.map((input, index) => input && <span className="node-reference" key={input.id} title={input.data.label}><img src={input.data.previewSrc || input.data.src} alt={input.data.label} /><b>{index + 1}</b></span>) : <span className="node-input-empty">{data.tool === 'generate' ? '文字创作 · 可连接参考图片' : '从左侧连接点接入图片'}</span>}</div></div><label>处理要求<textarea className="nodrag nopan nowheel" placeholder="描述希望修改的区域、材质或光线…" value={data.prompt || ''} onChange={e => update(id, { prompt: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(id) } }} /></label><div className="node-controls nodrag nopan"><GenerationControls mode={data.tool === 'redraw' || inputs.length ? 'redraw' : 'generate'} placement="node" value={settings} onChange={generation => update(id, { generation })} /></div><button className="primary node-run nodrag nopan" disabled={!!data.imageJob && !['complete','paused','submit_error'].includes(data.imageJob.status)} onClick={() => run(id)}><WandSparkles size={14} />{data.imageJob && !['complete','paused','submit_error'].includes(data.imageJob.status) ? '正在生成…' : '生成图片'}</button></div>}
    <Handle type="source" position={Position.Right} />
  </div>
}

const nodeTypes = { card: memo(CardNode) }
const edgeTypes = { editable: CanvasEdge }
function Workspace() {
  const functionEnabled=useFunctionEnabled()
  const [nodes, setNodes, onNodesChange] = useNodesState<Card>([])
  const marqueeActive=useRef(false)
  const deletedTaskIds=useRef(new Set<string>())
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const flow = useReactFlow<Card>()
  const history = useRef<{ past: GraphCommand[]; future: GraphCommand[]; baseline?: { nodes: Card[]; edges: Edge[] }; applying: boolean }>({ past: [], future: [], applying: false })
  const [historyState, setHistoryState] = useState({ undo: false, redo: false })
  const [name, setName] = useState('未命名视觉项目')
  const [ready, setReady] = useState(false)
  const [loadError,setLoadError]=useState('')
  const [draftPrompt, setDraftPrompt] = useState('')
  const [draftGeneration, setDraftGeneration] = useState<Generation>(defaultGeneration)
  const [draftMode, setDraftMode] = useState<'generate' | 'redraw'>('generate')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'free' | 'skill'>('free')
  const [composerReferenceIds, setComposerReferenceIds] = useState<string[]>([])
  const referenceUpload = useRef(false)
  const draggedReference = useRef<number | null>(null)
  const [directComposerInput, setDirectComposerInput] = useState<string | null>(null)
  const [projectsOpen,setProjectsOpen]=useState(()=>sessionStorage.getItem('canvas-return-projects')==='1')
  useEffect(()=>{sessionStorage.removeItem('canvas-return-projects')},[])
  const [saveStatus, setSaveStatus] = useState('正在读取')
  const persistenceAllowed=useRef(false),hydrationFlow=useRef(flow)
  const restackedFocus=useRef<string | undefined>(undefined)
  const [projectWriter]=useState(()=>latestProjectWriter<Project>(p=>writeCanvasProject(p),state=>setSaveStatus(state==='saved'?'已保存在此浏览器':state==='saving'?'正在保存':'保存失败，请导出备份'),250))
  const [toast, setToast] = useState('')
  const [assetSession, setAssetSession] = useState<AssetSession | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [middlePanning, setMiddlePanning] = useState(false)
  useEffect(() => {
    const release = () => setMiddlePanning(false)
    const mouseUp = (event: MouseEvent) => { if (event.button === 1) release() }
    window.addEventListener('mouseup', mouseUp, true)
    window.addEventListener('blur', release)
    window.addEventListener('pointercancel', release)
    return () => { window.removeEventListener('mouseup', mouseUp, true); window.removeEventListener('blur', release); window.removeEventListener('pointercancel', release) }
  }, [])
  const [showMinimap, setShowMinimap] = useState(false)
  const [editing, setEditing] = useState<{ id: string; operation: BuiltinOperation } | null>(null)
  const avoidanceFrame = useRef<number | null>(null)
  const avoidanceNode = useRef<string | null>(null)
  const cancelAvoidance = useCallback(() => {
    if (avoidanceFrame.current !== null) cancelAnimationFrame(avoidanceFrame.current)
    avoidanceFrame.current = null
    avoidanceNode.current = null
  }, [])
  useEffect(() => cancelAvoidance, [cancelAvoidance])
  useEffect(() => { if (editing) cancelAvoidance() }, [editing, cancelAvoidance])
  const avoidWhileDragging = useCallback((_: unknown, node: Card) => {
    if (editing) return
    avoidanceNode.current = node.id
    if (avoidanceFrame.current !== null) return
    avoidanceFrame.current = requestAnimationFrame(() => {
      avoidanceFrame.current = null
      const id = avoidanceNode.current
      avoidanceNode.current = null
      // Read the latest position; a queued pointer event may already have moved it.
      setNodes(current => {
        const dragged = current.find(item => item.id === id)
        return dragged ? pushNeighbours(current, dragged) : current
      })
    })
  }, [editing, setNodes])
  const finishAvoidance = useCallback((_: unknown, node: Card) => {
    cancelAvoidance()
    if (!editing) setNodes(current => current.some(item => item.id === node.id) ? pushNeighbours(current, node) : current)
  }, [cancelAvoidance, editing, setNodes])
  const [pairComparison,setPairComparison]=useState<{src:string;label:string}[]|null>(null)
  const [toneTarget, setToneTarget] = useState<{id:string;src:string;label:string;epoch:number;skill?:boolean;reference?:string;parameters?:Record<string,unknown>} | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [compareOriginal, setCompareOriginal] = useState<string | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const dragDepth = useRef(0)
  const [menu, setMenu] = useState<{ x: number; y: number; source?: string } | null>(null)
  const [viewport, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const upload = useRef<HTMLInputElement>(null), open = useRef<HTMLInputElement>(null)
  useEffect(()=>{const input=upload.current;const cancel=()=>{referenceUpload.current=false};input?.addEventListener('cancel',cancel);return()=>input?.removeEventListener('cancel',cancel)},[])
  const restoreHistory = useCallback((direction: 'undo' | 'redo') => {
    const h = history.current
    const from = direction === 'undo' ? h.past : h.future
    const command = from.pop()
    if (!command) return
    const graph = applyGraphCommand({ nodes, edges }, command, direction)
    ;(direction === 'undo' ? h.future : h.past).push(command)
    h.applying = true
    setNodes(graph.nodes); setEdges(graph.edges)
    setEditing(null); setMenu(null)
    setHistoryState({ undo: !!h.past.length, redo: !!h.future.length })
  }, [nodes, edges, setNodes, setEdges, setEditing, setMenu])
  const graphEpoch = useRef(0)
  const sending = useRef(new Set<string>())
  const [submittingIds,setSubmittingIds]=useState<Set<string>>(new Set())
  const reconnectSucceeded = useRef(false)
  const reconnectSession = useRef(false)
  const previewImages = previewBatch(nodes, previewId)
  const previewIndex = previewImages.findIndex(n => n.id === previewId)
  const preview = previewImages[previewIndex]
  const previewBase = nodes.find(n => n.id === (preview?.data.skillResult?.baseId || preview?.data.version?.parentId))
  const previewOriginal = preview?.data.comparison?.original || preview?.data.comparison?.input || previewBase?.data.src
  const comparisonVisible = !!previewOriginal && compareOriginal !== preview?.id
  useEffect(()=>{
    const comparePair=(event:KeyboardEvent)=>{
      if(event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return
      const target=event.target as HTMLElement
      if(target.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]')||editing||previewId||pairComparison||assetSession)return
      const selectedImages=nodes.filter(n=>n.selected)
      if(selectedImages.length!==2||selectedImages.some(n=>n.data.kind!=='image'||!n.data.src||n.data.task||n.data.pendingResult||n.data.imageJob&&!n.data.imageOutput))return
      event.preventDefault();event.stopImmediatePropagation()
      setPairComparison(selectedImages.map(n=>({src:n.data.src!,label:n.data.label})))
    }
    window.addEventListener('keydown',comparePair,true)
    return()=>window.removeEventListener('keydown',comparePair,true)
  },[nodes,editing,previewId,pairComparison,assetSession])
  const legacyGeneratorIds = useMemo(() => new Set(nodes.filter(n => n.data.kind === 'tool' && !n.data.canvasImageNode && ['generate','redraw'].includes(n.data.tool || '')).map(n => n.id)), [nodes])
  const selected = nodes.find(n => n.selected && !legacyGeneratorIds.has(n.id))
  const selectedGroups = [...new Set(nodes.filter(n=>n.selected).map(n=>n.data.kind==='group'?n.id:n.parentId).filter((id): id is string=>!!id))]

  const activeTool = nodes.filter(n => n.selected).length === 1 && selected?.data.kind === 'tool' ? selected : undefined
  const orphanedJobs = [...new globalThis.Map<string, NonNullable<Card['data']['pendingResult']>>(nodes.filter(n => n.data.pendingResult).map(n => [n.data.pendingResult!.jobId, n.data.pendingResult!] as const)).values()].filter(p => !nodes.some(n => n.id === p.sourceNode && [n.data.skillState?.jobId, n.data.skillState?.requestId, n.data.imageJob?.id, n.data.imageJob?.requestId].includes(p.jobId)))
  const resultImage = nodes.filter(n => n.selected).length === 1 && selected?.data.kind === 'image' && selected.data.skillResult ? selected : undefined
  const resultSource = nodes.find(n => n.id === resultImage?.data.skillResult?.sourceNode)
  const resultOptions = resultImage?.data.iterationContext?.options || (resultSource?.data.tool === 'style' ? { model: 'doubao-seedream-5-0-pro-260628', resolution: '2K', ratio: 'auto', count: 4, ...resultSource.data.skillState?.options } : resultSource?.data.generation)
  const resultRoute = resultEditing(resultImage?.data || {}, resultSource?.data)
  const resultTool = resultRoute.tool
  // An open composer owns image selection; provenance must not replace its draft.
  const directInput = selected?.id === directComposerInput || composerOpen && selected?.data.kind === 'image' ? selected : undefined
  const skillResultImage = resultImage && resultRoute.skill && editorMode === 'skill' ? resultImage : undefined
  const ordinaryResult = resultImage?.data.src && !resultRoute.skill && !directInput && editorMode === 'skill' ? resultImage : undefined
  const imageGenerator=activeTool?.data.canvasImageNode?activeTool:undefined
  const referenceIds=imageGenerator?[...new Set(edges.filter(e=>e.target===imageGenerator.id).map(e=>e.source))]:composerReferenceIds
  const composerMode = imageGenerator || ordinaryResult ? 'redraw' : draftMode
  const activeSettings = normalizeGeneration(ordinaryResult ? (ordinaryResult.data.refinementDraft?.options || ordinaryResult.data.iterationContext?.options || resultOptions) as Generation : activeTool?.data.generation || draftGeneration)
  const activePrompt = ordinaryResult ? ordinaryResult.data.refinementDraft?.prompt || '' : activeTool ? activeTool.data.prompt || '' : draftPrompt
  function addComposerReferences(images: Card[]) {
    const ids = [...new Set([...referenceIds, ...images.map(n=>n.id)])]
    if (ids.length > 9) { setToast('最多支持 9 张参考图，请先移除部分图片'); return }
    const first = nodes.find(n => n.id === referenceIds[0]) || images.find(n => n.id === images[0]?.id)
    const ratio = first?.data.dimensions ? ratioFromDimensions(first.data.dimensions) : undefined
    if(imageGenerator){
      setEdges(current=>images.reduce((all,n)=>addEdge({id:uid(),source:n.id,target:imageGenerator.id},all),current))
      if (ratio) update(imageGenerator.id, { generation: { ...normalizeGeneration(imageGenerator.data.generation), ratio } })
      return
    }
    setComposerReferenceIds(current=>[...new Set([...current,...images.map(n=>n.id)])].slice(0,9)); setDraftMode('redraw'); setComposerOpen(true)
    if (ratio) setDraftGeneration(current => ({ ...current, ratio }))
  }
  function removeComposerReference(index:number){
    if(imageGenerator)setEdges(current=>current.filter(e=>!(e.target===imageGenerator.id&&e.source===referenceIds[index])))
    else setComposerReferenceIds(ids=>ids.filter((_,i)=>i!==index))
  }
  function moveComposerReference(from: number, to: number) {
    if(imageGenerator){if(to<0||to>=referenceIds.length)return;const ids=[...referenceIds];ids.splice(to,0,ids.splice(from,1)[0]);setEdges(current=>[...current.filter(e=>e.target!==imageGenerator.id),...ids.flatMap(id=>current.filter(e=>e.target===imageGenerator.id&&e.source===id))]);return}

    setComposerReferenceIds(ids=>{if(to<0 || to>=ids.length || from===to)return ids; const next=[...ids];next.splice(to,0,next.splice(from,1)[0]);return next})
  }
  const inputImages = composerMode === 'redraw' ? referenceIds.map(id=>nodes.find(n=>n.id===id)) : []
  const composerJob=imageGenerator?.data.imageJob || ordinaryResult?.data.imageJob
  const composerBusy=!!composerJob&&!['complete','paused','submit_error'].includes(composerJob.status)
  function changeComposerPrompt(prompt: string) { if(imageGenerator)update(imageGenerator.id,{prompt}); else if(ordinaryResult) update(ordinaryResult.id,{refinementDraft:{prompt,options:activeSettings}}); else setDraftPrompt(prompt) }
  function changeComposerSettings(generation: Generation) { if(imageGenerator)update(imageGenerator.id,{generation}); else if(ordinaryResult) update(ordinaryResult.id,{refinementDraft:{prompt:activePrompt,options:generation}}); else setDraftGeneration(generation) }
  const composerExpanded = !!imageGenerator || composerOpen
  const savedReferenceIds = resultImage?.data.iterationContext?.referenceIds || resultSource?.data.skillState?.referenceIds
  const resultReferences = (savedReferenceIds ? savedReferenceIds.map(id => nodes.find(n => n.id === id)) : resultSource ? edges.filter(e => e.target === resultSource.id && (resultTool !== 'style' || e.targetHandle === 'style')).map(e => nodes.find(n => n.id === e.source)) : []).filter((n): n is Card => !!n?.data.src && n.id !== resultImage?.id)

  function clearComposer() {
    setDraftPrompt('')
    setComposerReferenceIds([])
    setDraftMode('generate')
    setDraftGeneration(defaultGeneration)
    setDirectComposerInput(null)
    setEditorMode('free')
  }

  function restoreComposer(node: Card) {
    const source = nodes.find(n => n.id === node.data.pendingResult?.sourceNode) || node
    const context = node.data.iterationContext || (source.data.composerRequest ? {
      tool: source.data.tool || 'generate', prompt: source.data.prompt || '',
      referenceIds: source.data.composerRequest.referenceIds || [], options: source.data.generation || defaultGeneration,
    } : undefined)
    if (resultEditing(node.data, source.data).skill) { setEditorMode('skill'); setComposerOpen(true); return }
    if (!context || !['generate', 'redraw'].includes(context.tool)) return
    setDraftPrompt(context.prompt)
    setDraftGeneration(normalizeGeneration(context.options as Generation))
    setDraftMode(context.tool === 'generate' ? 'generate' : 'redraw')
    setComposerReferenceIds([...context.referenceIds])
    setEditorMode('free')
    setComposerOpen(true)
  }

  const selectionKey=JSON.stringify(nodes.filter(n=>n.selected).map(n=>n.id))
  const selectedIds=useMemo(()=>new Set<string>(JSON.parse(selectionKey)),[selectionKey])
  const focused=useMemo(()=>{
    const adjacency=new globalThis.Map<string,string[]>()
    for(const e of edges){adjacency.set(e.source,[...(adjacency.get(e.source)||[]),e.target]);adjacency.set(e.target,[...(adjacency.get(e.target)||[]),e.source])}
    const seen=new Set(selectedIds)
    for(const n of nodes)if(n.parentId&&selectedIds.has(n.parentId))seen.add(n.id)
    const queue=[...seen]
    for(let i=0;i<queue.length;i++)for(const id of adjacency.get(queue[i])||[])if(!seen.has(id)){seen.add(id);queue.push(id)}
    return seen
  },[edges,selectedIds,nodes])
  // Reference geometry drives empty generator frames; additional references do not change the base frame.
  const generatorFrames = useMemo(() => {
    const lookup = new globalThis.Map(nodes.map(node => [node.id, node]))
    const firstInputs = new globalThis.Map<string, Card>()
    for (const edge of edges) {
      const source = lookup.get(edge.source)
      if (source?.data.src && !firstInputs.has(edge.target)) firstInputs.set(edge.target, source)
    }
    return JSON.stringify(nodes.filter(node => node.data.canvasImageNode).flatMap(node => {
      const source = firstInputs.get(node.id)
      if (!source) return []
      const width = Number(source.style?.width) || source.measured?.width || source.width
      const height = Number(source.style?.height) || source.measured?.height || source.height
      return width && height ? [{ id: node.id, source: source.id, width, height }] : []
    }))
  }, [nodes, edges])
  useEffect(() => {
    const frames = new globalThis.Map((JSON.parse(generatorFrames) as {id:string;width:number;height:number}[]).map(frame => [frame.id, frame]))
    setNodes(current => {
      let changed = false
      const next = current.map(node => {
        const frame = frames.get(node.id)
        if (!frame || node.style?.width === frame.width && node.style?.height === frame.height) return node
        changed = true
        return {...node, width:frame.width, height:frame.height, style:{...node.style,width:frame.width,height:frame.height}}
      })
      return changed ? next : current
    })
  }, [generatorFrames, setNodes])
  const { displayNodes, visibleEdges } = useMemo(() => {
  const nodeLookup = new globalThis.Map(nodes.map(n=>[n.id,n]))
  const foldedParent = (id: string) => { const n = nodeLookup.get(id); return n?.parentId && nodeLookup.get(n.parentId)?.data.collapsed ? n.parentId : undefined }
  // Hidden nodes stay in the graph store but unmount their canvas UI. Task monitors live above ReactFlow.
  const groupsWithChildren = new Set(nodes.map(n=>n.parentId).filter((id): id is string=>!!id))
  const displayNodes = nodes.map(n => legacyGeneratorIds.has(n.id) ? { ...n, hidden: true, selected: false } : foldedParent(n.id) ? { ...n, hidden: true, extent: undefined, expandParent: false, selected: false, selectable: false, draggable: false } : n.data.kind==='group' ? {...n,deletable:!groupsWithChildren.has(n.id)} : n)
  const taskRunning = (data?: Card['data']) => {
    if (!data || data.kind==='image' && data.src && !data.pendingResult) return false
    const task = data.pendingResult ? pendingTask<ImageJobState | SkillState>(data.pendingResult.jobId,nodeLookup.get(data.pendingResult.sourceNode)?.data,data.pendingResult.task) : data.extraction || data.imageJob || data.skillState || data.task
    const status = data.extraction?.itemStatus || task?.status
    if(task && 'monitoringStopped' in task && task.monitoringStopped)return false
    return !!status && ['preparing','analyzing','locating','composing','uploading','submitting','queued','running','generating','processing','download_pending'].includes(status)
  }
  let animatedConnections = 0
  const visibleEdges: Edge[] = edges.map(edge => {
    const projected=groupConnection(edge,nodeLookup,focused,selectedIds,legacyGeneratorIds)
    const transmitting=projected.source===edge.source&&projected.target===edge.target&&(taskRunning(nodeLookup.get(edge.target)?.data)||taskRunning(nodeLookup.get(edge.source)?.data))&&!projected.hidden&&animatedConnections++<48
    return {...projected,type:'editable',data:edge.data?{...edge.data,transmitting}:transmitting?activeConnectionData:idleConnectionData}
  })
  return { displayNodes, visibleEdges }
  }, [nodes, edges, focused, selectedIds, legacyGeneratorIds])
  useEffect(() => { let active = true; readCanvasProject().then(raw => { if (!active) return; if (raw) { const saved=raw as Project;restackedFocus.current=saved.nodes?.find(n=>n.data?.kind==='group'&&!n.data.layerStack&&saved.nodes.some(child=>child.parentId===n.id&&child.data?.skillResult?.review?.layer))?.id;const p = validate(raw); setNodes(p.nodes.map(n => n.data.skillResult ? { ...n, data: { ...n.data, provenanceLinked: true } } : n)); setEdges([...p.edges, ...p.nodes.filter(n => !n.data.provenanceLinked && n.data.skillResult && n.data.skillResult.sourceNode !== n.id && p.nodes.some(source => source.id === n.data.skillResult!.sourceNode) && !p.edges.some(e => e.id === `result-${n.id}` || e.source === n.data.skillResult!.sourceNode && e.target === n.id)).map(n => ({ id: `result-${n.id}`, source: n.data.skillResult!.sourceNode, target: n.id }))]); setName(p.name); setComposerReferenceIds(Array.isArray(p.draft?.referenceIds) ? [...new Set(p.draft.referenceIds.filter(id=>typeof id==='string'))].slice(0,9) : []); setDraftPrompt(p.draft?.prompt || ''); setDraftGeneration(normalizeGeneration(p.draft?.generation)); setDraftMode(p.draft?.mode === 'redraw' ? 'redraw' : 'generate'); setViewportState(p.viewport); void hydrationFlow.current.setViewport(p.viewport) } persistenceAllowed.current=true }).catch((error:unknown) => { if (active) {const reason=error instanceof Error?error.message:'未知读取错误';setLoadError(reason);setToast('本地项目读取失败：'+reason+'；已暂停自动保存，原记录未覆盖');setSaveStatus('读取失败：'+reason+'，自动保存已暂停')} }).finally(() => { if (active) setReady(true) }); return () => { active = false } }, [setNodes, setEdges])
  useEffect(() => {
    if(!ready||projectsOpen||!persistenceAllowed.current||nodes.some(n=>n.dragging||n.resizing))return
    projectWriter.enqueue({format:'visproj',schemaVersion:1,name,nodes,edges,viewport,draft:{prompt:draftPrompt,generation:draftGeneration,mode:draftMode,referenceIds:composerReferenceIds}})
  },[nodes,edges,name,ready,viewport,draftPrompt,draftGeneration,draftMode,composerReferenceIds,projectWriter,projectsOpen])
  useEffect(()=>{
    const flush=()=>{void projectWriter.flush()}
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(projectWriter.dirty()){flush();event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pagehide',flush)
    return ()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pagehide',flush);flush()}
  },[projectWriter])
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); setPreviewId(null);setPairComparison(null) } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  useEffect(() => {
    if (!ready) return
    const h = history.current, graph = { nodes, edges }
    if (h.applying || !h.baseline) { h.baseline = graph; h.applying = false; return }
    if (nodes.some(n => n.dragging || n.resizing)) return
    const command = graphCommand(h.baseline, graph)
    h.baseline = graph
    if (!command) return
    h.past.push(command)
    if (h.past.length > 50) h.past.shift()
    h.future = []
    setHistoryState({ undo: true, redo: false })
  }, [nodes, edges, ready])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || !(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') { event.preventDefault(); restoreHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo') }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [restoreHistory])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer) }, [toast])
  useEffect(() => { if(nodes.some(n=>n.dragging||n.resizing))return;const old=nodes.find(n=>n.data.kind==='group'&&!n.data.layerStack&&nodes.some(child=>child.parentId===n.id&&child.data.skillResult?.review?.layer));if(ready&&old)restackedFocus.current=old.id;setNodes(current => fitGroupNodes(restackLayerGroups(current))) }, [nodes, ready, setNodes])
  useEffect(()=>{const id=restackedFocus.current;if(!ready||!id)return;const group=nodes.find(n=>n.id===id&&n.data.layerStack);if(!group)return;restackedFocus.current=undefined;const sourceId=nodes.find(n=>n.parentId===id)?.data.version?.parentId;const targets=sourceId&&nodes.some(n=>n.id===sourceId)?[{id:sourceId},{id}]:[{id}];requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.fitView({nodes:targets,padding:{top:'90px',bottom:'140px',left:'90px',right:'90px'},maxZoom:1,duration:250})}))},[ready,nodes,flow])
  useEffect(() => {
    if (!ready) return
    setNodes(current => {
      if (!current.some(n => n.data.kind === 'image' && !n.data.imagePresentationVersion)) return current
      return current.map(n => {
        if (n.data.kind !== 'image' || n.data.imagePresentationVersion) return n
        const dimensions = n.data.dimensions?.match(/(\d+)\s*×\s*(\d+)/)
        const width = Number(n.style?.width) || n.measured?.width || 340
        const ratio = dimensions && Number(dimensions[1]) > 0 ? Number(dimensions[2]) / Number(dimensions[1]) : Math.max(1, (Number(n.style?.height) || 340) - 78) / width
        const expandedWidth = n.data.expandedSize?.width || width
        return { ...n, style: { ...n.style, height: width * ratio }, data: { ...n.data, imagePresentationVersion: 1, expandedSize: n.data.expandedSize ? { width: expandedWidth, height: expandedWidth * ratio } : undefined } }
      })
    })
  }, [ready, nodes, setNodes])
  useEffect(()=>{
    if(!ready||nodes.some(n=>n.dragging||n.resizing))return
    const synced=syncMaterialReferences(nodes,edges)
    if(synced.nodes!==nodes)setNodes(synced.nodes)
    if(synced.edges!==edges)setEdges(synced.edges)
  },[ready,nodes,edges,setNodes,setEdges])
  useEffect(()=>{
    if(!ready)return
    setNodes(current=>current.some(n=>n.data.tool==='light'&&!n.data.collapsed&&Number(n.style?.width)<680)?current.map(n=>n.data.tool==='light'&&!n.data.collapsed&&Number(n.style?.width)<680?{...n,style:{...n.style,width:680}}:n):current)
  },[ready,setNodes])
  useEffect(()=>{
    const aliases=nodes.flatMap(n=>n.data.tool==='texture-restore'&&n.data.imageJob?.id?(n.data.imageJob.aliasJobIds||[]).map(alias=>({alias,canonical:n.data.imageJob!.id!})):[])
    if(!aliases.length)return
    const merged=mergeTaskAliases(nodes,edges,aliases)
    if(merged.nodes!==nodes)setNodes(merged.nodes)
    if(merged.edges!==edges)setEdges(merged.edges)
  },[nodes,edges,setNodes,setEdges])
  function update(id: string, data: Partial<Card['data']>) { if([data.imageJob?.id,data.imageJob?.requestId,data.skillState?.jobId,data.skillState?.requestId].some(job=>job&&deletedTaskIds.current.has(job)))return; setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)) }
  const reserveBatch = useCallback((current: Card[], source: Card, job: string, count: number): Card[] => {
    const missing=Array.from({length:count},(_,i)=>i).filter(i=>!current.some(n=>n.id===`skill-${job}-${i}`))
    if(!missing.length)return current
    const options = source.data.skillState?.options || source.data.generation
    const base = current.find(n => n.id === source.data.skillState?.baseId) || current.find(n => n.id === edges.find(e => e.target === source.id && e.targetHandle !== 'style')?.source)
    const dimensions = base?.data.dimensions?.match(/(\d+)\s*×\s*(\d+)/)
    const ratio = options?.ratio && options.ratio !== 'auto' ? options.ratio.split(':').map(Number) : dimensions ? [Number(dimensions[1]), Number(dimensions[2])] : [3, 4]
    const at = nextBatchPosition(source.id, current, {count,height:340 * ratio[1] / ratio[0]})
    return [...current, ...missing.map((index,offset): Card => ({ id: `skill-${job}-${index}`, type: 'card', position: { x: at.x + offset * 380, y: at.y }, style: { width: 340, height: 340 * ratio[1] / ratio[0] }, data: { kind: 'image', label: `生成中 ${index + 1}`, generatedSkill: imageOperationName(source.data) || '图像', imagePresentationVersion: 1, localEdit: source.data.localEdit, pendingResult: { jobId: job, sourceNode: source.id, index, endpoint: source.data.tool === 'style' ? 'style' : 'images' } } }))]
  }, [edges])
  useEffect(() => {
    if (!ready) return
    const batches = nodes.filter(n => !n.data.composerRequest && (n.data.kind === 'tool' || n.data.kind === 'image' && (n.data.skillState?.jobId || n.data.skillState?.requestId || n.data.imageOutput && (n.data.imageJob?.id || n.data.imageJob?.requestId)))).map(source => ({ source, job: source.data.skillState?.jobId || source.data.skillState?.requestId || source.data.imageJob?.id || source.data.imageJob?.requestId, status: source.data.skillState?.status || source.data.imageJob?.status, count: source.data.skillState?.options?.count || (['style','light'].includes(source.data.tool||'') ? 4 : source.data.generation?.count || 1) })).filter(b => b.job && !['complete', 'paused', 'submit_error'].includes(b.status || '') && Array.from({length:b.count},(_,i)=>`skill-${b.job}-${i}`).some(id=>!nodes.some(n=>n.id===id)))
    if (!batches.length) return
    setNodes(current => batches.reduce((all, batch) => reserveBatch(all, batch.source, batch.job!, batch.count), current))
    setEdges(current => batches.reduce((all, batch) => [...all, ...Array.from({ length: batch.count }, (_, index) => ({ id: `result-skill-${batch.job}-${index}`, source: batch.source.id, target: `skill-${batch.job}-${index}` })).filter(edge => !all.some(e => e.id === edge.id))], current))
  }, [nodes, ready, setNodes, setEdges, reserveBatch])
  async function skillResults(id: string, job: string, images: SkillResult[]) {
    if(deletedTaskIds.current.has(job))return
    const epoch = graphEpoch.current
    const source = nodes.find(n => n.id === id)
    if (!source) return
    const baseId = source.data.upscaleState?.baseId || source.data.skillResult?.baseId || source.data.skillState?.baseId || edges.find(edge => edge.target === id && edge.targetHandle !== 'style')?.source
    const input = source.data.composerRequest?.id === job ? source.data.composerRequest.input?.src : source.data.kind === 'image' ? source.data.src : nodes.find(n => n.id === (source.data.skillState?.baseId || baseId))?.data.src
    const versionParent = (source.data.canvasOperation ? nodes.find(n=>n.id===baseId):undefined) || nodes.find(n=>n.id===source.data.composerRequest?.input?.id) || (source.data.kind==='image'?source:nodes.find(n=>n.id===(source.data.skillState?.baseId || baseId)))
    const original = source.data.comparison?.original || nodes.find(n => n.id === baseId)?.data.comparison?.original || nodes.find(n => n.id === baseId)?.data.src || input
    const comparison = source.data.textureState?.base ? {original:source.data.textureState.base} : source.data.tool === 'platform-upscale' && input ? { original: input } : source.data.toneSettings?.base ? {original:source.data.toneSettings.base} : original ? { original, input } : undefined
    const results: Card[] = []
    for (const result of images) {
      const img = new Image(); img.src = result.src
      try { await img.decode() } catch { continue }
      results.push({ id: `skill-${job}-${result.index}`, type: 'card', position: { x: 0, y: 0 }, style: { width: 340, height: 340 * img.naturalHeight / img.naturalWidth }, data: { kind: 'image', generatedSkill: imageOperationName(source.data) || '图像', src: result.src, toneSettings: result.toneSettings, label: `${source.data.canvasOperation ? builtinSkills[source.data.canvasOperation].name : source.data.localEdit ? source.data.localEdit.kind === 'material' ? '材质优化' : '模型替换' : source.data.tool === 'texture-restore' ? '图片重绘' : source.data.tool === 'tone-skill' ? '场景调色' : source.data.tool === 'style' ? '风格转换' : source.data.tool === 'light' ? '光影优化' : '生图结果'} ${result.index + 1}`, dimensions: `${img.naturalWidth} × ${img.naturalHeight}`, version:{parentId:versionParent?.id,parentLabel:versionParent?.data.label,revision:(versionParent?.data.version?.revision || 0)+1}, imagePresentationVersion: 1, provenanceLinked: true, comparison: result.toneSettings?.base ? {original:result.toneSettings.base} : comparison, localEdit: source.data.localEdit, iterationContext: { modification: source.data.submittedRefinement?.jobId===job ? source.data.submittedRefinement.prompt : undefined, lighting: source.data.skillState?.lighting, tool: source.data.tool || 'redraw', prompt: source.data.localEdit?.supplement || source.data.skillState?.supplement || source.data.prompt || '', referenceIds: source.data.skillState?.referenceIds || (source.data.composerRequest ? source.data.composerRequest.referenceIds || (source.data.composerRequest.input ? [source.data.composerRequest.input.id] : []) : edges.filter(e => e.target === id && e.targetHandle === 'style').map(e => e.source)), options: source.data.skillState?.options || (source.data.tool === 'style' ? { model: 'doubao-seedream-5-0-pro-260628', resolution: '2K', ratio: 'auto', count: 4 } : source.data.generation || defaultGeneration) }, skillResult: { jobId: job, sourceNode: id, baseId, review: result.review } } })
    }
    if(epoch !== graphEpoch.current)return
    if(images.some(result=>result.review?.layer) && results.length){
      if(source.data.kind==='group')return
      setNodes(current=>{
        if(!current.some(n=>n.id===id))return current
        const width=results.length*360+20,height=Math.max(...results.map(r=>Number(r.style?.height)||340))+80
        const children=results.map((r,index)=>({...r,parentId:id,extent:'parent' as const,position:{x:20+index*360,y:50},data:{...r.data,label:images[index].review.layer}}))
        return restackLayerGroups([...current.map(n=>n.id===id?{...n,style:{width,height},deletable:false,dragHandle:'.group-heading',data:{kind:'group' as const,label:'多图层 · 原图坐标透明图层',collectionManaged:true,expandedSize:{width,height}}}:n).filter(n=>!children.some(c=>c.id===n.id)),...children])
      })
      // The generation tool is now the visual layer group, so its old workflow
      // handles and pending result edges no longer have endpoints.
      setEdges(current=>current.filter(edge=>edge.source!==id&&edge.target!==id&&!results.some(result=>edge.source===result.id||edge.target===result.id)))
      return
    }
    if(deletedTaskIds.current.has(job))return
    const inline = source.data.kind === 'image' && source.data.imageJob && (!source.data.imageOutput || source.data.skillResult?.jobId === job)
    const firstResult=results.find(result=>result.id===`skill-${job}-0`)
    const targets = inline ? results.filter(result=>result!==firstResult) : results
    setEdges(current => [...current, ...targets.filter(result => !nodes.some(n => n.id === result.id) && !current.some(edge => edge.id === `result-${result.id}`)).map(result => ({ id: `result-${result.id}`, source: id, target: result.id }))])
    setNodes(current => {
      let next = current
      if (inline && firstResult) {
        const first = firstResult
        next = next.map(n => n.id === id ? { ...n, style: { ...n.style, height: Number(n.style?.width || 340) * Number(first.style?.height) / 340 }, data: { ...resultData(n.data, first.data), imageOutput: true, skillResult: { jobId: job, sourceNode: id, baseId, review: first.data.skillResult?.review || {} } } } : n)
      }
      const missing = targets.filter(result => !next.some(n => n.id === result.id))
      const at = missing.length ? nextBatchPosition(id, next, {count:missing.length,height:Math.max(...missing.map(r=>Number(r.style?.height)||454))}) : { x: 0, y: 0 }
      next = next.map(n => {
        const result = targets.find(r => r.id === n.id)
        if (!result) return n
        return { ...n, data: resultData(n.data, result.data), style: n.data.pendingResult ? result.style : n.style }
      })
      return [...next, ...missing.map((result, index) => ({ ...result, position: { x: at.x + index * 380, y: at.y } }))]
    })
  }
  function locateLayer(id:string){
    const ancestors=new Set<string>();let parent=nodes.find(n=>n.id===id)?.parentId
    while(parent&&!ancestors.has(parent)){ancestors.add(parent);parent=nodes.find(n=>n.id===parent)?.parentId}
    const next=fitGroupNodes(nodes.map(n=>{
      if(!ancestors.has(n.id)||!n.data.collapsed)return {...n,selected:n.id===id}
      const size=n.data.expandedSize||{width:500,height:400}
      return {...n,selected:false,width:size.width,height:size.height,style:{...n.style,width:size.width,height:size.height},data:{...n.data,collapsed:false}}
    }))
    const target=next.find(n=>n.id===id);if(!target)return
    setNodes(next)
    const position=absolutePosition(id,next)
    // Use graph coordinates, including parent offsets, even before an offscreen node is mounted.
    const surface=document.querySelector('.canvas-surface .react-flow')?.getBoundingClientRect();if(!surface)return
    const viewport=getViewportForBounds({...position,width:Number(target.style?.width)||target.measured?.width||340,height:Number(target.style?.height)||target.measured?.height||420},surface.width,surface.height,.15,1,.3)
    void flow.setViewport(viewport,{duration:300})
  }
  function toggleNode(id: string) {
    if(nodes.find(n=>n.id===id)?.data.layerStack){setToast('图层已叠在同一张图上，点击上方「多图层结果」可选择独立 PNG');return}
    setNodes(ns => {const expanding=ns.find(n=>n.id===id)?.data.collapsed;const next=ns.map(n => {
      if (n.id !== id) return n
      if (n.data.kind === 'group') { const size = n.data.expandedSize || { width: Number(n.style?.width) || n.measured?.width || 500, height: Number(n.style?.height) || n.measured?.height || 400 }; return { ...n, width: n.data.collapsed ? size.width : 280, height: n.data.collapsed ? size.height : 330, style: { ...n.style, width: n.data.collapsed ? size.width : 280, height: n.data.collapsed ? size.height : 330 }, data: { ...n.data, collectionManaged: true, collapsed: !n.data.collapsed, expandedSize: size } } }
      const size = n.data.expandedSize || { width: n.measured?.width || Number(n.style?.width) || 350, height: n.measured?.height || Number(n.style?.height) || 420 }
      return { ...n, style: n.data.collapsed ? { ...n.style, width: size.width, height: n.data.kind === 'image' ? size.height : undefined } : { ...n.style, width: n.data.kind === 'image' ? 230 : 300, height: n.data.kind === 'image' ? 230 * (size.height / size.width) : 112 }, data: { ...n.data, collapsed: !n.data.collapsed, expandedSize: n.data.collapsed ? size : { width: n.measured?.width || size.width, height: n.measured?.height || size.height } } }
    });return expanding?avoidExpandedOverlap(next,id):next})
  }
  function groupSelection() {
    const collapsed = true
    try {
      const chosen = nodes.filter(n => n.selected), bounds = groupBounds(chosen)
      const id = uid(), selectedIds = new Set(chosen.map(n => n.id))
      const group: Card = { id, type: 'card', position: { x: bounds.x, y: bounds.y }, style: { width: collapsed ? 280 : bounds.width, height: collapsed ? 330 : bounds.height }, selected: true, deletable: false, dragHandle: '.group-heading', data: { kind: 'group', label: '收纳卡片', collectionManaged: true, collapsed, expandedSize: { width: bounds.width, height: bounds.height } } }
      setNodes(ns => [group, ...ns.map(n => selectedIds.has(n.id) ? { ...n, parentId: id, extent: 'parent' as const, expandParent: true, selected: false, position: { x: n.position.x - bounds.x, y: n.position.y - bounds.y } } : { ...n, selected: false })])
      setToast('已收拢选中节点，展开后显示收纳范围')
    } catch (error) { setToast(error instanceof Error ? error.message : '创建分组失败') }
  }
  const foldShortcut = useRef<() => void>(() => {})
  useEffect(() => {
    foldShortcut.current = () => {
      if (editing) return
      const chosen = nodes.filter(n => n.selected)
      if (!chosen.length) { setToast('请先选中需要收拢的节点或卡片组'); return }
      if (chosen.length === 1) toggleNode(chosen[0].id)
      else if (chosen.every(n => n.data.kind === 'group')) chosen.forEach(n => toggleNode(n.id))
      else groupSelection()
    }
  })
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'g' || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      if (!event.repeat) foldShortcut.current()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
  const arrangeSelection=useCallback((action:Arrangement)=>setNodes(current=>arrangeCanvas(current,action)),[setNodes])
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{
    if(!event.altKey||!event.shiftKey||event.ctrlKey||event.metaKey||event.isComposing||editing||previewId||assetSession)return
    if((event.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]'))return
    const map:Record<string,Arrangement>={h:'row'},action=map[event.key]||map[event.key.toLowerCase()]
    if(action){event.preventDefault();if(!event.repeat)arrangeSelection(action)}
  };window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[arrangeSelection,editing,previewId,assetSession])
  function ungroup(id: string) { const stack=!!nodes.find(n=>n.id===id)?.data.layerStack;setNodes(ns => {
    const group=ns.find(n=>n.id===id)
    const detached=detachGroup(id,ns)
    if(!group?.data.layerStack)return detached
    const layers=ns.filter(n=>n.parentId===id)
    const width=Number(group.style?.width)||340
    return detached.map(n=>{
      const index=layers.findIndex(layer=>layer.id===n.id)
      return index<0?n:{...n,selected:false,zIndex:undefined,position:{x:group.position.x+index*(width+40),y:group.position.y},data:{...n.data,stackLayer:false,layerIndex:undefined}}
    })
  }); setToast(stack?'图层已分开到画布，可分别移动和编辑':'已取消收纳，节点恢复自由摆放，位置和连线保持不变') }
  function addTool(toolId: string, at?: { x: number; y: number }, sourceId?: string, configuration?: Partial<Card['data']>) {
    if(!functionEnabled(toolId)){setToast('此功能已由管理员关闭');return}
    if (['generate','redraw'].includes(toolId)) {
      const input=nodes.find(n=>n.id===sourceId&&n.data.src)
      const id=uid(),position=toolPlacement(input?.id,nodes,at,flow.screenToFlowPosition({x:window.innerWidth/2,y:window.innerHeight/2}))
      const ratio = input?.data.dimensions ? ratioFromDimensions(input.data.dimensions) : draftGeneration.ratio
      setNodes(current=>[...current.map(n=>({...n,selected:false})),{id,type:'card',position,selected:true,style:{width:340,height:210},data:{kind:'tool',canvasImageNode:true,label:'图像',tool:toolId,prompt:'',generation:{...draftGeneration,ratio}}}])
      if(input)setEdges(current=>addEdge({id:uid(),source:input.id,target:id},current))
      setEditorMode('free');setDraftMode('redraw');setComposerOpen(true);setEditing(null);setMenu(null)
      return id
    }
    const t = sidebarTools.find(t => t.id === toolId)!
    const source = nodes.find(n => n.id === sourceId)
    const id = uid(); const position = toolPlacement(source?.id,nodes,at,flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
    setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), { id, type: 'card', position, selected: true, style: { width: toolId==='light'?680:skillIds.includes(toolId) ? 370 : 350 }, data: { kind: 'tool', label: t.name, tool: t.id, prompt: '', generation: { ...draftGeneration, ...(toolId==='platform-upscale'?{count:1}:{}), ...(['material','furniture'].includes(toolId) ? {model:'doubao-seedream-5-0-pro-260628',count:4} : {}) }, ...configuration } }])
    if (sourceId) setEdges(es => addEdge({ id: uid(), source: sourceId, target: id, targetHandle: ['style','tone-skill','texture-restore'].includes(toolId) ? 'base' : undefined }, es))
    setMenu(null)
    if(!at && source && skillIds.includes(toolId)) requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.fitView({nodes:[{id:source.id},{id}],padding:{top:'90px',bottom:'120px',left:'90px',right:'90px'},maxZoom:1,duration:250})}))
    return id
  }
  async function importImages(files: FileList | File[], at?: { x: number; y: number }) {
    const origin = at || flow.screenToFlowPosition({ x: 420, y: 180 })
    const added: Card[] = []
    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) { setToast('单张图片请控制在 25MB 以内'); continue }
      try {
        const {src, previewSrc, width, height} = await prepareUploadedImage(f)
        added.push({ id: uid(), type: 'card', position: { x: origin.x + added.length * 390, y: origin.y }, style: { width: 340, height: 340 * height / width }, data: { kind: 'image', imagePresentationVersion: 1, label: f.name, src, previewSrc, dimensions: `${width} × ${height}` } })
      } catch (error) { setToast(`${f.name}：${error instanceof Error ? error.message : "无法读取图片"}`) }
    }
    if (!added.length) { referenceUpload.current=false; return }
    if(referenceUpload.current&&imageGenerator){referenceUpload.current=false;setNodes(ns=>[...ns,...added]);addComposerReferences(added);return}
    if(referenceUpload.current){referenceUpload.current=false;addComposerReferences(added)}
    // File imports are independent assets; selection is not a connection request.
    setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...added.map(n => ({ ...n, selected: true }))])
    setDraftMode('redraw')
  }
  const clipboardHandlers=useRef<{copy:(e:ClipboardEvent)=>void;paste:(e:ClipboardEvent)=>void}>({copy:()=>{},paste:()=>{}})
  const pasteCount=useRef(0)
  function copyImageToSystem(src:string,text:string) {
    setToast('正在复制原图…')
    void writeImageClipboard(src,text).then(()=>{pasteCount.current=0;setToast('图片已复制，可切到 Figma 按 Ctrl+V 粘贴')}).catch(()=>setToast('图片复制失败，请保持页面聚焦，并允许剪贴板访问后重试'))
  }
  useEffect(()=>{
    const blocked=(event:ClipboardEvent)=>editing||previewId||assetSession&&assetSession.mode!=='browse'||(event.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],.asset-workspace')
    clipboardHandlers.current={copy:event=>{
      if(blocked(event)||window.getSelection()?.toString())return
      const graph=copyCanvasImages(nodes,edges)
      if(!graph.nodes.length||!event.clipboardData)return
      if(graph.nodes.length===1){event.preventDefault();copyImageToSystem(String(graph.nodes[0].data.src),JSON.stringify({format:'visual-canvas-clipboard',version:1,...graph}));return}
      try{
        const text=JSON.stringify({format:'visual-canvas-clipboard',version:1,...graph})
        event.preventDefault();setToast(`正在复制 ${graph.nodes.length} 张图片…`)
        void writeMultipleImagesClipboard(graph.nodes.map(n=>({src:String(n.data.src),label:String(n.data.label||'图片'),x:n.position.x,y:n.position.y,width:Number(n.style?.width)||n.measured?.width||300,height:Number(n.style?.height)||n.measured?.height||300})),text)
          .then(()=>{pasteCount.current=0;setToast(`已复制 ${graph.nodes.length} 张图片，可粘贴到画板或 Figma`)})
          .catch(()=>setToast('多图复制失败，请减少图片数量并允许剪贴板访问后重试'))
      }catch{setToast('图片复制失败，请重试')}
    },paste:event=>{
      if(blocked(event)||!event.clipboardData)return
      const data=event.clipboardData,custom=data.getData('application/x-visual-canvas'),text=custom||data.getData('text/plain')
      const main=document.querySelector('main')!.getBoundingClientRect(),center=flow.screenToFlowPosition({x:main.left+main.width/2,y:main.top+main.height/2})
      if(custom||text.startsWith('{"format":"visual-canvas-clipboard"')){
        event.preventDefault()
        try{if(text.length>150*1024*1024)throw Error('复制内容过大');const raw=JSON.parse(text);if(raw.format!=='visual-canvas-clipboard'||raw.version!==1)throw Error('剪贴板格式不支持');const project=validate({format:'visproj',schemaVersion:1,name:'Clipboard',nodes:raw.nodes,edges:raw.edges,viewport:{x:0,y:0,zoom:1}});const clean=copyCanvasImages(project.nodes,project.edges);if(!clean.nodes.length)return;const offset=(pasteCount.current++%8)*28;const graph=pasteCanvasImages(clean,{x:center.x-170+offset,y:center.y-120+offset},uid);setNodes(current=>[...current.map(n=>({...n,selected:false})),...graph.nodes]);setEdges(current=>[...current,...graph.edges]);setToast(`已粘贴 ${graph.nodes.length} 张图片`)}catch(error){setToast(error instanceof Error?error.message:'无法粘贴画布图片')}
        return
      }
      const files=Array.from(data.items).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((file):file is File=>!!file)
      if(files.length){
        event.preventDefault()
        void readClipboardGraph().then(text=>{
          if(text){
            try{
              if(text.length>150*1024*1024)throw Error('复制内容过大')
              const raw=JSON.parse(text)
              if(raw.format!=='visual-canvas-clipboard'||raw.version!==1)throw Error('格式不支持')
              const project=validate({format:'visproj',schemaVersion:1,name:'Clipboard',nodes:raw.nodes,edges:raw.edges,viewport:{x:0,y:0,zoom:1}})
              const clean=copyCanvasImages(project.nodes,project.edges)
              if(!clean.nodes.length)throw Error('没有图片')
              const offset=(pasteCount.current++%8)*28
              const graph=pasteCanvasImages(clean,{x:center.x-170+offset,y:center.y-120+offset},uid)
              setNodes(current=>[...current.map(n=>({...n,selected:false})),...graph.nodes])
              setEdges(current=>[...current,...graph.edges]);setToast(`已粘贴 ${graph.nodes.length} 张图片`);return
            }catch{ /* Fall back to the PNG if custom data cannot be restored. */ }
          }
          void importImages(files,center)
        })
      }
    }}
  })
  useEffect(()=>{const copy=(event:ClipboardEvent)=>clipboardHandlers.current.copy(event),paste=(event:ClipboardEvent)=>clipboardHandlers.current.paste(event);window.addEventListener('copy',copy);window.addEventListener('paste',paste);return()=>{window.removeEventListener('copy',copy);window.removeEventListener('paste',paste)}},[])
  function openAssets(mode: AssetSession['mode'], kind: 'material' | 'model', sourceId?: string, nodeId?: string) {
    const source = nodes.find(n => n.id === sourceId)
    if (mode !== 'browse' && !source?.data.src) { setToast('请先选中一张底图'); return }
    const owner=nodes.find(n=>n.id===nodeId)
    if(mode==='browse')setPanelOpen(false)
    setAssetSession({ mode, kind, nodeId, recipe: owner?.data.localEdit ? {...owner.data.localEdit,supplement:owner.data.skillState?.supplement ?? owner.data.localEdit.supplement} : undefined, options: owner ? normalizeGeneration((owner.data.skillState?.options || owner.data.generation) as Generation) : undefined, source: source?.data.src ? { id:source.id,image:source.data.src,label:source.data.label } : undefined })
    setMenu(null)
  }
  function extractionState(state:ExtractionSnapshot){
    const task=nodes.find(n=>n.data.extraction?.id===state.id)?.data.extraction
    setNodes(current=>applyExtractionState(current,state))
    if(task?.sourceId&&nodes.some(n=>n.id===task.sourceId)&&state.items?.length)setEdges(current=>{
      const added=state.items!.map((_,index)=>({id:`result-extract-${state.id}-${index}`,source:task.sourceId!,target:`extract-${state.id}-${index}`}))
      return [...current,...added.filter((e,index)=>(index>=(task.plannedCount||1)||nodes.some(n=>n.id===e.target))&&!current.some(old=>old.id===e.id))]
    })
    if(['complete','paused'].includes(state.status))for(const kind of ['material','model','person'])if(sessionStorage.getItem('canvas-extraction-'+kind)===state.id)sessionStorage.removeItem('canvas-extraction-'+kind)
  }
  function beginExtraction(sourceId:string,kind:'material'|'model'|'person',focus:string){
    const source=nodes.find(n=>n.id===sourceId)
    if(!source?.data.src)return
    const id=uid(),position=nextBatchPosition(sourceId,nodes),count=kind==='person'?2:Math.min(6,Math.max(1,focus.split(/[\s、,，;；]+/).filter(Boolean).length)),createdAt=new Date().toISOString()
    const added:Card[]=Array.from({length:count},(_,index)=>({id:`extract-${id}-${index}`,type:'card',position:{x:position.x+index*380,y:position.y},style:{width:340,height:340},data:{kind:'image',label:'资产提取',imagePresentationVersion:1,extraction:{id,index,plannedCount:count,sourceId,kind,focus,status:'analyzing',message:'正在识别对象与可复用材质',createdAt}}}))
    sessionStorage.setItem('canvas-extraction-'+kind,id)
    setNodes(current=>[...current.map(n=>({...n,selected:false})),...added]);setEdges(current=>[...current,...added.map(n=>({id:`result-${n.id}`,source:sourceId,target:n.id}))]);setAssetSession(null)
    requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.fitView({nodes:added,padding:.25,maxZoom:1,duration:250})}))
    void fetch(kind==='person'?'/api/skills/assets/person/tasks':'/api/skills/assets/extract/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,base:source.data.src,kind,focus,placement:'canvas'})}).then(async response=>{const result=await response.json();if(!response.ok){extractionState({id,status:'paused',message:result.error||'提取提交失败'})}}).catch(()=>extractionState({id,status:'restoring',message:'提交状态待确认，正在查询；不会自动重复提交'}))
  }
  useEffect(()=>{
    if(!ready)return
    for(const kind of ['material','model','person'] as const){
      const id=sessionStorage.getItem('canvas-extraction-'+kind) || (kind==='person'?sessionStorage.getItem('canvas-person-asset-task'):null)
      if(!id||!/^[a-f0-9-]{36}$/.test(id))continue
      setNodes(current=>current.some(n=>n.data.extraction?.id===id)?current:[...current,{id:`extract-${id}-0`,type:'card',position:{x:Math.max(0,...current.map(n=>absolutePosition(n.id,current).x+Number(n.style?.width||340)))+100,y:180},style:{width:340,height:340},data:{kind:'image',label:'恢复资产提取',imagePresentationVersion:1,extraction:{id,index:0,kind,focus:'',status:'restoring',message:'正在将已有任务恢复到画布，不会重新生图',createdAt:new Date().toISOString()}}}])
    }
  },[ready,setNodes])
  function addAssetImage(asset: VisualAsset) {
    const id=uid(), position=flow.screenToFlowPosition({x:window.innerWidth/2,y:window.innerHeight/3})
    const img=new Image(); img.onload=()=>setNodes(current=>[...current.map(n=>({...n,selected:false})),{id,type:'card',position,selected:true,style:{width:340,height:340*img.naturalHeight/img.naturalWidth},data:{kind:'image',src:asset.image,label:asset.name,imagePresentationVersion:1}}]); img.src=asset.image
  }
  async function runLocalEdit(sourceId: string, recipe: LocalEditRecipe, options: Generation, inputId=sourceId, modification?:string) {
    const owner=nodes.find(n=>n.id===sourceId)
    const source=nodes.find(n=>n.id===inputId)
    if(!owner || !source?.data.src) throw Error('底图或功能已移除，请重新选择')
    if(sending.current.has(sourceId) || owner.data.imageJob && !['complete','paused','submit_error'].includes(owner.data.imageJob.status)) throw Error('当前图片任务仍在处理，请等待完成')
    const prior=owner.data.imageJob
    const requestId=prior?.status==='submit_error' && prior.requestId && JSON.stringify(owner.data.localEdit)===JSON.stringify(recipe) && JSON.stringify(owner.data.generation)===JSON.stringify(options) ? prior.requestId : uid()
    sending.current.add(sourceId);setSubmittingIds(new Set(sending.current))
    try {
      // Keep the selected input intact. All versions use the shared four-slot lifecycle.
      update(sourceId,{...(modification!==undefined?{submittedRefinement:{jobId:requestId,prompt:modification}}:{}),tool:recipe.kind==='material'?'material':'furniture',localEdit:recipe,imageOutput:owner.data.kind==='image',generation:options,prompt:recipe.supplement,...(owner.data.kind==='tool'?{skillState:{baseId:inputId,options:{...options},supplement:recipe.supplement}}:{skillResult:owner.data.skillResult || {jobId:'',sourceNode:sourceId,baseId:inputId,review:{}}}),imageJob:{requestId,status:'submitting',phase:recipe.deferredSelection?{step:1,total:4}:undefined,message:recipe.deferredSelection?'步骤 1/4 · 准备后台识别对象':'正在准备局部编辑与像素保护…'}})
      if(modification!==undefined){clearComposer();setNodes(current=>current.map(n=>({...n,selected:false})))}
      const prepared=await prepareLocalEditSubmission(source.data.src,recipe)
      const response=await fetch('/api/skills/assets/edit/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,...prepared,options})})
      const job=await response.json()
      if(!response.ok) throw Error(job.error || '局部编辑提交失败')
      update(sourceId,{generation:{...options,ratio:(job.ratio || options.ratio) as Generation['ratio']},imageJob:{id:job.id,requestId,phase:job.phase,createdAt:job.createdAt,status:job.status,message:job.message,serverNow:job.serverNow}})
    } catch(error) {
      const message=error instanceof Error?error.message:'提交未确认'
      update(sourceId,{imageJob:{requestId,status:'submit_error',message:`${message}；重试会核对同一请求，避免重复提交`}})
      throw Error(message)
    } finally {sending.current.delete(sourceId);setSubmittingIds(new Set(sending.current))}
  }
  function quickAction(operation: string, id: string) {
    if(!functionEnabled(operation)){setToast('此功能已由管理员关闭');return}
    if(operation==='tone-advanced'){const node=nodes.find(n=>n.id===id);const linked=edges.filter(e=>e.target===id);const src=node?.data.toneSettings?.base||nodes.find(n=>n.id===linked.find(e=>e.targetHandle!=='style')?.source)?.data.src;const reference=node?.data.toneSettings?.reference||nodes.find(n=>n.id===linked.find(e=>e.targetHandle==='style')?.source)?.data.src;if(src)setToneTarget({id,src,label:node?.data.label||'场景调色',epoch:graphEpoch.current,skill:true,reference,parameters:node?.data.toneSettings?.parameters});return}
    if(operation==='tone'){const node=nodes.find(n=>n.id===id);if(node?.data.src)setToneTarget({id,src:node.data.toneSettings?.base||node.data.src,reference:node.data.toneSettings?.reference,parameters:node.data.toneSettings?.parameters,label:node.data.label||'图片',epoch:graphEpoch.current});return}
    if(operation==='compare'){const image=nodes.find(n=>n.id===id);if(image?.data.toneSettings?.base){setToneTarget({id,src:image.data.toneSettings.base,reference:image.data.toneSettings.reference,parameters:image.data.toneSettings.parameters,label:image.data.label,epoch:graphEpoch.current});return}setCompareOriginal(null);setPreviewId(id);return}
    if(operation==='save-asset'){const node=nodes.find(n=>n.id===id);if(node?.data.extractedAsset)setAssetSession({mode:'save',kind:node.data.extractedAsset.asset.kind,asset:node.data.extractedAsset.asset,saveNodeId:id});return}
    const node=nodes.find(n=>n.id===id)
    if(operation==='arrange-results') {
      const job=node?.data.imageJob?.id||node?.data.imageJob?.requestId||node?.data.skillState?.jobId||node?.data.skillState?.requestId
      if(!job)return
      setNodes(current=>{
        const results=current.filter(n=>!n.parentId&&(n.data.pendingResult?.jobId===job||n.data.skillResult?.jobId===job)&&n.id!==id).sort((a,b)=>(a.data.pendingResult?.index??Number(a.id.split('-').at(-1)))-(b.data.pendingResult?.index??Number(b.id.split('-').at(-1))))
        if(!results.length)return current
        const ids=new Set(results.map(n=>n.id)),maxWidth=Math.max(340,...results.map(n=>Number(n.style?.width)||340)),spacing=maxWidth+40
        const at=nextBatchPosition(id,current.filter(n=>!ids.has(n.id)),{count:Math.ceil(results.length*spacing/380),height:Math.max(...results.map(n=>Number(n.style?.height)||454))})
        return current.map(n=>{const index=results.findIndex(r=>r.id===n.id);return index<0?n:{...n,position:{x:at.x+index*spacing,y:at.y}}})
      })
      setToast('当前批次已整理到节点附近，已分组的图片保留原位')
      return
    }
    if(operation.startsWith('configure-asset:')) { openAssets('edit',node?.data.tool==='material'?'material':'model',operation.slice('configure-asset:'.length),id); return }
    if(operation==='run-asset') {
      const baseId=node?.data.skillState?.baseId || edges.find(e=>e.target===id)?.source
      if(node?.data.localEdit && baseId) void runLocalEdit(id,{...node.data.localEdit,supplement:node.data.skillState?.supplement ?? node.data.localEdit.supplement},{...normalizeGeneration(node.data.skillState?.options as Generation || node.data.generation),ratio:(node.data.skillState?.options?.ratio || node.data.generation?.ratio || 'auto') as Generation['ratio']},baseId).catch(error=>setToast(error.message))
      else setToast('请先连接底图并绑定资产')
      return
    }
    if (operation === 'extract') { openAssets('extract','material',id); return }
    if (!(operation in builtinSkills)) return
    const source = nodes.find(n => n.id === id)
    if (!source?.data.src || source.data.task || source.data.imageJob && !source.data.imageOutput) return
    const skill = operation as BuiltinOperation
    if (builtinSkills[skill].interactive) { setEditing({ id, operation: skill }); return }
    createQuickTask(skill, id, {})
  }
  function createQuickTask(operation: BuiltinOperation, sourceId: string, parameters: InlineParameters) {
    const source = nodes.find(n => n.id === sourceId)
    if (!source?.data.src || source.data.task || source.data.imageJob && !source.data.imageOutput) { setEditing(null); return }
    const sourcePosition = absolutePosition(sourceId, nodes)
    const width = source.measured?.width || Number(source.style?.width) || 340, height = source.measured?.height || Number(source.style?.height) || 340
    const frame = parameters.frame
    const outputWidth = frame ? width * frame.width : width, outputHeight = frame ? height * frame.height : height
    const generation={...normalizeGeneration(draftGeneration),ratio:source.data.dimensions ? ratioFromDimensions(source.data.dimensions) : draftGeneration.ratio,...(operation==='edit'&&parameters.boxes?{model:'doubao-seedream-5-0-pro-260628'}:{}),count:1}
    {
      const id = uid()
      setNodes(current => [...current.map(n => ({ ...n, selected: false })), { id, type: 'card', position: { x: sourcePosition.x + width + 55, y: sourcePosition.y }, style: { width:outputWidth, height:outputHeight }, selected: true, data: { kind: 'image', src: source.data.src, canvasOperation:operation, canvasParameters:parameters, prompt:parameters.prompt||'', generation, imagePresentationVersion: 1, label: builtinSkills[operation].name, imageJob: { status: 'submitting', message: '连接生图后台…' }, skillResult: { jobId: '', sourceNode: sourceId, baseId: sourceId, review: {} } } }])
      setEdges(current=>[...current,{id:`result-${id}`,source:sourceId,target:id}])
      setEditing(null); setMenu(null)
      void sendGeneration(id, 'redraw', parameters.prompt || '', generation, [source.data.src],undefined,undefined,{...parameters,operation})
      return
    }
  }
  async function sendGeneration(id: string, mode: 'generate' | 'redraw', prompt: string, generation: Generation, images: string[], prior?: ImageJobState, initialRequestId?: string, expansion?:InlineParameters & {operation:BuiltinOperation}) {
    if (sending.current.has(id) || prior && !['complete','paused','submit_error'].includes(prior.status)) return
    const requestId = initialRequestId || (prior?.status === 'submit_error' && prior.requestId ? prior.requestId : uid())
    sending.current.add(id);setSubmittingIds(new Set(sending.current))
    update(id, { imageJob: { requestId, status: 'submitting', message: expansion?.operation==='background'?'准备本地抠图…':'正在准备处理…' } })
    try {
      const response = await fetch(expansion?(expansion.operation==='expand'?'/api/skills/expand/tasks':'/api/skills/canvas/tasks'):'/api/skills/images/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expansion?{requestId,operation:expansion.operation,parameters:expansion,base:images[0],frame:expansion.frame,prompt:expansion.prompt||'',options:{...generation,count:1}}:{ requestId, mode, prompt, options: generation, images }) })
      const job = await response.json()
      if (!response.ok) throw Error(job.error || '后台提交失败')
      update(id, { imageJob: { id: job.id, requestId, createdAt: job.createdAt, finishedAt: job.finishedAt, serverNow: job.serverNow, provider:job.provider, canQueryOriginal:job.canQueryOriginal, status: job.status, message: job.message } })
    } catch (cause) { update(id, { imageJob: { requestId, status: 'submit_error', message: cause instanceof Error ? cause.message : '连接失败，再次点击仅恢复同一请求' } }); setToast('提交未完成，请查看节点提示；重试使用同一请求 ID') }
    finally { sending.current.delete(id);setSubmittingIds(new Set(sending.current)) }
  }
  function run(id: string) {
    const n = nodes.find(n => n.id === id)
    if (!n || !['generate','redraw'].includes(n.data.tool || '')) { setToast('此功能需要接入专用执行器'); return }
    const inputs = edges.filter(e => e.target === id).map(e => nodes.find(n => n.id === e.source)).filter(n => n?.data.kind === 'image' && n.data.src && !n.data.task && (!n.data.imageJob || n.data.imageOutput))
    if (inputs.length>9){setToast('最多支持 9 张参考图');return}
    if (!n.data.canvasImageNode && n.data.tool === 'redraw' && !inputs.length) { setToast('请先连接输入图片'); return }
    if (!n.data.prompt?.trim()) { setToast('请先填写创作提示词'); return }
    if(n.data.canvasImageNode){
      if(sending.current.has(id)||n.data.imageJob&&!['complete','paused','submit_error'].includes(n.data.imageJob.status))return
      const requestId=uid(),mode=inputs.length?'redraw':'generate',generation=normalizeGeneration(n.data.generation)
      const first=inputs[0],input=first?.data.src?{id:first.id,src:first.data.src,original:first.data.comparison?.original}:undefined
      const batch=composerBatch(id,requestId,mode,n.data.prompt,generation,absolutePosition(id,nodes),input,inputs.map(image=>image!.id))
      setNodes(current=>[...current.map(node=>node.id===id?{...node,...batch.controller,position:node.position,selected:true}:node),...batch.rest])
      setEdges(current=>[...current,...batch.rest.map(node=>({id:`result-${node.id}`,source:id,target:node.id}))])
      setComposerOpen(false)
      void sendGeneration(id,mode,n.data.prompt,generation,inputs.map(image=>image!.data.src!),undefined,requestId)
      return
    }
    void sendGeneration(id, inputs.length ? 'redraw' : 'generate', n.data.prompt, normalizeGeneration(n.data.generation), inputs.map(n => n!.data.src!), n.data.imageJob)
  }
  async function refineResult(image: Card, supplement: string, options: SkillOptions) {
    if (sending.current.has(image.id) || !image.data.src) return
    const context = image.data.iterationContext
    const source = nodes.find(n => n.id === image.data.skillResult?.sourceNode)
    const tool = context?.tool || source?.data.tool || 'redraw'
    const prior = context?.prompt || source?.data.skillState?.supplement || source?.data.prompt || ''
    const prompt = refinementPrompt(prior, supplement)
    const recipe = image.data.localEdit || source?.data.localEdit
    if (recipe) { try { await runLocalEdit(image.id, { ...recipe, supplement: refinementPrompt(recipe.supplement, supplement) }, {...normalizeGeneration(options as Generation),ratio:options.ratio as Generation['ratio']}, image.id, supplement) } catch(error) { setToast(error instanceof Error ? error.message : '局部编辑提交失败') } return }
    if (skillIds.includes(tool) && !['style','light'].includes(tool)) { setToast('此功能执行器尚未配置，接入后可在这里直接补充修改'); return }
    if (!['style','light'].includes(tool)) { update(image.id, { imageOutput: true, tool: 'redraw', prompt, generation: normalizeGeneration(options as Generation) }); void sendGeneration(image.id, 'redraw', prompt, normalizeGeneration(options as Generation), [image.data.src], image.data.imageJob); return }
    const ids = context?.referenceIds || source?.data.skillState?.referenceIds || edges.filter(e => e.target === source?.id && e.targetHandle === 'style').map(e => e.source)
    const references = ids.map(id => nodes.find(n => n.id === id)).filter((n): n is Card => !!n?.data.src && n.id !== image.id)
    if (tool === 'style' && !references.length) { setToast('原风格参考图已移除，请先恢复参考图'); return }
    sending.current.add(image.id)
    const requestId = uid()
    const state: SkillState = { lighting: context?.lighting || source?.data.skillState?.lighting, baseId: image.id, referenceIds: references.map(n => n.id), supplement: prompt, options, requestId, status: 'preparing', message: '正在提交补充修改…' }
    update(image.id, { tool, skillState: state, submittedRefinement:{jobId:requestId,prompt:supplement} })
    clearComposer();setNodes(current=>current.map(n=>({...n,selected:false})))
    try {
      const response = await fetch(tool==='light'?'/api/skills/light/run':'/api/skills/style/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tool==='light'?{requestId,base:image.data.src,lighting:state.lighting||{},options,supplement:prompt}:styleRefinementBody(requestId, image.data.src, references.map(n => n.data.src!), options, prompt)) })
      const job = await response.json()
      if (!response.ok) throw Error(job.error || '修改提交失败')
      update(image.id, { skillState: { ...state, jobId: job.id, status: job.status, message: job.message, createdAt: job.createdAt, finishedAt: job.finishedAt, serverNow: job.serverNow } })
    } catch (error) { update(image.id, { skillState: { ...state, status: 'submission_unknown', message: '提交未确认，请先核对后台任务，避免重复生成' + (error instanceof Error && !error.message.includes('JSON') ? `：${error.message}` : '') } }) }
    finally { sending.current.delete(image.id) }
  }
  async function showProjects(){
    if(!await projectWriter.flush()){setToast('当前画布保存失败，请先导出备份');return}
    setProjectsOpen(true)
  }
  async function openManagedProject(id:string){
    if(!await projectWriter.flush())throw Error('当前画布保存失败，未切换项目')
    persistenceAllowed.current=false
    try{await canvasProjects.open(id);window.location.reload()}catch(error){persistenceAllowed.current=true;throw error}
  }
  async function deleteManagedProject(id:string){
    if(!await projectWriter.flush())throw Error('当前画布保存失败，未删除项目')
    if(id!==await canvasProjects.active()){await canvasProjects.trash(id,true);return}
    const replacement=(await canvasProjects.list()).filter(p=>p.id!==id&&!p.deletedAt).sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.id
    persistenceAllowed.current=false
    try{if(replacement)await canvasProjects.open(replacement);else await canvasProjects.activateEmptyDraft();await canvasProjects.trash(id,true);sessionStorage.setItem('canvas-return-projects','1');window.location.reload()}catch(error){await canvasProjects.open(id);persistenceAllowed.current=true;throw error}
  }
  async function newCanvas(){
    if(!await projectWriter.flush())throw Error('当前画布保存失败，未新建项目')
    const id=await canvasProjects.create()
    await openManagedProject(id)
  }
  async function exportCanvasBackup() {
    try {
      const backup=await readCanvasBackup();if(!backup){setToast('暂无上次画布备份');return}
      download(new Blob([JSON.stringify(backup)],{type:'application/json'}),'上次画布备份.visproj')
      setToast('备份已导出，可用“打开项目”恢复')
    } catch {setToast('备份读取失败，请重试')}
  }
  function exportProject() { const p: Project = { format: 'visproj', schemaVersion: 1, name, nodes, edges, viewport: flow.getViewport(), draft: { prompt: draftPrompt, generation: draftGeneration, mode: draftMode, referenceIds: composerReferenceIds } }; download(new Blob([JSON.stringify(p)], { type: 'application/json' }), `${name.replace(/[<>:"/\\|?*]/g, '_')}.visproj`); setToast('项目已导出，包含图片、连线和工具参数') }
  async function importProject(file?: File) { if(!file)return;try{if(file.size>150*1024*1024)throw Error('项目文件过大');const project=validate(JSON.parse(await file.text()));if(!await projectWriter.flush())throw Error('当前画布保存失败，未导入项目');const id=await canvasProjects.create(project);await openManagedProject(id)}catch(error){setToast(error instanceof Error?error.message:'项目文件读取失败')} }
  function submitComposer() {
    if(!functionEnabled('generate')){setToast('自由生图已关闭');return}
    if (composerBusy) return
    if (activeTool) { run(activeTool.id); return }
    if (ordinaryResult) { if(activePrompt.trim() && !composerBusy) void refineResult(ordinaryResult,activePrompt,activeSettings); return }
    if (!draftPrompt.trim()) { setToast('请先填写创作提示词'); return }
    if (inputImages.length > 9) { setToast('最多支持 9 张参考图，请减少选择'); return }
    if (inputImages.some(n=>!n?.data.src || n.data.pendingResult || n.data.task)) { setToast('参考图已被删除或不可用，请移除后重新添加'); return }
    const source = inputImages[0]
    if (draftMode === 'redraw' && !source) { setToast('请先点击画布图片加入参考'); return }
    const mode = draftMode
    const id=uid(), requestId=uid(), input=mode==='redraw' && source?.data.src ? {id:source.id,src:source.data.src,original:source.data.comparison?.original} : undefined
    const wanted=flow.screenToFlowPosition({x:Math.max(100,window.innerWidth/2-170),y:Math.max(100,window.innerHeight/2-220)}), size=targetDimensions(draftGeneration)
    const position=composerPosition(wanted,nodes.filter(n=>!legacyGeneratorIds.has(n.id)).map(n=>({...absolutePosition(n.id,nodes),width:n.measured?.width || Number(n.style?.width) || 340,height:n.measured?.height || Number(n.style?.height) || 340})),draftGeneration.count*380-40,340*size.height/size.width)
    const batch=composerBatch(id,requestId,mode,draftPrompt,{...draftGeneration},position,input,inputImages.filter(n=>!!n).map(n=>n!.id))
    setNodes(current=>[...current.map(n=>({...n,selected:false})),batch.controller,...batch.rest])
    setEdges(current=>[...current,...(input?inputImages.filter(n=>!!n).map(n=>({id:uid(),source:n!.id,target:id})):[]),...batch.rest.map(n=>({id:`result-${n.id}`,source:id,target:n.id}))])
    requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.fitView({nodes:[batch.controller,...batch.rest],padding:{top:'80px',bottom:'340px',left:'80px',right:'80px'},maxZoom:1,duration:250})}))
    clearComposer()
    void sendGeneration(id,mode,draftPrompt,draftGeneration,input?inputImages.map(n=>n!.data.src!):[],undefined,requestId)
  }
  const actionHandlers = {skillResults,update,run,addTool,toggleNode,ungroup,quickAction,editing,createQuickTask}
  const actionRef=useRef(actionHandlers)
  useLayoutEffect(()=>{actionRef.current=actionHandlers})
  const actions=useMemo(()=>({
    skillResults:(id:string,job:string,images:SkillResult[])=>actionRef.current.skillResults(id,job,images),
    update:(id:string,data:Partial<Card['data']>)=>actionRef.current.update(id,data),
    run:(id:string)=>actionRef.current.run(id),
    addTool:(tool:string,source:string)=>actionRef.current.addTool(tool,undefined,source),
    toggle:(id:string)=>actionRef.current.toggleNode(id),
    ungroup:(id:string)=>actionRef.current.ungroup(id),
    quick:(operation:string,id:string)=>actionRef.current.quickAction(operation,id),
    editing,cancelEdit:()=>setEditing(null),
    confirmEdit:(parameters:InlineParameters)=>{const h=actionRef.current;if(h.editing)h.createQuickTask(h.editing.operation,h.editing.id,parameters)},
    select:(id:string)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,selected:!n.selected}:n)),
    selectLayer:(id:string)=>setNodes(ns=>ns.map(n=>({...n,selected:n.id===id})))
  }),[editing,setNodes])
  return <Actions.Provider value={actions}>{projectsOpen&&<ProjectManager onRename={setName} onClose={()=>setProjectsOpen(false)} onCreate={newCanvas} onDelete={deleteManagedProject} onOpen={openManagedProject} onImport={()=>open.current?.click()} onBackup={()=>void exportCanvasBackup()}/>}<div className={assetSession?.mode==='browse'?'app-shell asset-browser-open':'app-shell'}>
    <div hidden aria-hidden="true">{[...new globalThis.Map(nodes.filter(n=>n.data.extraction&&!['complete','paused'].includes(n.data.extraction.status)).map(n=>[n.data.extraction!.id,n.data.extraction!])).values()].map(task=><ExtractionMonitor key={task.id} id={task.id} kind={task.kind} onState={state=>extractionState(state)}/>)}</div>
    <div hidden aria-hidden="true">{orphanedJobs.map(p => <ImageJob key={p.jobId} endpoint={p.endpoint || (nodes.find(n => n.id === p.sourceNode)?.data.tool === 'style' ? 'style' : 'images')} job={p.task || { id: p.jobId, status: 'restoring', message: '正在恢复任务状态' }} onChange={task => setNodes(current => current.map(n => n.data.pendingResult?.jobId === p.jobId ? { ...n, data: { ...n.data, pendingResult: { ...n.data.pendingResult!, task } } } : n))} onResults={(job, images) => skillResults(p.sourceNode, job, images)} />)}</div>
    <div hidden aria-hidden="true">{nodes.map(n => <div key={n.id}>{['style','light'].includes(n.data.tool||'') && n.data.skillState?.jobId && <ImageJob endpoint={n.data.tool==='light'?'images':'style'} job={{ ...n.data.skillState, id: n.data.skillState.jobId, status: n.data.skillState.status || 'running', message: n.data.skillState.message || '' }} onChange={job => update(n.id, { skillState: { ...n.data.skillState, ...job, jobId: job.id } })} onResults={(job, images) => skillResults(n.id, job, images)} />}{n.data.imageJob && <ImageJob submitting={submittingIds.has(n.id)||(['platform-upscale','texture-restore'].includes(n.data.tool||'')&&n.data.imageJob?.status==='submitting')} job={n.data.imageJob} onChange={imageJob => update(n.id, { imageJob })} onResults={(job, images) => skillResults(n.id, job, images)} />}</div>)}</div>
    <header><div className="brand"><span className="brand-mark">v</span><strong>VISUAL<span> WORKSPACE</span></strong><em>预览版</em></div><div className="project-name"><input aria-label="项目名称" value={name} onChange={e => setName(e.target.value)} /><span>● {saveStatus}</span></div></header><div className="header-actions"><button disabled={!ready} onClick={()=>void showProjects()}><FolderOpen size={16}/>项目管理</button><button onClick={exportProject}><Download size={16}/>导出项目</button><button className="primary" onClick={()=>upload.current?.click()}><Plus size={16}/>导入图片</button></div>
    <div className="history-controls"><button aria-label="撤销" title="撤销 · Ctrl+Z" disabled={!historyState.undo} onClick={() => restoreHistory('undo')}><Undo2 size={17} /></button><button aria-label="重做" title="重做 · Ctrl+Shift+Z / Ctrl+Y" disabled={!historyState.redo} onClick={() => restoreHistory('redo')}><Redo2 size={17} /></button></div>
    <nav className="canvas-rail" aria-label="画布工具栏">
      <button aria-label="选择工具" aria-pressed={!middlePanning} title="选择 / 框选 · 按住鼠标中键平移" onClick={() => { setMiddlePanning(false); setEditing(null) }}><MousePointer2 size={18} /></button>
      <span />
      <button aria-label="图层面板" aria-pressed={panelOpen} title="图层" onClick={() => {if(assetSession?.mode==='browse')setAssetSession(null);setPanelOpen(v => !v)}}><Layers size={18} /></button>
      <button aria-label="打开资产库" aria-pressed={!!assetSession} title="资产库" onClick={() => assetSession?.mode==='browse'?setAssetSession(null):openAssets('browse','material')}><Archive size={18} /></button><span />
      <button aria-label="打开图像创作" title="新建图像" onClick={() => { setNodes(ns => ns.map(n => ({ ...n, selected: false }))); setComposerOpen(true) }}><Plus size={19} /></button>
      <button aria-label="预览选中图片" title="预览选中图片 · 双击图片" disabled={selected?.data.kind !== 'image' || !!selected?.data.task || !!selected?.data.imageJob && !selected.data.imageOutput} onClick={() => selected && setPreviewId(selected.id)}><Eye size={18} /></button>
      <button aria-label="切换缩略地图" aria-pressed={showMinimap} title="缩略地图" onClick={() => setShowMinimap(v => !v)}><Map size={17} /></button>
    </nav>
      <aside className={panelOpen ? '' : 'collapsed'} inert={!panelOpen}><div className="tabs"><button className="current">图层 <small>{nodes.length - legacyGeneratorIds.size}</small></button></div><div className="layer-list">{nodes.length === 0 && <p>导入图片后，图层会显示在这里。</p>}{[...nodes].filter(n => !legacyGeneratorIds.has(n.id)).reverse().map(n => <button className={n.selected ? 'chosen' : ''} key={n.id} onClick={() => locateLayer(n.id)}>{n.data.kind === 'group' ? <Group size={15} /> : <ImagePlus size={15} />}<span>{n.parentId ? '↳ ' : ''}{n.data.label}</span>{n.data.final && <Check size={14} />}</button>)}</div><div className="sidebar-bottom">本地工作空间 <span>●</span></div></aside>
    <main className={`canvas-surface${middlePanning ? ' middle-panning' : ''}${editing ? ' canvas-editing' : ''}`} onMouseDownCapture={e => { if (e.button === 1 && (e.target as HTMLElement).closest('.react-flow')) { e.preventDefault(); setMiddlePanning(true) } }} onAuxClickCapture={e => { if (e.button === 1) e.preventDefault() }} onDragEnter={e => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current++; setDraggingFile(true) } }} onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDraggingFile(false) }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }} onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDraggingFile(false); void importImages(e.dataTransfer.files, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })) }}>
      <div className="canvas-heading"><span>画布 01</span><span> / </span><small>自由创作</small></div>
      {ready && <ReactFlow elevateEdgesOnSelect={false} onlyRenderVisibleElements onNodeClick={(event, node) => { if (node.data.pendingResult && !event.ctrlKey && !event.metaKey && !event.shiftKey) restoreComposer(node as Card); if(node.data.canvasImageNode){setEditorMode('free');setComposerOpen(true)} if (node.data.kind === 'image' && node.data.src && !node.data.pendingResult && !node.data.task && (!node.data.imageJob || node.data.imageOutput)) { setDirectComposerInput(node.id); if (!event.ctrlKey && !event.metaKey && !event.shiftKey) restoreComposer(node as Card); if(event.ctrlKey || event.metaKey){setEditorMode('free');addComposerReferences([node as Card])} } else { setDirectComposerInput(null) } }} onBeforeDelete={async({nodes:removed,edges:removedEdges})=>{
        const jobs=new Set<string>()
        for(const n of removed){if(n.data.pendingResult)jobs.add(n.data.pendingResult.jobId);if(!n.data.src||n.data.kind==='tool'||n.data.imageJob&&!n.data.imageOutput)for(const job of [n.data.imageJob?.id,n.data.imageJob?.requestId,n.data.skillState?.jobId,n.data.skillState?.requestId])if(job)jobs.add(job)}
        const controllers=nodes.filter(n=>[n.data.imageJob?.id,n.data.imageJob?.requestId,n.data.skillState?.jobId,n.data.skillState?.requestId].some(job=>job&&jobs.has(job)))
        for(const n of controllers)for(const job of [n.data.imageJob?.id,n.data.imageJob?.requestId,n.data.skillState?.jobId,n.data.skillState?.requestId])if(job)jobs.add(job)
        let remoteMayContinue=false
        try{for(const job of jobs){const response=await fetch(`/api/skills/tasks/${encodeURIComponent(job)}`,{method:'DELETE'});const result=await response.json();if(!response.ok)throw Error(result.error||'后台删除失败');remoteMayContinue ||= result.remoteMayContinue;deletedTaskIds.current.add(job)}}catch(error){setToast(String(error));return false}
        const removal=[...new globalThis.Map([...removed,...nodes.filter(n=>n.data.pendingResult&&jobs.has(n.data.pendingResult.jobId))].map(n=>[n.id,n])).values()]
        const ids=new Set(removal.map(n=>n.id)),sources=new Set([...ids,...removedEdges.filter(e=>e.data?.materialReference).map(e=>e.source)])
        setNodes(current=>unlinkMaterialReferences(current.map(n=>controllers.some(c=>c.id===n.id)?{...n,data:{...n.data,imageJob:undefined,skillState:n.data.skillState?{...n.data.skillState,jobId:undefined,requestId:undefined,status:undefined}:undefined}}:n),sources))
        if(jobs.size)setToast(remoteMayContinue?'任务已删除并停止本地跟踪；远端或已开始的计算可能仍在执行':'任务及后台记录已清理')
        return {nodes:removal,edges:[...new globalThis.Map([...removedEdges,...edges.filter(e=>ids.has(e.source)||ids.has(e.target))].map(e=>[e.id,e])).values()]}
      }} zoomOnDoubleClick={false} onNodeDoubleClick={(_, node) => { if (node.data.kind === 'image' && !node.data.task && (!node.data.imageJob || node.data.imageOutput) && !editing) setPreviewId(node.id) }} onNodeDrag={avoidWhileDragging} onNodeDragStop={finishAvoidance} nodesDraggable={!editing} nodes={displayNodes} edges={visibleEdges} onSelectionStart={()=>{marqueeActive.current=true}} onSelectionEnd={()=>{marqueeActive.current=false}} onNodesChange={changes=>onNodesChange(changes.map(change=>change.type==='select' && change.selected && marqueeActive.current && nodes.some(n=>n.id===change.id && n.data.kind==='group' && !n.data.collapsed) ? {...change,selected:false} : change))} onEdgesChange={onEdgesChange} edgeTypes={edgeTypes} edgesReconnectable reconnectRadius={16} onEdgeClick={() => { setNodes(current => current.map(node => ({ ...node, selected: false }))); setMenu(null) }} onReconnectStart={() => { reconnectSucceeded.current = false; reconnectSession.current = true; setNodes(current => current.map(node => ({ ...node, selected: false }))); setMenu(null) }} onReconnect={(edge, connection) => { if (connection.source === connection.target) return; reconnectSucceeded.current = true; setEdges(current => reconnectEdge(edge, connection, current, { shouldReplaceId: false }).map(item => ({ ...item, selected: item.id === edge.id }))) }} onReconnectEnd={(_, edge, _handle, connection) => { if (!reconnectSucceeded.current && !connection.toNode) setEdges(current => current.filter(item => item.id !== edge.id)); requestAnimationFrame(() => { reconnectSession.current = false }) }} isValidConnection={connection => connection.source!==connection.target && !nodes.some(n=>(n.id===connection.source||n.id===connection.target)&&n.data.kind==='group')} nodeTypes={nodeTypes} minZoom={0.15} maxZoom={3} defaultViewport={viewport} defaultEdgeOptions={{ type: 'editable', reconnectable: true, interactionWidth: 28, style: { stroke: '#9aadd0', strokeWidth: 2 } }} onMoveEnd={(_, vp) => setViewportState(vp)} onPaneClick={() => { setMenu(null); clearComposer(); setNodes(current => current.map(node => node.selected ? { ...node, selected: false } : node)) }} onConnect={c => { if(c.source===c.target)return;const target=nodes.find(n=>n.id===c.target);if(target?.data.canvasImageNode){if(!nodes.some(n=>n.id===c.source&&n.data.src)||edges.filter(e=>e.target===c.target).length>=9){setToast('请连接有效图片，最多 9 张参考');return}setNodes(current=>current.map(n=>({...n,selected:n.id===c.target})));setEditorMode('free');setComposerOpen(true)}setEdges(es=>addEdge(c,es)) }} onConnectEnd={(e, state) => { if (reconnectSession.current) return; if (!state.isValid && state.fromNode && state.fromHandle?.type === 'source') { const point = 'changedTouches' in e ? e.changedTouches[0] : e; setMenu({ x: point.clientX, y: point.clientY, source: state.fromNode.id }) } }} onNodeContextMenu={(e, n) => { e.preventDefault(); if (n.data.kind === 'group' || n.data.task || n.data.imageJob && !n.data.imageOutput) return; setNodes(ns => ns.map(x => ({ ...x, selected: x.id === n.id }))); setMenu({ x: e.clientX, y: e.clientY, source: n.id }) }} selectionMode={SelectionMode.Partial} selectionKeyCode={null} selectNodesOnDrag selectionOnDrag={!editing} multiSelectionKeyCode="Shift" panOnDrag={[1]} deleteKeyCode={editing ? null : ['Backspace', 'Delete']}><ConnectionGeometry /><CanvasBackground /><Controls showInteractive={false} fitViewOptions={{ padding: { left: panelOpen && window.innerWidth > 800 ? '350px' : '100px', right: '55px', top: '80px', bottom: '145px' }, maxZoom: 1 }}><ThemeToggle /></Controls>{showMinimap && <MiniMap pannable zoomable nodeColor={n => n.data.kind === 'tool' ? '#b29ae9' : n.data.kind === 'group' ? '#e3dff0' : '#adbcb4'} />}</ReactFlow>}
      {loadError && <div className="empty-state" role="alert"><h1>画布读取未完成</h1><p>{loadError}</p><p>已暂停自动保存，原有项目记录未被覆盖。</p><button className="primary" onClick={()=>window.location.reload()}>重新读取画布</button></div>}
      {nodes.length === 0 && ready && !loadError && <div className="empty-state"><div className="empty-art"><div /><ImagePlus size={35} /><div /></div><div className="eyebrow">YOUR NEXT IDEA STARTS HERE</div><h1>把想象，连接成画面。</h1><p>拖入图片，连接工具，让每一次创作都有迹可循。</p><button className="primary" onClick={() => upload.current?.click()}><Plus size={17} />导入第一张图片</button><small>或从左侧添加文生图节点</small></div>}
      {selected && !editing && <div className="selection-bar selection-tools" role="toolbar" aria-label="选中项布局">
        <span className="selection-count">已选 {nodes.filter(n => n.selected).length} 项</span>
        <button disabled={rowSelection(nodes).length < 2} title="选中至少两张图片或收纳卡片并排展示 · Alt+Shift+H" onClick={() => arrangeSelection('row')}><Columns2 size={18} />并排展示</button>
        <button disabled={nodes.filter(n => n.selected).length < 2} title="按流程从左到右整理，同次任务结果横向并排" onClick={() => setNodes(current => arrangeWorkflow(current, edges))}><Layers size={18} />节点整理</button>
        <GroupActions key={nodes.filter(n=>n.selected).map(n=>n.id).join(',')} collapsed={!!selected.data.collapsed} hasGroups={selectedGroups.length>0}
          onFold={()=>{if(selectedGroups.length){selectedGroups.forEach(id=>{if(!nodes.find(n=>n.id===id)?.data.collapsed)toggleNode(id)})}else if(nodes.filter(n=>n.selected).length>1)groupSelection();else if(!selected.data.collapsed)toggleNode(selected.id)}}
          onExpand={()=>{if(selectedGroups.length){selectedGroups.forEach(id=>{if(nodes.find(n=>n.id===id)?.data.collapsed)toggleNode(id)})}else if(selected.data.collapsed)toggleNode(selected.id)}}
          onUngroup={()=>selectedGroups.forEach(id=>ungroup(id))}/>

      </div>}

      {draggingFile && <div className="drop-overlay"><div><Upload size={28} /><strong>松开，添加图片到画布</strong><span>PNG、JPG · 单张最大 25MB · 画布预览最长边 4K，下载保留原图</span></div></div>}
      <div className="canvas-hint">左键选择 / 框选 · 按住中键平移 · 滚轮缩放</div>
    </main>
    {activeTool && !imageGenerator && !editing && <div className="node-edit-notice"><WandSparkles size={14} /><span>正在编辑「{activeTool.data.label}」· 参数可在节点内直接调整</span><button onClick={() => { setNodes(ns => ns.map(n => ({ ...n, selected: false }))); setComposerOpen(true) }}><Plus size={14} />新建图像</button></div>}
    {ready && (!activeTool || imageGenerator) && !editing && <section className={composerExpanded ? 'creation-dock' : 'creation-dock minimized'} aria-label="图像创作面板">
      <div className="dock-heading"><div><ImagePlus size={16} /><strong>图像创作</strong><span className="dock-heading-description">生成结果自动放入画布</span></div>{composerExpanded && <div className="composer-mode-tabs" role="group" aria-label="创作方式"><button aria-pressed={editorMode==='free'} onClick={()=>setEditorMode('free')}>自由编辑</button><button aria-pressed={editorMode==='skill'} disabled={!resultImage || !resultRoute.skill} title="选中技能生成的图片，沿用该图的技能设置" onClick={()=>setEditorMode('skill')}>沿用技能</button><span>{skillResultImage?'保留原技能设置，补充本次修改要求':editorMode==='skill'?'请选择一张技能结果图':'参考图会保留，点击 × 移除'}</span></div>}<div><button aria-label={composerExpanded ? '收起创作面板' : '展开创作面板'} onClick={() => setComposerOpen(v => !v)}>{composerExpanded ? '收起' : '展开'}</button></div></div>
      {composerExpanded && <>{!skillResultImage && editorMode==='free' && <>{composerMode==='redraw' && <div className="composer-reference-tray"><div className="composer-input-label"><strong>{`参考图 · ${inputImages.length}`}</strong></div><div className="reference-strip">{inputImages.length ? inputImages.map((n, index) => <span key={referenceIds[index]} title={n?.data.label || '原图已删除，请移除或重新添加'} draggable onDragStart={()=>{draggedReference.current=index}} onDragEnd={()=>{draggedReference.current=null}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();if(draggedReference.current!==null)moveComposerReference(draggedReference.current,index);draggedReference.current=null}}>{n?.data.src && <img src={n.data.previewSrc || n.data.src} alt={`图${index + 1}`} />}<b>图{index + 1}</b><span className="reference-name">{n?.data.label || '图片已删除'}</span><button aria-label={`前移图${index+1}`} disabled={index===0} onClick={()=>moveComposerReference(index,index-1)}>‹</button><button aria-label={`后移图${index+1}`} disabled={index===inputImages.length-1} onClick={()=>moveComposerReference(index,index+1)}>›</button><button aria-label={`移除图${index+1}`} onClick={()=>removeComposerReference(index)}><X size={12}/></button></span>) : <small>上传图片，或 Ctrl / ⌘ 点击画布添加</small>}</div></div>}<div className="dock-workspace"><div className="creation-modes">{<>{!imageGenerator&&<button className={composerMode === 'generate' ? 'chosen' : ''} onClick={() => { setDraftMode('generate'); if(ordinaryResult) setNodes(current=>current.map(n=>({...n,selected:false}))) }}><WandSparkles size={14} />文生图</button>}<button className={composerMode === 'redraw' ? 'chosen' : ''} onClick={() => setDraftMode('redraw')}><ImagePlus size={14} />图生图</button></>}<span className="composer-reference-hint">用“图1、图2”引用</span><button onClick={() => {referenceUpload.current=true;upload.current?.click()}}><Upload size={14} />上传参考</button></div><div className="creation-input"><textarea aria-label="创作提示词" placeholder={draftMode==='redraw' ? '描述修改要求，例如：保留图1的构图，参考图2的材质…' : '描述你想创作的画面、主体、材质与光线…'} value={activePrompt} onChange={e => changeComposerPrompt(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitComposer() } }} /></div></div>
      <div className="dock-footer"><GenerationControls mode={composerMode} key={ordinaryResult?.id || "draft"} value={activeSettings} onChange={changeComposerSettings} /><button className="primary dock-submit" disabled={!functionEnabled('generate') || !activePrompt.trim() || composerBusy} onClick={submitComposer}><WandSparkles size={14} />{composerBusy ? '正在生成…' : '生成图片'}</button></div><div className="dock-status"><span>{activeSettings.resolution} · {activeSettings.ratio} · {activeSettings.count} 张 / 次 · 像素以成图为准</span><span>Ctrl / ⌘ + Enter 生成</span></div></>}</>}
    {skillResultImage && resultImage && composerExpanded && <ResultDock embedded settingsSummary={resultTool==='light'?'沿用生成时的光影设置':undefined} key={resultImage.id} label={resultImage.data.label} image={resultImage.data.src!} skillName={tools.find(t => t.id === resultTool)?.name} referenceLabel={resultImage.data.localEdit ? resultImage.data.localEdit.kind === 'material' ? '材质参考' : '对象参考' : undefined} references={resultImage.data.localEdit ? (resultImage.data.localEdit.regions || [resultImage.data.localEdit]).map((r,i)=>({id:'bound-asset-'+i,src:r.asset.image,label:`${i+1}. ${r.target} · ${r.asset.name}`})) : resultReferences.map(n => ({ id: n.id, src: n.data.src, label: n.data.label }))} prompt={resultImage.data.refinementDraft?.prompt ?? resultImage.data.iterationContext?.modification ?? resultImage.data.iterationContext?.prompt ?? ''} options={resultImage.data.refinementDraft?.options || resultOptions || defaultGeneration} skill={skillIds.includes(resultTool)} busy={!!resultImage.data.skillState?.requestId && !['complete','paused'].includes(resultImage.data.skillState.status || '') || !!resultImage.data.imageJob && !['complete','paused','submit_error'].includes(resultImage.data.imageJob.status)} message={resultImage.data.skillState?.message || resultImage.data.imageJob?.message} onDraft={(prompt, options) => update(resultImage.id, { refinementDraft: { prompt, options } })} onClose={() => setComposerOpen(false)} onGenerate={(prompt, options) => void refineResult(resultImage, prompt, options)} />}
    </section>}


    {assetSession && <AssetLibrary key={`${assetSession.mode}-${assetSession.source?.id || 'library'}`} session={assetSession} onExtract={beginExtraction} onSaved={asset=>{if(assetSession.saveNodeId)update(assetSession.saveNodeId,{label:asset.name,extractedAsset:{asset,archived:true}})}} onClose={() => setAssetSession(null)} onEdit={async (sourceId,recipe,options) => { if(assetSession.nodeId) setNodes(current=>current.map(node=>{
      if(node.id!==assetSession.nodeId)return node
      const supplement=node.data.skillState?.supplement ?? node.data.localEdit?.supplement ?? recipe.supplement
      return {...node,data:{...node.data,localEdit:{...recipe,supplement},generation:node.data.generation||options,skillState:{...node.data.skillState,baseId:sourceId,options:node.data.skillState?.options||{...options,ratio:'auto'},supplement}}}
    })); else {addTool(recipe.kind==='material'?'material':'furniture',undefined,sourceId,{localEdit:recipe,generation:options,skillState:{baseId:sourceId,options:{...options},supplement:recipe.supplement}});setToast('对象与资产已绑定，请在画布节点设置参数并生成')} }} onAdd={addAssetImage} />}
    {menu && <div className="tool-menu" style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 320)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 580)) }}><div className="menu-title">添加到画布<button aria-label="关闭菜单" onClick={() => setMenu(null)}><X size={15} /></button></div>{sidebarTools.filter(t => t.id !== 'generate' && functionEnabled(t.id)).map(t => <button key={t.id} onClick={() => addTool(t.id, flow.screenToFlowPosition({ x: menu.x, y: menu.y }), menu.source)}><t.icon size={17} /><span>{t.name}<small>{t.detail}</small></span><Plus size={13} /></button>)}</div>}
    {pairComparison && <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-label="两张图片滑块对比" onClick={()=>setPairComparison(null)}><div className="image-preview-window" onClick={e=>e.stopPropagation()}><div className="preview-actions"><span>两图对比</span><button onClick={()=>setPairComparison(pair=>pair?[pair[1],pair[0]]:null)}>交换左右</button><button aria-label="关闭两图对比" autoFocus onClick={()=>setPairComparison(null)}><X size={18}/></button></div><ImageComparison key={pairComparison.map(p=>p.label).join(':')} original={pairComparison[0].src} result={pairComparison[1].src} beforeLabel={pairComparison[0].label} afterLabel={pairComparison[1].label}/></div></div>}
    {preview && <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreviewId(null)}><div className="image-preview-window" onClick={e => e.stopPropagation()}><div className="preview-actions"><span>图片预览</span>{previewOriginal && <button onClick={() => setCompareOriginal(v => v === preview.id ? null : preview.id)}>{comparisonVisible ? '仅看结果' : '滑块对比'}</button>}<button aria-label="下载预览图片" onClick={() => preview.data.src && download(preview.data.src, preview.data.label)}><Download size={18} /></button><button aria-label="关闭图片预览" autoFocus onClick={() => setPreviewId(null)}><X size={18} /></button></div><>{comparisonVisible && previewOriginal ? <ImageComparison key={preview.id} original={previewOriginal} input={preview.data.comparison?.input} result={preview.data.src!} /> : <ImageComparison key={preview.id} result={preview.data.src!} afterLabel={preview.data.label} />}</>{preview.data.skillResult && <details className="preview-review"><summary>结果复核 · 请对照底图检查</summary>{Object.entries(preview.data.skillResult.review).map(([key, value]) => <p key={key}>{({ geometry: '构图', product: '产品', material: '材质', lighting: '光影' } as Record<string,string>)[key] || key}：{String(value)}</p>)}</details>}{previewImages.length > 1 && <div className="preview-pager"><button aria-label="上一张图片" onClick={() => setPreviewId(previewImages[(previewIndex - 1 + previewImages.length) % previewImages.length].id)}><ChevronLeft size={17} /></button><span>{previewIndex + 1} / {previewImages.length}</span><button aria-label="下一张图片" onClick={() => setPreviewId(previewImages[(previewIndex + 1) % previewImages.length].id)}><ChevronRight size={17} /></button></div>}</div></div>}
    {toneTarget && <ToneWorkbench key={toneTarget.id} target={toneTarget} initialReference={toneTarget.reference} initialParameters={toneTarget.parameters} references={nodes.filter(n=>n.id!==toneTarget.id&&n.data.kind==='image'&&n.data.src).map(n=>({id:n.id,src:n.data.src!,label:n.data.label||'图片'}))} onClose={()=>setToneTarget(null)} onApply={(src,width,height,parameters)=>{
      if(toneTarget.epoch!==graphEpoch.current||!nodes.some(n=>n.id===toneTarget.id)){setToast('原画布或图片已切换，请重新打开调色');setToneTarget(null);return}
      if(toneTarget.skill){const toneSettings={base:toneTarget.src,reference:toneTarget.reference,parameters};update(toneTarget.id,{toneSettings});void skillResults(toneTarget.id,crypto.randomUUID(),[{index:0,src,review:{},toneSettings}]);setToneTarget(null);return}
      const id=uid(),position=nextBatchPosition(toneTarget.id,nodes,{count:1,height:340*height/width})
      setNodes(current=>[...current.map(n=>({...n,selected:false})),{id,type:'card',position,selected:true,style:{width:340,height:340*height/width},data:{kind:'image',src,toneSettings:{base:toneTarget.src,reference:toneTarget.reference,parameters},label:`${toneTarget.label} · 调色`,imagePresentationVersion:1,comparison:{original:toneTarget.src},generatedSkill:'场景调色'}}])
      setEdges(current=>[...current,{id:uid(),source:toneTarget.id,target:id}]);setToneTarget(null);setToast('调色结果已添加到画布，原图已保留')
    }}/>} 
    {toast && <div className="toast" role="status"><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
    <input ref={upload} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple hidden onChange={e => { if (e.target.files) void importImages(e.target.files); e.target.value = '' }} />
    <input ref={open} type="file" accept=".visproj" hidden onChange={e => { void importProject(e.target.files?.[0]); e.target.value = '' }} />
  </div></Actions.Provider>
}
export default function App() { return <FunctionFlagsProvider><ReactFlowProvider><Workspace /></ReactFlowProvider></FunctionFlagsProvider> }

