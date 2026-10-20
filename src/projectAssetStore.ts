type Storage = {
  get: (key: string) => Promise<unknown>
  getMany: (keys: string[]) => Promise<unknown[]>
  setMany: (entries: [string, unknown][]) => Promise<void>
}
const projectKey = 'visual-canvas-project'
const assetPrefix = 'canvas-image:'
type ImageRef = { __canvasImage: string }
const isRef = (value: unknown): value is ImageRef =>
  !!value && typeof value === 'object' && Object.keys(value).length === 1 &&
  typeof (value as ImageRef).__canvasImage === 'string'

// The document and new assets commit in one transaction. Existing images are
// referenced, not copied into every position/selection update. Old documents
// remain readable and exports still use the fully hydrated document.
export function projectAssetStore(storage: Storage, documentKey = projectKey) {
  const known = new Map<string, string>()
  async function read() {
    const raw = await storage.get(documentKey)
    if (!raw || typeof raw !== 'object' || !('canvasStorageVersion' in raw)) return raw
    const envelope = raw as { canvasStorageVersion: number; document: unknown }
    if (envelope.canvasStorageVersion !== 1) throw Error('Unsupported canvas storage')
    const keys = new Set<string>()
    const collect = (value: unknown) => {
      if (isRef(value)) keys.add(value.__canvasImage)
      else if (Array.isArray(value)) value.forEach(collect)
      else if (value && typeof value === 'object') Object.values(value).forEach(collect)
    }
    collect(envelope.document)
    const list = [...keys], values = await storage.getMany(list)
    const assets = new Map<string, string>()
    list.forEach((key, i) => {
      const value = values[i]
      if (typeof value !== 'string' || !value.startsWith('data:image/')) throw Error('图片数据缺失，请导入项目备份')
      assets.set(key, value); known.set(value, key)
    })
    const restore = (value: unknown): unknown => {
      if (isRef(value)) return assets.get(value.__canvasImage)
      if (Array.isArray(value)) return value.map(restore)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v)]))
      return value
    }
    return restore(envelope.document)
  }
  async function write(document: unknown) {
    const added = new Map<string, string>(), used = new Map<string, string>(), entries: [string, unknown][] = []
    const pack = (value: unknown): unknown => {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        let key = known.get(value) || added.get(value)
        if (!key) {
          key = assetPrefix + crypto.randomUUID()
          added.set(value, key); entries.push([key, value])
        }
        used.set(value, key)
        return { __canvasImage: key }
      }
      if (Array.isArray(value)) return value.map(pack)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pack(v)]))
      return value
    }
    const packed = pack(document)
    entries.push([documentKey, { canvasStorageVersion: 1, document: packed }])
    await storage.setMany(entries)
    // Failed writes must never poison the cache.
    known.clear()
    used.forEach((key, src) => known.set(src, key))
  }
  return { read, write }
}
