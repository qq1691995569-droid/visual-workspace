import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, useStore, type EdgeProps } from '@xyflow/react'
import { memo, type CSSProperties } from 'react'
import { Unplug } from 'lucide-react'

export const CanvasEdge=memo(function CanvasEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, style, markerEnd, data }: EdgeProps) {
  const flow = useReactFlow(), zoom = useStore(state=>state.transform[2])
  const singleEdgeSelection = useStore(state => !!selected && !state.nodes.some(node => node.selected) && state.edges.filter(edge => edge.selected).length === 1)
  const showControls = selected && singleEdgeSelection
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const start = {x:sourceX,y:sourceY}, end = {x:targetX,y:targetY}
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={28} style={{ ...style, '--wire-scale': 1 / zoom } as CSSProperties} />
    <path d={path} pathLength={100} fill="none" pointerEvents="none" aria-hidden="true" className={`edge-data-stream${data?.transmitting ? ' is-transmitting' : ''}`} />
    {showControls && [start,end].map((point,index) => <circle key={index} cx={point.x} cy={point.y} r={4 / zoom} fill="#fff" stroke="#8fa5c1" strokeWidth={1.2 / zoom} pointerEvents="none" />)}
    {showControls && <EdgeLabelRenderer><button className="edge-disconnect nodrag nopan" aria-label="断开所选连线" title="断开连线 · Delete" style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${1 / zoom})` }} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); void flow.deleteElements({ edges: [{ id }] }) }}><Unplug size={13} />断开</button></EdgeLabelRenderer>}
  </>
})
