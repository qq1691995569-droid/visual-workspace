import test from 'node:test'
import assert from 'node:assert/strict'
import {latestProjectWriter} from '../src/projectPersistence.ts'
test('自动保存立即开始，串行写入期间合并最新状态，旧快照不覆盖新图',async()=>{
 const stored=[],gates=[],states=[]
 const writer=latestProjectWriter(value=>new Promise(resolve=>gates.push(()=>{stored.push(value);resolve()})),state=>states.push(state))
 writer.enqueue('bound');await Promise.resolve();assert.equal(gates.length,1)
 writer.enqueue('generating');writer.enqueue('first image');assert.equal(gates.length,1)
 gates.shift()();await new Promise(r=>setImmediate(r));assert.equal(gates.length,1)
 gates.shift()();await writer.flush();assert.deepEqual(stored,['bound','first image']);assert.equal(writer.dirty(),false);assert.equal(states.at(-1),'saved')
})
test('保存失败保留待写快照，刷新保护持续生效，恢复后保存最新结果',async()=>{
 let fail=true,stored;const writer=latestProjectWriter(async v=>{if(fail)throw Error('disk');stored=v},()=>{})
 writer.enqueue('image');assert.equal(await writer.flush(),false);assert.equal(writer.dirty(),true)
 fail=false;writer.enqueue('both images');assert.equal(await writer.flush(),true);assert.equal(stored,'both images');assert.equal(writer.dirty(),false)
})
