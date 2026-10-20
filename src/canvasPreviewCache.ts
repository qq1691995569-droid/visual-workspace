type Entry = { src: string; edge: number; refs: number; url?: string; bytes: number; touched: number; resolve: (url: string) => void; promise: Promise<string> }
const entries = new Map<string, Map<number, Entry>>()
const queue: Entry[] = []
let worker: Worker | undefined, unavailable = false, active: Entry | undefined, serial = 0
const budget = 64 * 1024 * 1024
function prune() {
  const all = [...entries.values()].flatMap(items => [...items.values()])
  const footprint = (item: Entry) => item.bytes + item.src.length * 2
  let bytes = all.reduce((total, item) => total + footprint(item), 0)
  for (const item of all.filter(item => !item.refs && item.url).sort((a, b) => a.touched - b.touched)) {
    if (bytes <= budget && entries.size <= 200) break
    if (item.url !== item.src) URL.revokeObjectURL(item.url!)
    bytes -= footprint(item)
    entries.get(item.src)?.delete(item.edge)
    if (!entries.get(item.src)?.size) entries.delete(item.src)
  }
}
function pump() {
  if (active) return
  while (queue.length) {
    const next = queue.shift()!
    if (!next.refs) {
      entries.get(next.src)?.delete(next.edge)
      if (!entries.get(next.src)?.size) entries.delete(next.src)
      next.resolve(next.src)
      continue
    }
    active = next
    if (!worker && !unavailable) {
      try {
        worker = new Worker(new URL('./imagePreview.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }: MessageEvent<{ blob?: Blob; bytes?: number }>) => {
          const item = active!
          item.url = data.blob ? URL.createObjectURL(data.blob) : item.src
          item.bytes = data.bytes || 0
          item.resolve(item.url)
          active = undefined
          prune(); pump()
        }
        worker.onerror = () => {
          unavailable = true; worker?.terminate(); worker = undefined
          if (active) { active.url = active.src; active.resolve(active.src); active = undefined }
          pump()
        }
      } catch { unavailable = true }
    }
    if (unavailable) { next.url = next.src; next.resolve(next.src); active = undefined; continue }
    worker!.postMessage({ id: ++serial, src: next.src, edge: next.edge })
    return
  }
}
export function acquireCanvasPreview(src: string, edge: number) {
  let versions = entries.get(src)
  if (!versions) { versions = new Map(); entries.set(src, versions) }
  let item = versions.get(edge)
  if (!item) {
    let resolve!: (url: string) => void
    const promise = new Promise<string>(done => { resolve = done })
    item = { src, edge, refs: 0, bytes: 0, touched: Date.now(), promise, resolve }
    versions.set(edge, item); queue.push(item)
  }
  item.refs++; item.touched = Date.now()
  pump()
  let released = false
  return { promise: item.promise, release() { if (released) return; released = true; item!.refs--; item!.touched = Date.now(); prune() } }
}
