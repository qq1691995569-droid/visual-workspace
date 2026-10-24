import type { Node } from '@xyflow/react'

export type StackCrop = { x: number; y: number; width: number; height: number; frameWidth: number; frameHeight: number }
type LayerData = { kind?: string; layerStack?: boolean; layerLayoutVersion?: number; stackLayer?: boolean; stackCrop?: StackCrop; transparentLayer?: boolean; layerIndex?: number; collapsed?: boolean; expandedSize?: { width: number; height: number }; dimensions?: string; previewSrc?: string; skillResult?: { review?: Record<string, string> }; version?: { parentId?: string } }

function dimensions(node: Node): { width: number; height: number } | undefined {
  const match = (node.data as LayerData).dimensions?.match(/^(\d+)\s*×\s*(\d+)$/)
  if (!match) return
  const width = Number(match[1]), height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : undefined
}

/** Keep native background and alpha layers on the same image rectangle. Also upgrades saved row layouts. */
export function restackLayerGroups<N extends Node>(nodes: N[]): N[] {
  let next = nodes
  for (const group of nodes) {
    const groupData = group.data as LayerData
    if (groupData.kind !== 'group' || groupData.layerLayoutVersion === 2) continue
    const children = next.filter(node => node.parentId === group.id && (node.data as LayerData).skillResult?.review?.layer)
    if (children.length < 2) continue
    const frame = dimensions(children[0])
    if (!frame || children.some(child => { const size = dimensions(child); return !size || size.width !== frame.width || size.height !== frame.height })) continue
    const sourceId = (children[0].data as LayerData).version?.parentId
    const source = next.find(node => node.id === sourceId)
    const width = Math.max(80, Number(groupData.layerStack ? group.style?.width : source?.style?.width) || Number(children[0].style?.width) || 340)
    const height = width * frame.height / frame.width
    const order = new Map(children.map((child, index) => [child.id, index]))
    next = next.map(node => {
      if (node.id === group.id) return {
        ...node, width, height, measured: { ...node.measured, width, height }, style: { ...node.style, width, height },
        data: { ...node.data, layerStack: true, layerLayoutVersion: 2, collapsed: false, previewSrc: undefined, expandedSize: { width, height } },
      } as N
      const index = order.get(node.id)
      if (index === undefined) return node
      const coordinates = (node.data as LayerData).skillResult?.review?.boundingBox?.split(',').map(Number)
      const valid = index > 0 && coordinates?.length === 4 && coordinates.every(value => Number.isFinite(value) && value >= 0 && value <= 1000) && coordinates[2] > coordinates[0] && coordinates[3] > coordinates[1]
      const x = valid ? width * coordinates![0] / 1000 : 0
      const y = valid ? height * coordinates![1] / 1000 : 0
      const layerWidth = valid ? width * (coordinates![2] - coordinates![0]) / 1000 : width
      const layerHeight = valid ? height * (coordinates![3] - coordinates![1]) / 1000 : height
      const stackCrop = valid ? { x, y, width: layerWidth, height: layerHeight, frameWidth: width, frameHeight: height } : undefined
      return {
        ...node, position: { x: x + (groupData.layerStack ? node.position.x : 0), y: y + (groupData.layerStack ? node.position.y : 0) }, width: layerWidth, height: layerHeight, measured: { ...node.measured, width: layerWidth, height: layerHeight },
        style: { ...node.style, width: layerWidth, height: layerHeight }, extent: undefined, expandParent: false,
        zIndex: 4096 + index * 2048,
        data: { ...node.data, stackLayer: true, transparentLayer: index > 0, stackCrop, layerIndex: index, expandedSize: { width: layerWidth, height: layerHeight } },
      } as N
    })
  }
  return next
}
