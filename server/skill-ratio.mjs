export function resolveSkillRatio(options = {}, routes = [], width, height) {
  const route = routes.find(r => r.model === options.model) || (!options.model || options.model === 'dreo-default' ? routes[0] : undefined)
  if (!route) throw Error('所选模型不可用，请重新选择模型')
  const aspects = route.supported_aspects || []
  if (options.ratio && options.ratio !== 'auto') {
    if (!aspects.includes(options.ratio) || !/^\d+:\d+$/.test(options.ratio)) throw Error('所选模型不支持这个比例，请重新选择')
    return {ratio:options.ratio}
  }
  if (!(width > 0 && height > 0)) throw Error('无法读取原图尺寸')
  const candidates = aspects.filter(r => /^\d+:\d+$/.test(r))
  const distance = r => { const [w,h] = r.split(':').map(Number); return Math.abs(Math.log(w / h / (width / height))) }
  candidates.sort((a,b) => distance(a)-distance(b))
  if (candidates[0] && distance(candidates[0]) < .01) return {ratio:candidates[0]}
  if (aspects.includes('auto')) return {ratio:'auto',warning:'沿用原图：由模型自动匹配比例，实际尺寸以结果为准'}
  if (!candidates.length) throw Error('所选模型未提供可用的图像比例，请更换模型')
  return {ratio:candidates[0],warning:`模型不支持原图的任意比例，已匹配最接近的 ${candidates[0]}；请检查构图`}
}
