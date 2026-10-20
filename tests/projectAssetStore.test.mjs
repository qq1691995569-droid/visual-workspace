import test from 'node:test'
import assert from 'node:assert/strict'
import {projectAssetStore} from '../src/projectAssetStore.ts'

function fixture() {
  const data = new Map(), writes = []
  let failing = false
  const api = {
    get: async key => data.get(key),
    getMany: async keys => keys.map(key => data.get(key)),
    setMany: async entries => {
      if (failing) throw Error('quota')
      writes.push(structuredClone(entries))
      entries.forEach(([key,value]) => data.set(key, structuredClone(value)))
    },
  }
  return {data,writes,api,fail: value => {failing=value}}
}
const src = 'data:image/png;base64,original'
const document = {nodes:[{id:'a',position:{x:1,y:2},data:{src,comparison:{original:src}}}],draft:{referenceIds:['a']}}
test('兼容旧快照，图片去重，移动节点只写轻量文档，重新启动还原原始字节',async()=>{
  const f=fixture();f.data.set('visual-canvas-project',document)
  const store=projectAssetStore(f.api)
  assert.deepEqual(await store.read(),document)
  await store.write(document)
  assert.equal(f.writes[0].length,2)
  assert.equal(JSON.stringify(f.writes[0].at(-1)).includes(src),false)
  const moved=structuredClone(document);moved.nodes[0].position.x=500
  await store.write(moved)
  assert.equal(f.writes[1].length,1)
  const restarted=projectAssetStore(f.api)
  assert.deepEqual(await restarted.read(),moved)
  await restarted.write(moved)
  assert.equal(f.writes[2].length,1)
})
test('写入失败不污染缓存，重试原子保存图片和文档；缺失图片明确报错',async()=>{
  const f=fixture(),store=projectAssetStore(f.api)
  f.fail(true);await assert.rejects(store.write(document))
  assert.equal(f.data.size,0)
  f.fail(false);await store.write(document)
  assert.equal(f.writes[0].length,2)
  const key=f.writes[0][0][0];f.data.delete(key)
  await assert.rejects(projectAssetStore(f.api).read(),/图片数据缺失/)
})
