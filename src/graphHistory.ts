import type { Node, Edge } from '@xyflow/react'

type Graph = { nodes: Node[]; edges: Edge[] }
type Change = { id: string; before?: Node | Edge; after?: Node | Edge; fields?: string[]; dataFields?: string[]; skillFields?: string[] }
export type GraphCommand = { nodes: Change[]; edges: Change[] }
const nodeFields = ['position', 'style', 'width', 'height', 'parentId', 'extent', 'expandParent']
const dataFields = ['label', 'prompt', 'generation', 'final', 'collapsed', 'expandedSize', 'refinementDraft', 'localEdit']
const skillFields = ['baseId', 'referenceIds', 'supplement', 'options', 'protection', 'confirmed']
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const fieldsChanged = (before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) => keys.filter(key => !equal(before[key], after[key]))

export function graphCommand(before: Graph, after: Graph): GraphCommand | null {
  const nodes: Change[] = [], edges: Change[] = []
  const beforeNodes=new Map(before.nodes.map(n=>[n.id,n])), afterNodes=new Map(after.nodes.map(n=>[n.id,n]))
  const beforeEdges=new Map(before.edges.map(e=>[e.id,e])), afterEdges=new Map(after.edges.map(e=>[e.id,e]))
  for (const id of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const a = beforeNodes.get(id), b = afterNodes.get(id)
    if(a===b)continue
    if (!a || !b) {
      // Background generation creates outputs without consuming a user undo step.
      if(!a&&b&&b.data.extraction)continue
      if (!a && b && b.id.startsWith('skill-') && (b.data.pendingResult || b.data.skillResult)) continue
      nodes.push({ id, before: a, after: b }); continue
    }
    if(a.data.extraction&&!a.data.src&&b.data.src)continue
    if (a.data.pendingResult && !b.data.pendingResult || !a.data.imageOutput && b.data.imageOutput) continue
    const fields = fieldsChanged(a, b, nodeFields)
    const data = fieldsChanged(a.data, b.data, dataFields.filter(key => key !== 'label' || !b.data.skillResult&&!b.data.extraction))
    const skills = fieldsChanged((a.data.skillState || {}) as Record<string, unknown>, (b.data.skillState || {}) as Record<string, unknown>, skillFields)
    if (fields.length || data.length || skills.length) nodes.push({ id, before: a, after: b, fields, dataFields: data, skillFields: skills })
  }
  for (const id of new Set([...before.edges, ...after.edges].map(e => e.id))) {
    const a = beforeEdges.get(id), b = afterEdges.get(id)
    if(a===b)continue
    if (!a && b && b.id.startsWith('result-') && after.nodes.some(n => n.id === b.target && (n.data.pendingResult || n.data.skillResult || n.data.extraction))) continue
    if (!a || !b || (['source','target','sourceHandle','targetHandle'] as const).some(key => !equal(a[key], b[key]))) edges.push({ id, before: a, after: b })
  }
  return nodes.length || edges.length ? { nodes, edges } : null
}

export function applyGraphCommand<N extends Node>(graph: { nodes: N[]; edges: Edge[] }, command: GraphCommand, direction: 'undo' | 'redo'): { nodes: N[]; edges: Edge[] } {
  let nodes: Node[] = [...graph.nodes], edges = [...graph.edges]
  const side = direction === 'undo' ? 'before' : 'after'
  for (const change of command.nodes) {
    const value = change[side] as Node | undefined
    if (!change.fields) {
      nodes = nodes.filter(n => n.id !== change.id)
      if (value) nodes.push(value)
      continue
    }
    nodes = nodes.map(n => {
      if (n.id !== change.id || !value) return n
      const result = { ...n, data: { ...n.data } } as Node & Record<string, unknown>
      for (const field of change.fields!) result[field] = (value as Node & Record<string, unknown>)[field]
      for (const field of change.dataFields || []) result.data[field] = value.data[field]
      if (change.skillFields?.length) {
        const skill = { ...(n.data.skillState as Record<string, unknown> || {}) }
        for (const field of change.skillFields) skill[field] = (value.data.skillState as Record<string, unknown> || {})[field]
        result.data.skillState = skill
      }
      return result
    })
  }
  for (const change of command.edges) {
    edges = edges.filter(e => e.id !== change.id)
    const value = change[side] as Edge | undefined
    if (value) edges.push(value)
  }
  // Parents must precede children in React Flow.
  nodes.sort((a,b) => Number(!!a.parentId) - Number(!!b.parentId))
  const ids = new Set(nodes.map(n => n.id))
  return { nodes: nodes as N[], edges: edges.filter(e => ids.has(e.source) && ids.has(e.target)) }
}

