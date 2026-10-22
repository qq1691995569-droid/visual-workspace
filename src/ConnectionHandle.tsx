import {Handle,useStoreApi,useConnection,useNodeId,useUpdateNodeInternals} from '@xyflow/react'
import {useLayoutEffect, type ComponentProps} from 'react'
import {publishSettledZoom} from './settledViewport'

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
  const store=useStoreApi()
  const updateInternals=useUpdateNodeInternals()
  useLayoutEffect(()=>{
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = () => {
    const {domNode,nodeLookup,transform}=store.getState()
    const zoom=transform[2]
    domNode?.classList.remove('viewport-interacting')
    publishSettledZoom(zoom)
    // Display-only port size is inherited; hundreds of handles need no zoom subscription.
    domNode?.style.setProperty('--port-scale',String(1/Math.max(zoom,.05)))
    domNode?.style.setProperty('--canvas-zoom',String(zoom))
    // Image anchors are fixed at 1px. Only tool/group handles change geometry.
    const ids=[...nodeLookup.values()].filter(n=>!n.hidden && n.data.kind!=='image').map(n=>n.id)
    if(ids.length)updateInternals(ids)
    }
    commit()
    const unsubscribe=store.subscribe((state,previous)=>{
      if(state.transform===previous.transform)return
      state.domNode?.classList.add('viewport-interacting')
      clearTimeout(timer)
      timer=setTimeout(commit,150)
    })
    return ()=>{unsubscribe();clearTimeout(timer);store.getState().domNode?.classList.remove('viewport-interacting')}
  },[store,updateInternals])
  return null
}
