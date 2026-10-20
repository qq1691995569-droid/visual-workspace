import {useState} from 'react'
export function PersonExtraction({image,onStart}:{image:string;onStart:(focus:string)=>void}) {
  const [focus,setFocus]=useState('')
  return <div className="person-extraction"><img src={image} alt="人物提取参考图片"/><strong>提取人物参考</strong><p>全身照 + 综合细节图，共 2 张</p><label className="asset-field">人物说明（可选）<input value={focus} maxLength={200} placeholder="多人画面请指定，例如：左侧穿白衣的人物" onChange={e=>setFocus(e.target.value)}/></label><button className="asset-primary" onClick={()=>onStart(focus)}>提取到画布</button><small>综合图包含正侧背全身、肖像、眼部、嘴唇和发型。完成后保存到人物库；不可见部位为 AI 推演。</small></div>
}
