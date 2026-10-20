import {Handle,useStore,useConnection} from '@xyflow/react'
import type {ComponentProps,CSSProperties} from 'react'

// Compensate only the port's display scale; the graph and connection anchors
// continue to use React Flow's node coordinates.
export function ConnectionHandle(props:ComponentProps<typeof Handle>) {
  const zoom=useStore(state=>state.transform[2])
  const connection=useConnection()
  const label=props.type==='source'?'拖动连接到其他节点':'接入图片或节点'
  return <Handle {...props} className={`canvas-connection-port ${connection.inProgress?'port-dragging':''} ${props.className||''}`} aria-label={props['aria-label']||label} title={props.title||label} style={{...props.style,'--port-scale':1/Math.max(zoom,.05)} as CSSProperties}/>
}
