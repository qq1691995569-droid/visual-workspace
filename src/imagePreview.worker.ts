/// <reference lib="webworker" />
// Decode and resize away from the interaction thread. Requests are serialized
// by the client to avoid decoding many original photographs simultaneously.
self.onmessage = async ({ data }: MessageEvent<{ id: number; src: string; edge: number }>) => {
  let bitmap: ImageBitmap | undefined
  try {
    const blob = await (await fetch(data.src)).blob()
    bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, data.edge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1) { self.postMessage({ id: data.id, original: true }); return }
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw Error('Preview context unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const output = await canvas.convertToBlob({ type: blob.type === 'image/png' ? 'image/png' : 'image/jpeg', quality: .86 })
    self.postMessage({ id: data.id, blob: output, bytes: width * height * 4 })
  } catch { self.postMessage({ id: data.id, error: true }) }
  finally { bitmap?.close() }
}
