export const builtinSkills = {
  'white-background': { name: '纯白背景', interactive: false },
  edit: { name: '图片编辑', interactive: true },
  redraw: { name: '引用生成', interactive: true },
  separate: { name: '多图层', interactive: false },
  background: { name: '去背景', interactive: false },
  erase: { name: '消除', interactive: true },
  expand: { name: '扩图', interactive: true },
  upscale: { name: '变清晰', interactive: false },
} as const
export type BuiltinOperation = keyof typeof builtinSkills
export type InlineParameters = { prompt?: string; ratio?: string; frame?: { x: number; y: number; width: number; height: number }; maskStrokes?: number[][][]; boxes?: [number, number, number, number][] }
export type QuickTask = { id: string; sourceId: string; operation: BuiltinOperation; skillVersion: 1; prompt: string; parameters: InlineParameters; status: 'blocked'; message: string; createdAt: string }
