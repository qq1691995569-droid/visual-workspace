// Background result updates must clear the placeholder marker, while retaining
// the user's per-image edits and the immutable recipe of an existing result.
export function resultData<T extends Record<string, unknown>>(existing: T, generated: T): T {
  return { ...existing, ...generated, version: existing.version || generated.version, previewSrc: generated.src && generated.src !== existing.src ? generated.previewSrc : generated.previewSrc || existing.previewSrc, pendingResult: undefined, localEdit: existing.localEdit || generated.localEdit, comparison: existing.comparison || generated.comparison, iterationContext: existing.iterationContext || generated.iterationContext }
}
