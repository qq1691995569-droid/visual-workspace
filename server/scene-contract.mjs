export const MODEL = 'doubao-seedream-5-0-pro-260628'
const matches = new Set(['same_object', 'compatible_material', 'color_only', 'preserve'])
const text = (value, label) => { if (typeof value !== 'string' || !value.trim() || value.length > 10000) throw Error(`${label}不能为空或过长`); return value.trim() }
export function validatePlan(raw, protection, supplement = '') {
  if (!raw || raw.schemaVersion !== 1 || raw.mappingVersion !== 'mi') throw Error('方案需要 schemaVersion=1、mappingVersion=mi')
  const plan = { schemaVersion: 1, palette: text(raw.palette, 'palette'), materials: raw.materials, texture: text(raw.texture, 'texture'), atmosphere: text(raw.atmosphere, 'atmosphere'), note: text(raw.note, 'note'), areaPalette: raw.areaPalette, mappingVersion: 'mi' }
  if (!plan.materials || typeof plan.materials !== 'object' || Array.isArray(plan.materials) || !Object.keys(plan.materials).length || !Object.values(plan.materials).every(v => typeof v === 'string')) throw Error('materials 必须是逐表面描述对象')
  if (!plan.areaPalette || typeof plan.areaPalette !== 'object' || Array.isArray(plan.areaPalette) || !Object.values(plan.areaPalette).every(v => typeof v === 'string')) throw Error('areaPalette 必须是对象')
  if (!Array.isArray(raw.targetSurfaces) || !raw.targetSurfaces.length || raw.targetSurfaces.length > 100) throw Error('需要 1–100 项逐表面映射')
  const ids = new Set()
  plan.targetSurfaces = raw.targetSurfaces.map(s => {
    if (!s || !matches.has(s.match) || typeof s.preserve !== 'boolean' || typeof s.uncertain !== 'boolean' || s.preserve !== (s.match === 'preserve')) throw Error('表面 match / preserve / uncertain 无效')
    const id = text(s.id, '表面 id'); if (ids.has(id)) throw Error('表面 id 重复'); ids.add(id)
    const surface = { id, target: text(s.target, 'target'), match: s.match, reason: text(s.reason, 'reason'), uncertain: s.uncertain, preserve: s.preserve }
    if (!s.preserve) Object.assign(surface, { source: text(s.source, 'source'), color: text(s.color, 'color'), material: text(s.material, 'material'), texture: text(s.texture, 'texture') })
    return surface
  })
  if (supplement) {
    if (!Array.isArray(raw.resolvedInstructions) || !raw.resolvedInstructions.length || !raw.resolvedInstructions.every(r => typeof r === 'string' && r.trim() && r.length < 10000)) throw Error('补充说明尚未完成规则冲突解析')
    if (!raw.execution || !['geometry','product','lighting'].every(key => ['preserve','user_override'].includes(raw.execution[key]))) throw Error('需要明确补充说明对构图、产品及光影的调整范围')
    if (!Array.isArray(raw.adjustments) || raw.adjustments.length > 100 || !raw.adjustments.every(a => a && ['builtin','user','resolution'].every(key => typeof a[key] === 'string'))) throw Error('需要有效规则调整记录')
    plan.resolvedInstructions = raw.resolvedInstructions; plan.execution = raw.execution; plan.adjustments = raw.adjustments; plan.userSupplement = supplement
  }
  if ((!supplement || plan.execution.product === 'preserve') && !plan.targetSurfaces.some(s => s.preserve)) throw Error('方案缺少产品保护表面')
  plan.protection = text(protection, '产品保护范围')
  return plan
}
export function generationRequest(plan, keys, ratio, rules, options = {}) {
  if (!Array.isArray(keys) || keys.length !== 2 || !keys.every(k => typeof k === 'string' && k.length > 0) || keys[0] === keys[1]) throw Error('只允许灰度稿与线稿两个不同 storage_key')
  if (!['1:1','4:3','3:4','16:9','9:16','3:2','2:3','4:5','5:4','21:9'].includes(ratio)) throw Error('底图比例不受指定模型支持，请先调整底图；不会自动裁切')
  const execution = plan.execution || { lighting: 'preserve', geometry: 'preserve', product: 'preserve' }
  return { tool_type: 'conversation-image', params: { prompt: JSON.stringify({ ...plan, skill: { id: rules.id, version: rules.version }, instructionPriority: 'user_supplement > builtin_defaults', constraints: plan.resolvedInstructions || rules.rules, ...execution, output: { ratio, resolution: options.resolution || '2K', count: options.count || 4, framing: '用户选择新比例时保留完整主体，不裁切产品；可向外延展背景' } }), route_override: { provider: options.provider || 'seedream', model: options.model || MODEL }, interactive: false, image_paths: keys, ratio, resolution: options.resolution || '2K', count: options.count || 4 } }
}
export function runOptions(raw = {}, routes, baseRatio) {
  const model = raw.model || MODEL, route = routes.find(r => r.model === model)
  if (!route || route.max_reference_images < 2) throw Error('所选模型不可用或不支持双图参考')
  const resolution = raw.resolution || '2K', ratio = !raw.ratio || raw.ratio === 'auto' ? baseRatio : raw.ratio, count = raw.count ?? 4
  if (!route.supported_resolutions?.includes(resolution) || !route.supported_aspects?.includes(ratio)) throw Error('模型不支持所选尺寸或比例，请调整参数')
  if (!Number.isInteger(count) || count < 1 || count > Math.min(4, route.max_images_per_call || 1) || (route.supported_counts && !route.supported_counts.includes(count))) throw Error('模型不支持所选张数')
  return { provider: route.provider, model, resolution, ratio, count }
}
