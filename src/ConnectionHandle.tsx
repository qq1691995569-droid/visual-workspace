import {Handle,useStore,useStoreApi,useConnection,useNodeId,useUpdateNodeInternals} from '@xyflow/react'
import {useLayoutEffect, type ComponentProps} from 'react'

// Compensate only the port's display scale; the graph and connection anchors
// continue to use React Flow's node coordinates.
export function ConnectionHandle(props:ComponentProps<typeof Handle>) {
  const connection=useConnection()
  const nodeId=useNodeId()
  const updateInternals=useUpdateNodeInternals()
  useLayoutEffect(()=>{if(nodeId) updateInternals(nodeId)},[nodeId,updateInternals])
  const label=props.type==='source'?'拖动连接到其他节点':'接入图片或节点'
  return <Handle {...props} className={`canvas-connection-port ${connection.inProgress?'port-dragging':''} ${props.className||''}`} aria-label={props['aria-label']||label} title={props.title||label} style={props.style}/>
}

// One geometry update per zoom commit, rather than one per handle. The latter
// repeatedly measured and published the entire graph during the same frame.
export function ConnectionGeometry() {
  const zoom=useStore(state=>state.transform[2])
  const store=useStoreApi()
  const updateInternals=useUpdateNodeInternals()
  useLayoutEffect(()=>{
    const {domNode,nodeLookup}=store.getState()
    // Display-only port size is inherited; hundreds of handles need no zoom subscription.
    domNode?.style.setProperty('--port-scale',String(1/Math.max(zoom,.05)))
    // Image anchors are fixed at 1px. Only tool/group handles change geometry.
    const ids=[...nodeLookup.values()].filter(n=>n.data.kind!=='image').map(n=>n.id)
    if(ids.length)updateInternals(ids)
  },[zoom,store,updateInternals])
  return null
}
