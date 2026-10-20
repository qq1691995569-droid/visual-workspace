import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resultData } from '../src/generationResults.ts'

test('生成结果替换占位框时清除 pendingResult，不再显示未生成结果', () => {
  const old = { kind: 'image', pendingResult: { jobId: 'job', index: 0 }, label: '生成中' }
  const actual = { kind: 'image', src: 'data:image/png;base64,real', skillResult: { jobId: 'job' }, label: '结果 1' }
  const merged = resultData(old, actual)
  assert.equal(merged.pendingResult, undefined)
  assert.equal(merged.src, actual.src)
  assert.equal(merged.skillResult.jobId, 'job')
  assert.ok(old.pendingResult)
})

test('重复查询回填结果不清空单图补充说明和原始上下文', () => {
  const context = { prompt: '原始任务', options: { count: 4 } }
  const draft = { prompt: '用户正在补充的新要求' }
  const existing = { src: 'image', iterationContext: context, refinementDraft: draft }
  const merged = resultData(existing, { src: 'image', iterationContext: { prompt: '来源节点已改变' } })
  assert.equal(merged.refinementDraft, draft)
  assert.equal(merged.iterationContext, context)
})

test('重复回填保留原始底图与本次输入的对比快照', () => {
  const comparison = { original: 'original-base', input: 'previous-result' }
  const merged = resultData({ src: 'result', comparison }, { src: 'result', comparison: { original: 'changed-base' } })
  assert.equal(merged.comparison, comparison)
  assert.deepEqual(resultData({}, { comparison }).comparison, comparison)
})
