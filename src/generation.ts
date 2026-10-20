export const modelOptions = [
  { id: 'gemini-3-pro-image-preview', name: '香蕉 Pro', description: 'DREO · Gemini', tag: '生图' },
  { id: 'gemini-3.1-flash-image-preview', name: '香蕉 2', description: 'DREO · Gemini', tag: '生图' },
  { id: 'gemini-nano-banana-2.1', name: '香蕉 2.1', description: 'DREO · Gemini', tag: '生图' },
  { id: 'gpt-image-2', name: 'GPT 2.0', description: 'DREO · OpenAI', tag: '生图' },
  { id: 'gpt-image-2.5-flare', name: 'GPT 2.5 极速', description: 'DREO · OpenAI', tag: '生图' },
  { id: 'gpt-image-2.5-sunburst', name: 'GPT 2.5 高质', description: 'DREO · OpenAI', tag: '生图' },
  { id: 'midjourney-v8.1', name: 'Midjourney V8.1', description: '固定四张 · 最高 2K', tag: '生图' },
  { id: 'doubao-seedream-5-0-pro-260628', name: 'Seedream 5.0 Pro', description: 'DREO · Seedream', tag: '生图' },
  { id: 'doubao-seedream-5-0-flash-260915', name: 'Seedream 5.0 Flash', description: 'DREO · Seedream', tag: '生图' },
  { id: 'dreo-default', name: 'DREO 默认模型', description: '由 DREO 执行器选择模型', tag: '默认' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: '参考目录 · 待配置执行映射', tag: '待接入' },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5', description: '参考目录 · 待配置执行映射', tag: '待接入' },
  { id: 'seedream-4.5', name: 'Seedream 4.5', description: '参考目录 · 待配置执行映射', tag: '待接入' },
] as const
export const ratios = ['1:1', '2:1', '3:2', '4:3', '5:4', '16:9', '21:9', '1:2', '2:3', '3:4', '4:5', '9:16', '9:21'] as const
export const resolutions = ['1K', '2K', '4K'] as const
export const qualities = ['auto', 'low', 'medium', 'high', 'xhigh', 'max', '低', '中', '高', '超高', '极致'] as const
export type Generation = { model: string; resolution: typeof resolutions[number]; ratio: typeof ratios[number]; quality: typeof qualities[number]; count: number }
export const defaultGeneration: Generation = { model: 'gemini-3-pro-image-preview', resolution: '2K', ratio: '1:1', quality: 'auto', count: 1 }
export function normalizeGeneration(value?: Partial<Generation> | null): Generation {
  return { model: modelOptions.some(m => m.id === value?.model) ? value!.model! : defaultGeneration.model,
    resolution: resolutions.includes(value?.resolution as Generation['resolution']) ? value!.resolution! : defaultGeneration.resolution,
    ratio: ratios.includes(value?.ratio as Generation['ratio']) ? value!.ratio! : defaultGeneration.ratio,
    quality: qualities.includes(value?.quality as Generation['quality']) ? value!.quality! : defaultGeneration.quality,
    count: Number.isInteger(value?.count) && value!.count! >= 1 && value!.count! <= 9 ? Math.min(4, value!.count!) : 1 }
}
export function targetDimensions(settings: Generation) {
  const longEdge = { '1K': 1024, '2K': 2048, '4K': 4096 }[settings.resolution]
  const [w, h] = settings.ratio.split(':').map(Number)
  return { width: Math.round(longEdge * w / Math.max(w, h) / 8) * 8, height: Math.round(longEdge * h / Math.max(w, h) / 8) * 8 }
}
