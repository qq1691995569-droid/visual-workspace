type PreviewNode = { id: string; data: {
  kind: string; src?: string; task?: unknown; pendingResult?: unknown
  imageJob?: unknown; imageOutput?: boolean; skillResult?: {jobId: string}
} }

// Use the immutable result's job, never the source node (which can be reused).
export function previewBatch<T extends PreviewNode>(nodes: T[], selectedId: string | null): T[] {
  const images = nodes.filter(n => n.data.kind === 'image' && n.data.src && !n.data.task && !n.data.pendingResult && (!n.data.imageJob || n.data.imageOutput))
  const selected = images.find(n => n.id === selectedId)
  if (!selected) return []
  const jobId = selected.data.skillResult?.jobId
  return jobId ? images.filter(n => n.data.skillResult?.jobId === jobId) : [selected]
}
