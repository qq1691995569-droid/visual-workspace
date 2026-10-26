import test from 'node:test'
import assert from 'node:assert/strict'
import {parseVisionJson} from '../server/vision-response.mjs'

test('视觉分析可从 Markdown 或说明文字中恢复 JSON 对象',()=>{
 const fence=String.fromCharCode(96).repeat(3)
 assert.deepEqual(parseVisionJson(fence+'json\n{"objects":[]}\n'+fence),{objects:[]})
 assert.deepEqual(parseVisionJson('根据您的要求：\n{"objects":[{"id":"chair"}]}\n已完成。'),{objects:[{id:'chair'}]})
})

test('视觉分析格式异常返回安全的可读错误',()=>{
 assert.throws(()=>parseVisionJson('根据您的要求，我对图片进行了分析'),/视觉分析未返回有效 JSON，请重试；本次未提交生图/)
})
