import test from 'node:test'
import assert from 'node:assert/strict'
import {applyExtractionState} from '../src/canvasExtraction.ts'
import {graphCommand} from '../src/graphHistory.ts'
const job='11111111-1111-1111-1111-111111111111'
const root={id:`extract-${job}-0`,type:'card',position:{x:100,y:80},style:{width:340,height:340},data:{kind:'image',label:'提取中',extraction:{id:job,index:0,plannedCount:1,status:'running',createdAt:'2026-10-19T00:00:00Z',kind:'material',focus:'沙发'}}}
const asset={kind:'material',name:'米白圈绒 · 沙发',image:'data:image/png;base64,AAAA',prompt:'米白圈绒',tags:[],notes:'',materialCategory:'fabric'}
test('extraction results match child IDs, preserve positions and saved metadata across polling',()=>{
  const state={id:job,status:'running',message:'完成 1/2',items:[{id:'a',name:'面料',status:'complete'},{id:'b',name:'木材',status:'running'}],results:[{id:'a',asset,archived:false}]}
  const first=applyExtractionState([root],state)
  assert.equal(first.length,2);assert.equal(first[0].data.src,asset.image);assert.equal(first[1].data.src,undefined)
  assert.equal(first[0].data.extractedAsset.archived,false)
  first[0].position={x:900,y:200};first[0].data.extractedAsset={asset:{...asset,name:'用户改名'},archived:true}
  const next=applyExtractionState(first,{...state,status:'complete',results:[{id:'b',asset:{...asset,name:'木材'},archived:false},{id:'a',asset,archived:false}]})
  assert.deepEqual(next[0].position,{x:900,y:200});assert.equal(next[1].data.extractedAsset.asset.name,'木材')
  assert.equal(next[0].data.extractedAsset.asset.name,'用户改名')
  assert.equal(next[0].data.extractedAsset.archived,true)
  assert.equal(applyExtractionState(next.slice(1),state).length,1,'a deleted output is not recreated')
})
test('background extraction completion does not consume undo steps but image movement does',()=>{
  const final=applyExtractionState([root],{id:job,status:'complete',message:'done',items:[{id:'a',status:'complete'}],results:[{id:'a',asset,archived:false}]})
  assert.equal(graphCommand({nodes:[root],edges:[]},{nodes:final,edges:[]}),null)
  const moved=[{...final[0],position:{x:600,y:80}}]
  assert.ok(graphCommand({nodes:final,edges:[]},{nodes:moved,edges:[]}))
})
