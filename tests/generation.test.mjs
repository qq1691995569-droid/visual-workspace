import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGeneration, defaultGeneration, targetDimensions, ratios, resolutions } from '../src/generation.ts'

test('旧项目及损坏参数能回退到默认配置', () => {
  assert.deepEqual(normalizeGeneration(), defaultGeneration)
  assert.deepEqual(normalizeGeneration({ model: 'unknown', count: 99, ratio: '0:0', resolution: '8K', quality: 'unknown' }), defaultGeneration)
  assert.equal(normalizeGeneration({ count: 2.5 }).count, 1)
  assert.equal(normalizeGeneration({ count: 9 }).count, 4)
})
test('目标尺寸方向正确且长边与分辨率一致', () => {
  for (const resolution of resolutions) for (const ratio of ratios) {
    const size = targetDimensions({ ...defaultGeneration, resolution, ratio })
    assert.equal(Math.max(size.width, size.height), { '1K': 1024, '2K': 2048, '4K': 4096 }[resolution])
    assert.equal(size.width % 8, 0)
    assert.equal(size.height % 8, 0)
    const [w, h] = ratio.split(':').map(Number)
    assert.ok(Math.abs(size.width / size.height - w / h) < .07)
  }
})
test('节点生成偏好能通过 JSON 往返保留', () => {
  const settings = { model: 'seedream-4.5', count: 4, resolution: '4K', ratio: '9:16', quality: '极致' }
  assert.deepEqual(normalizeGeneration(JSON.parse(JSON.stringify(settings))), settings)
})
