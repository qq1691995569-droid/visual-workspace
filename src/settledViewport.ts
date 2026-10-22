// Presentation quality follows the settled viewport, not every wheel event.
// React Flow still applies every live transform immediately.
let zoom = 1
const listeners = new Set<() => void>()
export const settledZoom = () => zoom
export function subscribeSettledZoom(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function publishSettledZoom(value: number) {
  if (value === zoom) return
  zoom = value
  listeners.forEach(listener => listener())
}
