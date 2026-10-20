import { useEffect, useRef } from 'react'
import { Background, BackgroundVariant } from '@xyflow/react'

/** A shared SVG grid, with a small pointer-following highlight; no per-dot DOM. */
export function CanvasBackground() {
  const highlight = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const layer = highlight.current
    const surface = layer?.closest('.react-flow')
    if (!layer || !surface) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let x = 0
    let y = 0
    const hide = () => {
      cancelAnimationFrame(frame)
      frame = 0
      layer.style.opacity = '0'
    }
    const move = (event: Event) => {
      const pointer = event as PointerEvent
      const target = pointer.target
      if (reducedMotion.matches || pointer.pointerType === 'touch' || pointer.buttons ||
          !(target instanceof Element) || !target.classList.contains('react-flow__pane') ||
          surface.closest('.canvas-editing')) {
        hide()
        return
      }
      const bounds = surface.getBoundingClientRect()
      x = pointer.clientX - bounds.left
      y = pointer.clientY - bounds.top
      if (!frame) frame = requestAnimationFrame(() => {
        layer.style.setProperty('--pointer-x', `${x}px`)
        layer.style.setProperty('--pointer-y', `${y}px`)
        layer.style.opacity = '1'
        frame = 0
      })
    }
    surface.addEventListener('pointermove', move, { passive: true })
    surface.addEventListener('pointerleave', hide)
    surface.addEventListener('pointerdown', hide, true)
    surface.addEventListener('wheel', hide, { passive: true })
    window.addEventListener('blur', hide)
    reducedMotion.addEventListener('change', hide)
    return () => {
      hide()
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', hide)
      surface.removeEventListener('pointerdown', hide, true)
      surface.removeEventListener('wheel', hide)
      window.removeEventListener('blur', hide)
      reducedMotion.removeEventListener('change', hide)
    }
  }, [])
  return <>
    <Background id="canvas-dots" variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--canvas-dot-color)" bgColor="transparent" />
    <div ref={highlight} className="canvas-dot-highlight" aria-hidden="true">
      <Background id="canvas-dots-hover" variant={BackgroundVariant.Dots} gap={24} size={1.6} color="#7799c8" bgColor="transparent" />
    </div>
  </>
}
