import type { Node } from '@xyflow/react'

export function fitGroupNodes<N extends Node>(nodes: N[]): N[] {
  let changed = false
  const next = nodes.map(group => {
    if (group.data.kind !== 'group') return group
    const children = nodes.filter(n => n.parentId === group.id)
    const width = group.data.collapsed ? 280 : Math.max(Number(group.style?.width) || 280, ...children.map(n => n.position.x + (Number(n.style?.width) || n.measured?.width || 340) + 28))
    const height = group.data.collapsed ? 330 : Math.max(Number(group.style?.height) || 180, ...children.map(n => n.position.y + (Number(n.style?.height) || (!n.data.collapsed && (n.data.expandedSize as {height?:number})?.height) || n.measured?.height || 420) + 28))
    if (width === group.style?.width && height === group.style?.height && (!group.data.collapsed || group.width === width && group.height === height)) return group
    changed = true
    return { ...group, width, height, style: { ...group.style, width, height } }
  })
  return changed ? next : nodes
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
