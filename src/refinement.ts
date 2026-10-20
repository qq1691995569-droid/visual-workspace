import type { SkillOptions } from './SkillNode'

export function refinementPrompt(previous: string, supplement: string) {
  return [previous && `此前要求：${previous}`, `本次补充（与此前要求冲突时，以本次为准）：${supplement}`].filter(Boolean).join('\n')
}

export function styleRefinementBody(requestId: string, selectedImage: string, references: string[], options: SkillOptions, supplement: string) {
  if (!selectedImage || references.length < 1 || references.length > 3) throw Error('请保留当前图片和 1–3 张风格参考图')
  return { requestId, base: selectedImage, references, options, supplement }
}
