import {useState,useRef} from 'react'
export function AssetExtraction({image,kind,onStart}:{image:string;kind:'material'|'model';onStart:(kind:'material'|'model',focus:string)=>void}) {
  const [focus,setFocus]=useState(''),guard=useRef(false)
  function start(){if(guard.current||!focus.trim())return;guard.current=true;onStart(kind,focus.trim())}
  return <div className="automatic-extraction"><div className="extraction-source"><img src={image} alt="资产反推来源图片"/><span>来源图片</span></div><div className="extraction-heading"><strong>{kind==='material'?'提取可复用材质':'提取家具／物体外观'}</strong><p>确认对象后返回画布，预览会在原图旁边生成。</p></div><label className="asset-field">要提取的对象<textarea aria-label="要反推的对象" value={focus} maxLength={300} placeholder="例如：沙发、茶几、地板、墙面" onChange={e=>setFocus(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();start()}}}/></label><div className="extraction-rules"><span><b>家具与物体</b>白底材质特写／外观</span><span><b>地板与墙面</b>空间应用预览</span></div><button className="asset-primary" disabled={!focus.trim()} onClick={start}>确认并在画布生成</button><small>将调用视觉和生图模型。生成期间可以继续操作画布，满意后点击图片上的“保存资产”；名称和材质分类会自动填好。</small></div>
}
