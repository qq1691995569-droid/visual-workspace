import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewBatch } from '../src/previewBatch.ts'
const image=(id,jobId,extra={})=>({id,data:{kind:'image',src:'image.png',...(jobId?{skillResult:{jobId,sourceNode:'same-source'}}:{}),...extra}})
test('preview only cycles within the result job, not other runs of the same source',()=>{
  const nodes=[image('a','job1'),image('b','job2'),image('c','job1'),image('upload')]
  assert.deepEqual(previewBatch(nodes,'c').map(n=>n.id),['a','c'])
  assert.deepEqual(previewBatch(nodes,'b').map(n=>n.id),['b'])
})
test('untracked and imported images remain standalone; deleted images have no pager',()=>{
  const nodes=[image('a'),image('b')]
  assert.deepEqual(previewBatch(nodes,'b').map(n=>n.id),['b'])
  assert.deepEqual(previewBatch(nodes,'deleted'),[])
})
test('unfinished placeholders and task input images are excluded',()=>{
  const nodes=[image('result','job'),image('pending','job',{pendingResult:{}}),image('input','job',{imageJob:{}}),image('output','job',{imageJob:{},imageOutput:true})]
  assert.deepEqual(previewBatch(nodes,'result').map(n=>n.id),['result','output'])
})
