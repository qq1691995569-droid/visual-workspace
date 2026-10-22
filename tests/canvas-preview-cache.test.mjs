import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {acquireCanvasPreview} from '../src/canvasPreviewCache.ts'

test('300 previews: folding releases cached images, skips queued work, and expanding reacquires',async()=>{
 const saved=globalThis.Worker, created=[],revoked=[]
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL
 let submissions=0
 globalThis.Worker=class {
  postMessage(){submissions++;setTimeout(()=>this.onmessage({data:{blob:new Blob(['preview']),bytes:256*256*4}}),1)}
  terminate(){}
 }
 URL.createObjectURL=()=>{const url=`blob:preview-${created.length}`;created.push(url);return url}
 URL.revokeObjectURL=url=>revoked.push(url)
 try{
  const batch=Array.from({length:300},(_,i)=>acquireCanvasPreview(`original-2k-${i}`,256))
  // Twenty visible covers; the other 280 nodes are now unmounted.
  batch.slice(20).forEach(item=>item.release())
  await Promise.all(batch.map(item=>item.promise))
  assert.equal(submissions,20,'hidden queued originals must not be decoded')
  batch.slice(0,20).forEach(item=>item.release())
  await delay(2200)
  assert.equal(revoked.length,20,'unmounted previews must be released even below the memory budget')
  const expanded=acquireCanvasPreview('original-2k-0',256)
  await expanded.promise
  assert.equal(submissions,21,'expansion recreates the released preview')
  const shared=acquireCanvasPreview('original-2k-0',256)
  expanded.release();await delay(2200)
  assert.equal(revoked.length,20,'a mounted consumer keeps its preview')
  shared.release();await delay(2200)
  assert.equal(revoked.length,21)
 }finally{globalThis.Worker=saved;URL.createObjectURL=create;URL.revokeObjectURL=revoke}
})
