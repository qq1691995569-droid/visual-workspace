// Background result updates must clear the placeholder marker, while retaining
// the user's per-image edits and the immutable recipe of an existing result.
export function resultData<T extends Record<string, unknown>>(existing: T, generated: T): T {
  const previousJob = (existing.skillResult as {jobId?:string} | undefined)?.jobId
  const nextJob = (generated.skillResult as {jobId?:string} | undefined)?.jobId
  const newIteration = !!previousJob && !!nextJob && previousJob !== nextJob
  return { ...existing, ...generated, version: existing.version || generated.version, previewSrc: generated.src && generated.src !== existing.src ? generated.previewSrc : generated.previewSrc || existing.previewSrc, pendingResult: undefined, localEdit: newIteration ? generated.localEdit : existing.localEdit || generated.localEdit, comparison: existing.comparison || generated.comparison, refinementDraft: newIteration ? undefined : existing.refinementDraft, iterationContext: newIteration ? generated.iterationContext : existing.iterationContext || generated.iterationContext }
}
