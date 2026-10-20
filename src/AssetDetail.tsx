import {usePersonViews} from './personPresentation'
import {AssetImageViewer} from './AssetImageViewer'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {X,Minus,Plus,RotateCcw,Copy,Check,ChevronLeft,ChevronRight} from 'lucide-react'
import type {VisualAsset} from './AssetLibrary'
import './AssetDetail.css'
import {assetCategory} from './assetCategory'

export function AssetDetail({asset,assets,onChoose,onClose,onAdd}:{asset:VisualAsset;assets:VisualAsset[];onChoose:(asset:VisualAsset)=>void;onClose:()=>void;onAdd:(asset:VisualAsset)=>void}){
 const [view,setView]=useState(0),[zoom,setZoom]=useState(1),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false)
 const close=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null)
 const personViews=usePersonViews(asset)
 const views=asset.kind==='person'?[...personViews].reverse():[{label:'资产预览',image:asset.image},...(asset.sourceImage?[{label:'来源原图',image:asset.sourceImage}]:[]),...(asset.views||[]).filter(v=>v.image!==asset.image)]
 const index=assets.findIndex(a=>a.id===asset.id),current=views[view]||views[0]
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>previous?.focus()},[])
 function move(step:number){const next=assets[index+step];if(next)onChoose(next)}
 async function copy(){try{await navigator.clipboard.writeText(asset.prompt);setCopied(true);setCopyError(false)}catch{setCopyError(true)}}
 return createPortal(<div className="asset-detail-overlay" onClick={onClose} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();if(e.key==='Tab'){const buttons=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}><div ref={panel} role="dialog" aria-modal="true" aria-label="资产详情预览" className="asset-detail-dialog" onClick={e=>e.stopPropagation()}>
 <div className="asset-detail-visual"><header><span>{asset.kind==='person'?'人物参考':'资产图片预览'}</span><div><button aria-label="缩小资产预览" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))}><Minus size={14}/></button><button onClick={()=>setZoom(1)} aria-label="重置资产预览缩放"><RotateCcw size={14}/></button><button aria-label="放大资产预览" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z+.25))}><Plus size={14}/></button></div></header>
 <div className="asset-detail-tabs">{views.map((v,i)=><button key={v.label+i} className={view===i?'active':''} onClick={()=>{setView(i);setZoom(1)}}>{v.label}</button>)}</div>
 <AssetImageViewer key={current.image} src={current.image} alt={current.label+' · '+asset.name} zoom={zoom} onZoom={setZoom}/><footer><button aria-label="上一个资产" disabled={index<=0} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><span>{Math.round(zoom*100)}% · 滚轮缩放 · 放大后抓手拖动 · 双击复位</span><button aria-label="下一个资产" disabled={index<0||index>=assets.length-1} onClick={()=>move(1)}><ChevronRight size={18}/></button></footer></div>
 <div className="asset-detail-info"><button ref={close} className="asset-detail-close" aria-label="关闭资产详情" onClick={onClose}><X size={19}/></button><span className="asset-detail-badge">{assetCategory(asset)}</span><h2>{asset.name}</h2><div className="asset-detail-tags">{asset.tags.map(tag=><span key={tag}>#{tag}</span>)}</div><p className="asset-detail-origin">{asset.sourceObject&&`应用对象：${asset.sourceObject} · `}{asset.previewType==='space'?'空间应用预览':asset.previewType==='furniture'?'白底特写预览':'外观参考'}</p>
 <section><h3>资产描述</h3><p>{asset.objectDescription||asset.prompt}</p></section><section><div className="asset-detail-section-title"><h3>可复用提示词</h3><button onClick={()=>void copy()}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'已复制':'复制'}</button></div><pre>{asset.prompt}</pre>{copyError&&<small role="alert">复制失败，请选择上方文本手动复制。</small>}</section>
 {(asset.notes||asset.generatedViews)&&<section><h3>核对提示</h3><p>{asset.notes}{asset.generatedViews?' · AI 多视图，请核对人物一致性。':''}</p></section>}<section><h3>资产信息</h3><dl><dt>来源</dt><dd>{asset.source||'本机画布资产库'}</dd><dt>保存时间</dt><dd>{asset.createdAt?new Date(asset.createdAt).toLocaleString('zh-CN'):'未记录'}</dd><dt>核对状态</dt><dd>{asset.reviewStatus==='confirmed'?'已确认':'待核对'}</dd></dl></section><button className="asset-primary" onClick={()=>onAdd(asset)}>添加参考图片到画布</button></div>
 </div></div>,document.body)
}
