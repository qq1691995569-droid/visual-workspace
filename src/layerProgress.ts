/** Display-only estimate: image providers do not report a native percentage. */
export function estimateTaskProgress(status: string | undefined, createdAt: string | undefined, now: number): number {
  if (status === 'complete') return 100
  const started = Date.parse(createdAt || '')
  const seconds = Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : 0
  switch (status) {
    case 'analyzing': return Math.min(20, Math.floor(seconds / 2))
    case 'uploading': return Math.min(29, 22 + Math.floor(seconds / 15))
    case 'submitting': return Number.isFinite(started) ? Math.min(37, 30 + Math.floor(seconds / 20)) : 0
    case 'running': return Math.min(91, 38 + Math.floor(seconds / 4))
    case 'download_pending': return Math.min(98, 92 + Math.floor(seconds / 90))
    case 'restoring': return Math.min(98, 38 + Math.floor(seconds / 4))
    default: return Math.min(9, Math.floor(seconds / 3))
  }
}

export const estimateLayerProgress = estimateTaskProgress
