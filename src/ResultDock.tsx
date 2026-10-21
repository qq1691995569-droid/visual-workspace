import { CanvasSelect } from './CanvasSelect'
import { ArrowUp, Check, Cpu, Image, Layers, LoaderCircle, Ratio, Scan, Sparkles, Columns2, X } from 'lucide-react'
import { modelOptions, ratios } from './generation'
import './ResultDock.css'

type Options = { model: string; resolution: string; ratio: string; count: number }
export function ResultDock({ embedded = false, settingsSummary, label, image, references, referenceLabel, prompt, options, skill, skillName, busy, message, onDraft, onClose, onCompare, onGenerate }: {
  embedded?: boolean; settingsSummary?:string; label: string; image: string; references: { id: string; src?: string; label: string }[]; prompt: string; options: Options; skill: boolean; skillName?: string; referenceLabel?: string; busy?: boolean; message?: string; onDraft: (prompt: string, options: Options) => void;
  onCompare?: () => void; onClose: () => void; onGenerate: (prompt: string, options: Options) => void;
}) {
  const setSettings = (value: Options) => onDraft(prompt, value)
  const canGenerate = !busy && !!prompt.trim()
  const placeholder = settingsSummary ? '想怎样调整光影？例如：光线暖一点、阴影柔和些…' : skillName?.includes('材质') ? '想怎样调整材质？例如：地板换成浅橡木…' : '描述这次想修改的内容…' 
  return <section className={`result-dock${embedded ? " embedded" : ""}`} aria-label="生成图片信息">
    <div className="refine-heading"><div><Sparkles size={15} /><strong>{skillName || "图像编辑"}</strong>{settingsSummary && <span className="refine-skill-tag" title={settingsSummary}>参数已沿用</span>}</div><div className="refine-heading-actions">{onCompare && <button className="refine-compare" onClick={onCompare}><Columns2 size={13} />滑块对比</button>}<button className="refine-close" aria-label="关闭生成信息" onClick={onClose}><X size={16} /></button></div></div>
    <div className="refine-context"><div className="refine-current"><img width={48} height={48} src={image} alt={`当前修改图片：${label}`} /><div><span>编辑图片</span><strong title={label}>{label}</strong></div><span className="refine-selected"><Check size={10} /></span></div>{references.length > 0 && <div className="refine-references"><span>{referenceLabel || (settingsSummary ? '光影设置' : skill ? '风格参考' : '原参考')}</span><div>{references.length ? references.map((n, i) => <span className="refine-reference" key={n.id} title={n.label}><img width={40} height={40} src={n.src} alt={n.label} /><small>{i + 1}</small></span>) : <small className="refine-no-reference">{settingsSummary || "未关联参考图"}</small>}</div></div>}</div>
    <div className="refine-editor"><textarea maxLength={5000} aria-label={skill ? '结果补充说明' : '结果生成说明'} placeholder={placeholder} value={prompt} onChange={e => onDraft(e.target.value, options)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (canGenerate) onGenerate(prompt, options) } }} /><div className="refine-editor-caption"><span title="本次描述优先于原方案，未提及的设置继续沿用">仅描述本次修改</span><span>{prompt.length > 0 ? `${prompt.length} / 5000` : '⌘ / Ctrl + Enter 生成'}</span></div></div>
    <div className="refine-footer"><div className="refine-controls">
      <label className="refine-param refine-model" title="生图模型"><Cpu size={13} /><CanvasSelect aria-label="结果生图模型" value={options.model} disabled={busy} onChange={e => setSettings({ ...options, model: e.target.value })}>{modelOptions.filter(m => m.tag !== '待接入').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</CanvasSelect></label>
      <label className="refine-param" title="画质"><Scan size={13} /><CanvasSelect aria-label="结果画质" value={options.resolution} disabled={busy} onChange={e => setSettings({ ...options, resolution: e.target.value })}>{['1K','2K','4K'].map(r => <option key={r}>{r}</option>)}</CanvasSelect></label>
      <label className="refine-param" title="画面比例"><Ratio size={13} /><CanvasSelect aria-label="结果尺寸" value={options.ratio} disabled={busy} onChange={e => setSettings({ ...options, ratio: e.target.value })}>{skill && <option value="auto">沿用原图</option>}{ratios.map(r => <option key={r}>{r}</option>)}</CanvasSelect></label>
      <label className="refine-param" title="生成数量"><Layers size={13} /><CanvasSelect aria-label="结果张数" value={options.count} disabled={busy} onChange={e => setSettings({ ...options, count: Number(e.target.value) })}>{Array.from({ length: 4 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 张</option>)}</CanvasSelect></label>
    </div><button className="refine-submit" disabled={!canGenerate} onClick={() => onGenerate(prompt, options)}>{busy ? <LoaderCircle className="refine-spinner" size={15} /> : <ArrowUp size={16} />}<span>{busy ? '正在生成' : '生成图片'}</span></button></div>
    {message && <div className={`refine-task-status ${busy ? 'is-busy' : ''}`} role="status"><Image size={11} /><span title={message}>{message}</span></div>}
  </section>
}
