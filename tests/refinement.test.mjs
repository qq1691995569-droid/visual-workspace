import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refinementPrompt, styleRefinementBody } from '../src/refinement.ts'

test('风格迭代以当前选中结果为底图，原参考仅作为风格参考，保留四张参数', () => {
  const options = { model: 'seedream', resolution: '2K', ratio: 'auto', count: 4 }
  const prompt = refinementPrompt('保留原构图，暖色地板', '改浅橡木，衣服改白色')
  const request = styleRefinementBody('request', 'selected-result', ['style-reference'], options, prompt)
  assert.equal(request.base, 'selected-result')
  assert.deepEqual(request.references, ['style-reference'])
  assert.equal(request.options.count, 4)
  assert.ok(request.supplement.includes('此前要求：保留原构图，暖色地板'))
  assert.ok(request.supplement.includes('以本次为准'))
  assert.ok(request.supplement.endsWith('改浅橡木，衣服改白色'))
})

test('缺少底图或风格参考时阻止技能提交', () => {
  assert.throws(() => styleRefinementBody('id', '', ['ref'], {}, '说明'))
  assert.throws(() => styleRefinementBody('id', 'selected', [], {}, '说明'))
})
