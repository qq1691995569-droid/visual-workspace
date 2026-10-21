import { useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'
import './ImageComparison.css'

export function ImageComparison({ original, input, result, beforeLabel, afterLabel }: { original: string; input?: string; result: string; beforeLabel?:string; afterLabel?:string }) {
  const [position, setPosition] = useState(50), [compareInput, setCompareInput] = useState(!!input)
  const before = compareInput && input ? input : original
  return <div className="comparison-view">
    <div className="comparison-stage">
      <img className="comparison-result" src={result} alt="调整结果" draggable={false} />
      <div className="comparison-original" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={before} alt={compareInput ? '本次输入图片' : '原始底图'} draggable={false} /></div>
      <span className="comparison-tag before">{beforeLabel || (compareInput ? '本次输入' : '原始底图')}</span><span className="comparison-tag after">{afterLabel || '调整结果'}</span>
      <div className="comparison-divider" style={{ left: `${position}%` }}><span className="comparison-handle"><ChevronsLeftRight size={19} /></span></div>
      <input className="comparison-slider" type="range" min={0} max={100} value={position} aria-label="原图与结果对比滑块" aria-valuetext={`原图 ${position}%，结果 ${100 - position}%`} onChange={event => setPosition(Number(event.target.value))} />
    </div>
    <div className="comparison-caption"><span>拖动滑块检查构图与细节 · 方向键微调</span>{input && input !== original && <button onClick={() => setCompareInput(value => !value)}>{compareInput ? '对比原始底图' : '对比本次输入'}</button>}</div>
  </div>
}
