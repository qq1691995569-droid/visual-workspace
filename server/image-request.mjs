export function imageRequest(body, caps, keys = []) {
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 30000) throw Error('请填写不超过 30000 字的生图提示词')
  if (!['generate','redraw'].includes(body.mode)) throw Error('生图模式无效')
  if (body.mode === 'generate' && body.images?.length) throw Error('已选参考图时请使用图生图，避免丢失参考输入')
  const tool = body.mode === 'redraw' ? 'conversation-image' : 'image-gen', catalog = caps.routes?.[tool]
  const raw = body.options || {}
  const aliases = { 'nano-banana-pro': 'gemini-3-pro-image-preview' }
  const model = raw.model === 'dreo-default' || !raw.model ? catalog?.model : aliases[raw.model] || raw.model
  const route = catalog?.available_routes?.find(route => route.model === model)
  if (!route) throw Error('后台未开放所选模型，请重新选择模型')
  const ratio = raw.ratio || '1:1', resolution = raw.resolution || '2K', count = raw.count ?? 1
  if(body.layerDecomposition){
    if(body.mode!=='redraw'||body.images?.length!==1||model!=='doubao-seedream-5-0-pro-260628'||count!==1)throw Error('原生图层拆分只支持一张原图和 Seedream 5.0 Pro')
    if(!route.supported_resolutions?.includes(resolution))throw Error('后台未开放图层拆分所需画质')
    return {tool_type:'conversation-image',params:{prompt:body.prompt.trim(),route_override:{provider:route.provider,model:route.model},resolution,count:1,interactive:false,layer_decomposition:true,output_format:'png',size:'auto',...(keys.length?{image_paths:keys}:{})}}
  }
  if (!route.supported_aspects?.includes(ratio) || !route.supported_resolutions?.includes(resolution)) throw Error('所选模型不支持此比例或画质，请修改参数')
  if (!Number.isInteger(count) || count < 1 || count > 4 || count > (route.max_images_per_call || 1) || (route.supported_counts && !route.supported_counts.includes(count)) || (route.provider === 'midjourney' && count !== 4)) throw Error('所选模型不支持此张数')
  if (body.mode === 'redraw' && (!Array.isArray(body.images) || body.images.length < 1 || body.images.length > (route.max_reference_images || 9))) throw Error('参考图数量不符合模型要求')
  const qualityMap = { '低': 'low', '中': 'medium', '高': 'high', '超高': 'xhigh', '极致': 'max' }
  const quality = qualityMap[raw.quality] || raw.quality || 'auto'
  if (route.supported_qualities?.length && !route.supported_qualities.includes(quality)) throw Error('模型不支持此精细度，请重新选择')
  const params = { prompt: body.prompt.trim(), route_override: { provider: route.provider, model: route.model }, ratio, resolution, count, interactive: false }
  if (route.supported_qualities?.length) params.route_override.quality = quality
  if (body.mode === 'redraw') { if (keys.length && keys.length !== body.images.length) throw Error('参考图上传不完整'); params.image_paths = keys }
  return { tool_type: tool, params }
}
