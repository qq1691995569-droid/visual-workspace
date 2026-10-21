import { useId, useLayoutEffect, useRef, useState, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './CanvasSelect.css'

type Option = { value: string; label: string; disabled: boolean }
export function CanvasSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const native = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const [selected, setSelected] = useState('')
  const [label, setLabel] = useState(''), [items, setItems] = useState<Option[]>([])
  const [open, setOpen] = useState(false), [active, setActive] = useState(0)
  const [box, setBox] = useState({ left: 0, top: 0, width: 160, maxHeight: 280 })
  useLayoutEffect(() => { setLabel(native.current?.selectedOptions[0]?.text || ''); setSelected(native.current?.value || '') }, [props.value, props.children])
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus() }
  function show() {
    if (native.current?.matches(':disabled')) return
    const options = Array.from(native.current?.options || []).map(o => ({ value: o.value, label: o.text, disabled: o.disabled }))
    setItems(options); setActive(Math.max(0, options.findIndex(o => o.value === native.current?.value)))
    const rect = trigger.current!.getBoundingClientRect(), width = Math.min(Math.max(rect.width, 168), innerWidth - 16)
    const desired = Math.min(288, options.length * 48 + 18)
    const below = innerHeight - rect.bottom - 12, above = rect.top - 12, upward = below < desired && above > below
    const height = Math.max(40, Math.min(desired, upward ? above : below))
    setBox({ left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)), top: upward ? Math.max(8, rect.top - height - 6) : rect.bottom + 6, width, maxHeight: height })
    setOpen(true)
  }
  function choose(index: number) {
    if (!native.current || native.current.matches(':disabled') || !items[index] || items[index].disabled) return
    native.current.value = items[index].value
    native.current.dispatchEvent(new Event('change', { bubbles: true }))
    close(true)
  }
  useLayoutEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!trigger.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) close() }
    const dismiss = () => close()
    document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', dismiss)
    const scroll = (e: Event) => { if (!popup.current?.contains(e.target as Node)) close() }
    document.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', dismiss); document.removeEventListener('scroll', scroll, true) }
  }, [open])
  useLayoutEffect(() => { if (open) popup.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active, open])
  return <>
    <select {...props} ref={native} id={undefined} aria-label={undefined} aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
    <button ref={trigger} type="button" id={props.id} className={`canvas-select nodrag nopan ${props.className || ''}`} style={props.style} disabled={props.disabled} title={props.title} role="combobox" aria-label={props['aria-label']} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? close() : show()} onKeyDown={e => {
        if (['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape','Tab'].includes(e.key)) {
          e.stopPropagation()
          if (e.key === 'Tab') { close(); return }
          e.preventDefault()
          if (e.key === 'Escape') { close(); return }
          if (!open) { show(); return }
          if (e.key === 'Enter' || e.key === ' ') { choose(active); return }
          const enabled = items.map((o,i) => o.disabled ? -1 : i).filter(i => i >= 0)
          const at = enabled.indexOf(active)
          setActive(e.key === 'Home' ? enabled[0] : e.key === 'End' ? enabled.at(-1)! : enabled[(at + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length] ?? 0)
        } else if (open && e.key.length === 1) {
          e.stopPropagation(); const at = items.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (at >= 0) setActive(at)
        }
      }}><span>{label}</span><ChevronDown size={15}/></button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={props['aria-label']} className="canvas-select-menu nodrag nopan nowheel" style={box} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
      {items.map((o,i) => <div key={`${o.value}-${i}`} id={`${id}-${i}`} role="option" aria-selected={o.value === selected} aria-disabled={o.disabled} data-active={i === active} onPointerMove={() => !o.disabled && setActive(i)} onMouseDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); choose(i) }}><span>{o.label}</span>{o.value === selected && <Check size={16}/>}</div>)}
    </div>, document.body)}
  </>
}
