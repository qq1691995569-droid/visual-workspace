import {useId,useRef,useState} from 'react'
import {Check,LoaderCircle,MousePointer2,Plus,Minus,Undo2,Sparkles} from 'lucide-react'
import './ObjectSelection.css'
export type SelectionStroke={mode:'add'|'subtract';points:number[][];width:number}
type Tool='point'|'add'|'subtract'|'polygon'|'rect'
export function ObjectSelection({pointOnly=false,image,kind,points,strokes,mark,onMark,onPoints,onStrokes,target,onTarget,reviewed,onReview,busy,onBusy,onError,onPoint,markers,activeId,onMarker,statusText,activeColor='#8b76ed'}:{pointOnly?:boolean;onPoint?:(point:number[])=>void;markers?:{id:string;mark?:number[];target:string;status:string;points:number[][];color:string}[];activeId?:string;onMarker?:(id:string)=>void;statusText?:string;activeColor?:string;image:string;kind:'material'|'model'|'person';points:number[][];strokes:SelectionStroke[];mark?:number[];onMark:(mark:number[]|undefined)=>void;onPoints:(points:number[][])=>void;onStrokes:(strokes:SelectionStroke[])=>void;target:string;onTarget:(target:string)=>void;reviewed:boolean;onReview:(reviewed:boolean)=>void;busy:string;onBusy:(busy:string)=>void;onError:(error:string)=>void}) {
  const [tool,setTool]=useState<Tool>('point'),[width,setWidth]=useState(.025),[ratio,setRatio]=useState(2/3),[status,setStatus]=useState('')
  const gesture=useRef<number[]|null>(null),inFlight=useRef(false),maskId=useId().replace(/:/g,'')
  const height=1000*ratio, locked=!!busy
  function coordinate(event:React.PointerEvent<SVGSVGElement>){const r=event.currentTarget.getBoundingClientRect();return[Math.max(0,Math.min(1,(event.clientX-r.x)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.y)/r.height))]}
  function changed(){onReview(false);onError('')}
  async function locate(){
    if(!mark||inFlight.current)return
    inFlight.current=true;onBusy('locate');onError('');setStatus('正在识别点击对象…')
    try {
      const response=await fetch('/api/skills/assets/locate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:image,kind,mark,hint:target})}),result=await response.json()
      if(!response.ok)throw Error(result.error||'对象识别失败')
      onPoints(result.points);onStrokes([]);onTarget(result.name);onReview(false)
      setStatus(`AI 建议范围 · 置信度${({high:'高',medium:'中',low:'低'} as Record<string,string>)[result.confidence]||'待确认'}${result.notes?` · ${result.notes}`:''}`)
    }catch(error){setStatus('');onError(error instanceof Error?error.message:'识别失败，请补充对象名称或手动调整')}
    finally{inFlight.current=false;onBusy('')}
  }
  function choose(next:Tool){setTool(next);gesture.current=null;if(next==='polygon'||next==='rect'){onPoints([]);onStrokes([]);onMark(undefined);setStatus('手动定义对象范围');changed()}}
  return <div className="object-selector">
    <div className="object-step"><span>01</span><div><strong>选择要调整的对象</strong><small>{onPoint?`连续点选 1、2、3、4，分别绑定${kind==='material'?'材质':'模型'}`:'点击物体，识别范围，再绑定右侧资产'}</small></div></div>
    <div className="object-tools"><button disabled={locked&&!onPoint} className={tool==='point'?'active':''} onClick={()=>choose('point')}><MousePointer2 size={13}/>点选对象</button>{!pointOnly&&<><button disabled={locked||points.length<3} className={tool==='add'?'active':''} onClick={()=>choose('add')}><Plus size={13}/>加选</button><button disabled={locked||points.length<3} className={tool==='subtract'?'active':''} onClick={()=>choose('subtract')}><Minus size={13}/>减选</button><button disabled={locked||!strokes.length&&points.length===0} aria-label="撤销选区调整" onClick={()=>{if(strokes.length)onStrokes(strokes.slice(0,-1));else onPoints(tool==='polygon'?points.slice(0,-1):[]);changed()}}><Undo2 size={13}/></button><details className="object-more"><summary>更多</summary><button disabled={locked} onClick={()=>choose('polygon')}>多边形微调</button><button disabled={locked} onClick={()=>choose('rect')}>矩形范围</button><button disabled={locked} onClick={()=>{onPoints([]);onStrokes([]);onMark(undefined);setStatus('');changed();setTool('point')}}>重新选择</button></details></>}</div>
    {(tool==='add'||tool==='subtract')&&<label className="object-brush-size">笔刷大小<input aria-label="选区笔刷大小" type="range" min={.005} max={.08} step={.005} value={width} onChange={e=>setWidth(Number(e.target.value))}/><span>{Math.round(width*100)}%</span></label>}
    <div className="asset-source-surface"><div className={`asset-image-stage object-stage tool-${tool}`}><img src={image} alt="资产操作底图" draggable={false} onLoad={e=>setRatio(e.currentTarget.naturalHeight/e.currentTarget.naturalWidth)}/><svg aria-label="点选目标对象" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" onPointerDown={e=>{
      if(locked&&!(tool==='point'&&onPoint))return;e.currentTarget.setPointerCapture(e.pointerId);const p=coordinate(e);if(tool==='point'&&onPoint){onPoint(p);return}changed()
      if(tool==='point'){onMark(p);onPoints([]);onStrokes([]);onTarget('');setStatus('已放置对象标记，点击「识别对象」获取建议范围');return}
      if(tool==='polygon'){onPoints([...points,p]);return}
      gesture.current=p
      if(tool==='rect'){onPoints([p,p,p,p]);onStrokes([])}else onStrokes([...strokes,{mode:tool,points:[p],width}])
    }} onPointerMove={e=>{
      if(!gesture.current||locked)return;const p=coordinate(e)
      if(tool==='rect'){const a=gesture.current,x=Math.min(a[0],p[0]),y=Math.min(a[1],p[1]),w=Math.abs(a[0]-p[0]),h=Math.abs(a[1]-p[1]);onPoints([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])}
      else if(tool==='add'||tool==='subtract'){const last=strokes[strokes.length-1];if(last&&last.points.length<3000)onStrokes([...strokes.slice(0,-1),{...last,points:[...last.points,p]}])}
    }} onPointerUp={()=>{gesture.current=null}} onPointerCancel={()=>{gesture.current=null}}>
      {markers?.filter(m=>m.id!==activeId&&m.points.length>2).map(m=><polygon key={m.id} points={m.points.map(p=>`${p[0]*1000},${p[1]*height}`).join(' ')} fill={m.color} fillOpacity=".12" stroke={m.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
      <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height={height}><rect width="1000" height={height} fill="black"/>{points.length>2&&<polygon points={points.map(p=>`${p[0]*1000},${p[1]*height}`).join(' ')} fill="white"/>}{strokes.map((s,i)=><g key={i}>{s.points.length>1&&<polyline points={s.points.map(p=>`${p[0]*1000},${p[1]*height}`).join(' ')} fill="none" stroke={s.mode==='add'?'white':'black'} strokeWidth={s.width*1000} strokeLinecap="round" strokeLinejoin="round"/>}{s.points.map((p,j)=><circle key={j} cx={p[0]*1000} cy={p[1]*height} r={s.width*500} fill={s.mode==='add'?'white':'black'}/>)}</g>)}</mask></defs>
      <rect width="1000" height={height} fill={activeColor} fillOpacity=".35" mask={`url(#${maskId})`}/>
      {points.length>1&&<polygon points={points.map(p=>`${p[0]*1000},${p[1]*height}`).join(' ')} fill="none" stroke={activeColor} strokeDasharray="5 4" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
      {tool==='polygon'&&points.map((p,i)=><circle key={i} cx={p[0]*1000} cy={p[1]*height} r={5} fill="white" stroke={activeColor}/>)}
    </svg>{markers?.map((m,i)=>m.mark&&<button key={m.id} className={`object-pin material-pin ${m.id===activeId?'active':''}`} style={{left:`${m.mark[0]*100}%`,top:`${m.mark[1]*100}%`}} onClick={()=>onMarker?.(m.id)}><b style={{background:m.status==='error'?'#cc6675':m.color}}>{m.status==='locating'?<LoaderCircle size={12} className="asset-spin"/>:i+1}</b></button>)}{!markers&&mark&&<div className="object-pin" style={{left:`${mark[0]*100}%`,top:`${mark[1]*100}%`}}><b>{busy==='locate'?<LoaderCircle size={12} className="asset-spin"/>:'1'}</b>{target&&<span>{target}</span>}</div>}
    {!mark&&!points.length&&<div className="object-stage-hint"><MousePointer2 size={16}/><span>在要替换的物体上点一下</span></div>}</div></div>
    <div className="object-selection-status"><span className={reviewed?'reviewed':''}>{reviewed?<Check size={13}/>:<Sparkles size={13}/>} {reviewed?'对象范围已确认':statusText||status|| (points.length?'检查范围后确认，可用加选／减选修边':'无需沿边缘逐点圈选')}</span><div>{!onPoint&&<button disabled={locked||!mark} onClick={()=>void locate()}>{busy==='locate'?'正在识别…':points.length?'重新识别':'识别对象'}</button>}{!onPoint&&points.length>=3&&<button className="confirm" disabled={locked||reviewed} onClick={()=>onReview(true)}>{reviewed?'已确认':'确认范围'}</button>}</div></div>
    {!pointOnly&&<small className="object-selection-note">点选识别提供 AI 建议轮廓；请检查遮挡与边缘后确认。手动微调不会调用模型。</small>}
  </div>
}

