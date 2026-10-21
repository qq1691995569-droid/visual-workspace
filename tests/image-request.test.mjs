import test from 'node:test'
import assert from 'node:assert/strict'
import { imageRequest } from '../server/image-request.mjs'
const route = { provider: 'gemini', model: 'gemini-3-pro-image-preview', supported_aspects: ['1:1','3:4'], supported_resolutions: ['1K','2K','4K'], supported_qualities: [], max_images_per_call: 9, max_reference_images: 5 }
const caps = { routes: { 'image-gen': { model: route.model, available_routes: [route] }, 'conversation-image': { model: route.model, available_routes: [route] } } }
test('文生图没有参考图路径，图生图显式上传全部选定参考图', () => {
  const body = { prompt: '一只白色陶瓷杯', mode: 'generate', images: [], options: { model: route.model, count: 1, resolution: '2K', ratio: '1:1', quality: 'auto' } }
  const text = imageRequest(body, caps); assert.equal(text.tool_type, 'image-gen'); assert.equal('image_paths' in text.params, false); assert.equal('quality' in text.params, false)
  const image = imageRequest({ ...body, mode: 'redraw', images: ['a','b'] }, caps, ['key-a','key-b'])
  assert.equal(image.tool_type, 'conversation-image'); assert.deepEqual(image.params.image_paths, ['key-a','key-b']); assert.equal(image.params.interactive, false)
  assert.throws(() => imageRequest({ ...body, mode: 'redraw' }, caps))
  assert.throws(() => imageRequest({ ...body, mode: 'redraw', images: ['a','b'] }, caps, ['one']))
})
test('不支持的模型、比例及数量在上传或提交前拒绝', () => {
  const body = { prompt: '杯子', mode: 'generate', images: [], options: { model: route.model, ratio: '1:1', count: 4 } }
  assert.equal(imageRequest(body, caps).params.count, 4)
  assert.throws(() => imageRequest({ ...body, options: { ...body.options, model: 'gpt-image-1.5' } }, caps))
  assert.throws(() => imageRequest({ ...body, options: { ...body.options, ratio: '2:1' } }, caps))
  assert.throws(() => imageRequest({ ...body, options: { ...body.options, count: 5 } }, caps))
})

 test('上限四张，精细度传入路由参数，Midjourney 严格固定四张', () => {
 const body={prompt:'杯子',mode:'generate',options:{model:route.model,count:4,ratio:'1:1',quality:'high'}}
 const qualityCaps={routes:{'image-gen':{available_routes:[{...route,supported_qualities:['auto','high']}]}}}
 const request=imageRequest(body,qualityCaps)
 assert.equal(request.params.count,4)
 assert.equal(request.params.route_override.quality,'high')
 assert.equal('quality' in request.params,false)
 const mj={routes:{'image-gen':{available_routes:[{...route,provider:'midjourney',max_images_per_call:4}]}}}
 assert.throws(()=>imageRequest({...body,options:{...body.options,count:1}},mj))
 assert.equal(imageRequest({...body,options:{...body.options,count:4}},mj).params.count,4)
 })
