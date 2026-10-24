import {test} from 'node:test'
import assert from 'node:assert/strict'
import {estimateLayerProgress} from '../src/layerProgress.ts'

test('layer progress is an estimate and reaches 100 only after completion',()=>{
 const start='2026-10-24T10:00:00.000Z'
 const now=Date.parse(start)+80_000
 assert.equal(estimateLayerProgress('analyzing',start,Date.parse(start)),0)
 const stages=['analyzing','uploading','submitting','running','download_pending'].map(status=>estimateLayerProgress(status,start,now))
 assert.deepEqual(stages,[20,27,34,58,92])
 assert.ok(estimateLayerProgress('running',start,now+1_000_000)<100)
 assert.equal(estimateLayerProgress('complete',start,now),100)
})
