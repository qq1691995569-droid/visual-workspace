import type { Node } from '@xyflow/react'

/** Fit idle groups to their content while preserving every child's world position. */
export function fitGroupNodes<N extends Node>(nodes: N[]): N[] {
  let next = nodes
  for (const original of nodes) {
    if (original.data.kind !== 'group') continue
    // A settled collection has fixed dimensions. Its contents need no layout scan.
    if (original.data.collapsed && original.width === 280 && original.height === 330 && original.style?.width === 280 && original.style?.height === 330) continue
    const group = next.find(n => n.id === original.id)!
    const children = next.filter(n => n.parentId === group.id)
    if (group.dragging || group.resizing || children.some(n => n.dragging || n.resizing)) continue
    const folded = !!group.data.collapsed
    if (!folded && !children.length) continue
    const left = folded ? 0 : Math.min(...children.map(n => n.position.x)) - 28
    const top = folded ? 0 : Math.min(...children.map(n => n.position.y)) - 64
    const right = folded ? 280 : Math.max(...children.map(n => n.position.x + (n.measured?.width || Number(n.style?.width) || 340))) + 28
    const bottom = folded ? 330 : Math.max(...children.map(n => n.position.y + (n.measured?.height || Number(n.style?.height) || 420))) + 28
    const width = folded ? 280 : Math.max(280, right - left)
    const height = folded ? 330 : Math.max(180, bottom - top)
    const saved = group.data.expandedSize as {width?:number;height?:number}|undefined
    if (left === 0 && top === 0 && width === group.style?.width && height === group.style?.height && group.width === width && group.height === height && (folded || saved?.width === width && saved?.height === height)) continue
    next = next.map(n => n.id === group.id ? {
      ...n, position: { x: n.position.x + left, y: n.position.y + top }, width, height,
      measured: { ...n.measured, width, height }, style: { ...n.style, width, height },
      data: folded ? n.data : { ...n.data, expandedSize: { width, height } },
    } : n.parentId === group.id && (left !== 0 || top !== 0) ? {
      ...n, position: { x: n.position.x - left, y: n.position.y - top },
    } : n)
  }
  return next
}

export function absolutePosition(id: string, nodes: Node[]) {
  let node = nodes.find(n => n.id === id)
  const position = { x: 0, y: 0 }
  const seen = new Set<string>()
  while (node) {
    if (seen.has(node.id)) throw Error('分组层级存在循环')
    seen.add(node.id)
    position.x += node.position.x; position.y += node.position.y
    node = node.parentId ? nodes.find(n => n.id === node!.parentId) : undefined
  }
  return position
}

// Reserve a local row beside its source, never beyond the global canvas bounds.
export function nextBatchPosition(sourceId: string, nodes: Node[], batch = { count: 4, height: 454 }) {
  const sourceNode = nodes.find(n => n.id === sourceId)
  const source = absolutePosition(sourceId, nodes), gap = 40
  const x = source.x + (Number(sourceNode?.style?.width) || sourceNode?.measured?.width || 350) + 100
  const width = Math.max(1, batch.count) * 380 - 40, height = batch.height
  const ancestors = new Set<string>()
  let parent = sourceNode?.parentId
  while (parent && !ancestors.has(parent)) { ancestors.add(parent); parent = nodes.find(n => n.id === parent)?.parentId }
  function hidden(node: Node) {
    const seen = new Set<string>(); let id = node.parentId
    while (id && !seen.has(id)) { seen.add(id); const parent = nodes.find(n => n.id === id); if (parent?.data.collapsed) return true; id = parent?.parentId }
    return node.hidden
  }
  const obstacles = nodes.filter(n => n.id !== sourceId && !ancestors.has(n.id) && !hidden(n)).map(n => ({...absolutePosition(n.id, nodes), width:Number(n.style?.width)||n.measured?.width||340, height:Number(n.style?.height)||n.measured?.height||420})).filter(n => x < n.x+n.width+gap && x+width+gap > n.x)
  const candidates = [source.y, ...obstacles.flatMap(n => [n.y+n.height+gap, n.y-height-gap])].sort((a,b)=>Math.abs(a-source.y)-Math.abs(b-source.y)||b-a)
  const y = candidates.find(y => obstacles.every(n => y+height+gap <= n.y || y >= n.y+n.height+gap)) ?? source.y
  return {x,y}
}

export function groupBounds(nodes: Node[]) {
  if (nodes.length < 2) throw Error('请至少选择两个未分组节点')
  if (nodes.some(n => n.parentId || n.data.kind === 'group')) throw Error('请先解除已有分组，再创建新分组')
  const left = Math.min(...nodes.map(n => n.position.x)) - 28
  const top = Math.min(...nodes.map(n => n.position.y)) - 64
  const right = Math.max(...nodes.map(n => n.position.x + (Number(n.style?.width) || n.measured?.width || 340))) + 28
  const bottom = Math.max(...nodes.map(n => n.position.y + (n.measured?.height || Number(n.style?.height) || 350))) + 28
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function detachGroup<N extends Node>(id: string, nodes: N[]): N[] {
  return nodes.filter(n => n.id !== id).map(n => {
    if (n.parentId !== id) return n
    const position = absolutePosition(n.id, nodes)
    const { parentId: _parent, extent: _extent, expandParent: _expand, ...rest } = n
    return { ...rest, position, selected: true } as N
  })
}
