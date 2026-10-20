import test from 'node:test'
import assert from 'node:assert/strict'
import {canvasSkill} from '../server/canvas-skill.mjs'
import {layeredPrompt} from '../server/local-vision.mjs'
test('本地四项技能选择专用处理器，扩图保持原路线',async()=>{
 for(const [operation,processor,model] of [['background','local-cutout','birefnet-general'],['erase','local-vision','big-lama'],['upscale','local-vision','RealESRGAN_x2plus'],['separate','qwen-layered','qwen-image-layered-fp8']]){
  const skill=await canvasSkill(operation);assert.equal(skill.processor,processor);assert.equal(skill.model,model)
 }
 assert.equal((await canvasSkill('expand')).processor,'expand')
})
test('Qwen 工作流用原图 latent 条件并保存独立 RGBA 批次',async()=>{
 const skill=await canvasSkill('separate')
 const graph=layeredPrompt('source.png',{...skill.settings,prompt:'room'},'sample')
 assert.equal(graph['1'].inputs.image,'source.png')
 assert.equal(graph['13'].inputs.layers,4)
 assert.deepEqual(graph['9'].inputs.latent,['8',0]);assert.deepEqual(graph['10'].inputs.latent,['8',0])
 assert.equal(graph['15'].inputs.index,1)
 assert.equal(graph['16'].inputs.slice_size,1)
 assert.equal(graph['3'].inputs.unet_name,'qwen_image_layered_fp8mixed.safetensors')
 assert.deepEqual(graph['18'].inputs.images,['17',0])
 for(const node of Object.values(graph))for(const value of Object.values(node.inputs))if(Array.isArray(value))assert.ok(graph[value[0]],'all graph references resolve')
})
