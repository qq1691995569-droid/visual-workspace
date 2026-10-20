import { useEffect, useState } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'
type Version = { version: number; rules: string[] }
type Registry = { activeVersion: number; versions: Version[] }
type JobRecord = { id: string; status: string; supplement: string; skillVersion: number; adjustments: { builtin: string; user: string; resolution: string }[]; effectiveRules: string[] }
export function SkillAdmin({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Registry>(), [selected, setSelected] = useState(2), [rules, setRules] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [jobs, setJobs] = useState<JobRecord[]>([])
  useEffect(() => {
    let active = true
    fetch('/api/skills/admin').then(r => r.json()).then((value: Registry) => { if (active) { setData(value); setSelected(value.activeVersion); setRules(value.versions.find(v => v.version === value.activeVersion)?.rules.join('\n') || '') } }).catch(() => { if (active) setMessage('功能配置读取失败') })
    fetch('/api/skills/admin/jobs').then(r => r.json()).then(value => { if (active && Array.isArray(value)) setJobs(value) }).catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  async function save(mode: 'publish' | 'activate') {
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/skills/admin/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'publish' ? { rules: rules.split('\n').map(r => r.trim()).filter(Boolean) } : { version: selected }) })
      const value = await response.json(); if (!response.ok) throw Error(value.error)
      setData(value); setSelected(value.activeVersion); setRules(value.versions.find((v: Version) => v.version === value.activeVersion).rules.join('\n')); setMessage(`V${value.activeVersion} 已启用，仅影响新任务`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : '保存失败') } finally { setBusy(false) }
  }
  return <div className="skill-admin-backdrop" onClick={onClose}><section className="skill-admin" role="dialog" aria-modal="true" aria-label="功能后台管理" onClick={e => e.stopPropagation()}><header><div><strong>功能管理</strong><small>场景风格转换</small></div><button aria-label="关闭功能管理" onClick={onClose}><X size={18} /></button></header><div className="skill-admin-content"><p>用户补充说明优先于内置默认。系统自动协调冲突，任务保留实际规则与调整记录。</p><label>功能版本<select aria-label="后台功能版本" value={selected} onChange={e => { const version = Number(e.target.value); setSelected(version); setRules(data?.versions.find(v => v.version === version)?.rules.join('\n') || '') }}>{data?.versions.map(v => <option value={v.version} key={v.version}>V{v.version}{v.version === data.activeVersion ? ' · 当前启用' : ''}</option>)}</select></label><label>内置处理规则<small>每行一条；保存会创建新版本，历史版本保留</small><textarea aria-label="后台功能规则" value={rules} disabled={busy} onChange={e => setRules(e.target.value)} /></label><div className="skill-admin-actions"><button disabled={busy || !data || selected === data.activeVersion} onClick={() => void save('activate')}><RotateCcw size={14} />启用所选版本</button><button className="primary" disabled={busy || !rules.trim()} onClick={() => void save('publish')}><Save size={14} />保存为新版本并启用</button></div>{message && <p role="status">{message}</p>}<h3>最近任务与规则调整</h3>{!jobs.length && <small>暂无执行记录</small>}{jobs.map(job => <details key={job.id}><summary>V{job.skillVersion} · {job.status} · {job.id.slice(0,8)}</summary><p>补充说明：{job.supplement || '无'}</p>{job.adjustments.map((change, i) => <p key={i}>默认：{change.builtin}<br />用户：{change.user}<br />调整：{change.resolution}</p>)}<pre>{job.effectiveRules.join('\n')}</pre></details>)}<p className="admin-pending">此面板管理场景风格转换规则；其他功能使用各自的技能配置。</p></div></section></div>
}
