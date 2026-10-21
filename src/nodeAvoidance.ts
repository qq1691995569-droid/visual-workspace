import type { Node } from '@xyflow/react'

/** Push neighbours within the same coordinate space, growing the parent if needed. */
export function pushNeighbours<N extends Node>(nodes: N[], dragged: N): N[] {
  if (dragged.data.kind === 'group') return nodes
  const parent = dragged.parentId ? nodes.find(n => n.id === dragged.parentId) : undefined
  if (dragged.parentId && (!parent || parent.data.collapsed)) return nodes
  const dimensions = (n: N) => ({ w: n.measured?.width || Number(n.style?.width) || 340, h: n.measured?.height || Number(n.style?.height) || 300 })
  const overlaps = (a: N, b: N) => {
    const x = dimensions(a), y = dimensions(b)
    return a.position.x < b.position.x + y.w + 24 && a.position.x + x.w + 24 > b.position.x && a.position.y < b.position.y + y.h + 24 && a.position.y + x.h + 24 > b.position.y
  }
  const next = nodes.map(n => n.id === dragged.id ? { ...n, position: dragged.position } : n)
  const queue = [dragged.id], moved = new Set([dragged.id])
  while (queue.length) {
    const id = queue.shift()
    const a = next.find(n => n.id === id)!
    for (let i = 0; i < next.length; i++) {
      const b = next[i]
      if (b.id === a.id || b.parentId !== dragged.parentId || b.hidden || !overlaps(a, b)) continue
      if (moved.has(b.id)) continue
      if (b.selected || b.draggable === false || b.data.kind === 'group') return nodes
      const sa = dimensions(a), sb = dimensions(b)
      const candidates = [
        { x: a.position.x + sa.w + 24, y: b.position.y },
        { x: a.position.x - sb.w - 24, y: b.position.y },
        { x: b.position.x, y: a.position.y + sa.h + 24 },
        { x: b.position.x, y: a.position.y - sb.h - 24 },
      ].filter(position => (!parent || (position.x >= 20 && position.y >= 50)) &&
        !next.some(n => moved.has(n.id) && overlaps(n, { ...b, position })))
      candidates.sort((p, q) => Math.hypot(p.x-b.position.x,p.y-b.position.y)-Math.hypot(q.x-b.position.x,q.y-b.position.y))
      // Dense clusters can block every adjacent slot. Move past the settled frontier.
      const position = candidates[0] || {
        x: Math.max(...next.filter(n => moved.has(n.id)).map(n => n.position.x + dimensions(n).w)) + 24,
        y: parent ? Math.max(50, b.position.y) : b.position.y,
      }
      next[i] = { ...b, position }
      moved.add(b.id); queue.push(b.id)
    }
  }
  if (moved.size < 2) return nodes
  if (parent) {
    const siblings = next.filter(n => n.parentId === parent.id)
    const size = dimensions(parent)
    const width = Math.max(size.w, ...siblings.map(n => n.position.x + dimensions(n).w + 20))
    const height = Math.max(size.h, ...siblings.map(n => n.position.y + dimensions(n).h + 20))
    const index = next.findIndex(n => n.id === parent.id)
    next[index] = { ...parent, width, height, style: { ...parent.style, width, height },
      measured: { ...parent.measured, width, height },
      data: { ...parent.data, expandedSize: { width, height } } }
  }
  return next
}
