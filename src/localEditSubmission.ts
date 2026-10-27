import type {LocalEditRecipe, VisualAsset} from './AssetLibrary'

// Object URLs are browser-local. Resolve original bytes before crossing the API boundary.
export async function submissionImage(src: string): Promise<string> {
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) return src
  if (!/^(blob:|https?:|\/)/.test(src)) throw Error('图片地址无效，请重新导入图片')
  try {
    const response = await fetch(src, {signal: AbortSignal.timeout(30000)})
    if (!response.ok) throw Error('图片读取失败')
    const blob = await response.blob()
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) throw Error('图片格式无效')
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(Error('图片读取失败'))
      reader.readAsDataURL(blob)
    })
  } catch {
    throw Error('无法读取底图或参考图，临时图片可能已失效，请重新导入后再试')
  }
}

export async function prepareLocalEditSubmission(base: string, edit: LocalEditRecipe) {
  const cache = new Map<string, Promise<string>>()
  const image = (src: string) => {
    if (!cache.has(src)) cache.set(src, submissionImage(src))
    return cache.get(src)!
  }
  const asset = async (value: VisualAsset): Promise<VisualAsset> => ({
    ...value, image: await image(value.image),
    ...(value.sourceImage ? {sourceImage: await image(value.sourceImage)} : {}),
    ...(value.views ? {views: await Promise.all(value.views.map(async view => ({...view, image: await image(view.image)})))} : {}),
  })
  return {
    base: await image(base),
    edit: {...edit, asset: await asset(edit.asset),
      ...(edit.regions ? {regions: await Promise.all(edit.regions.map(async region => ({...region, asset: await asset(region.asset)})))} : {}),
    },
  }
}
