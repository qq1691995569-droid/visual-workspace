import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atomicJsonWriter } from '../server/atomic-json.mjs'

test('Windows 临时占用时仅重试重命名，不丢弃原子写入', async () => {
  let writes = 0, attempts = 0
  const delays = []
  const save = atomicJsonWriter({ ensure: async () => {}, write: async () => { writes++ }, replace: async () => { if (++attempts < 4) throw Object.assign(Error('locked'), { code: 'EPERM' }) }, sleep: async ms => { delays.push(ms) } })
  await save('/test/task.json', { taskId: 'remote-id' })
  assert.equal(writes, 1); assert.equal(attempts, 4)
  assert.deepEqual(delays, [50,100,200])
})

test('同一文件串行保存，失败后下一次仍可保存，不暴露本地路径', async () => {
  let locked = true, concurrent = 0, max = 0
  const values = []
  const save = atomicJsonWriter({ ensure: async () => {}, write: async (_, contents) => { values.push(JSON.parse(contents)) }, replace: async () => { concurrent++; max = Math.max(max, concurrent); await Promise.resolve(); concurrent--; if (locked) throw Object.assign(Error('C:/private/path'), { code: 'EBUSY' }) }, sleep: async () => {} })
  await assert.rejects(save('/test/task.json', { version: 1 }), error => error.code === 'LOCAL_SAVE_FAILED' && !error.message.includes('private'))
  locked = false
  await Promise.all([save('/test/task.json', { version: 2 }), save('/test/task.json', { version: 3 })])
  assert.equal(max, 1)
  assert.deepEqual(values.map(v => v.version), [1,2,3])
})
