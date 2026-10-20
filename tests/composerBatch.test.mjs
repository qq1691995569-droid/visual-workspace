import test from 'node:test'
import assert from 'node:assert/strict'
import { composerBatch, composerPosition } from '../src/composerBatch.ts'
const settings={model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'16:9',quality:'auto',count:4}
test('底部创作只创建指定张数的图片占位，不重复生成工具卡片',()=>{
 const batch=composerBatch('first','job','generate','场景海报',settings,{x:100,y:80})
 const nodes=[batch.controller,...batch.rest]
 assert.equal(nodes.length,4);assert.ok(nodes.every(n=>n.data.kind==='image'));assert.equal(batch.controller.data.prompt,'场景海报');assert.deepEqual(batch.controller.data.generation,settings);assert.equal(batch.controller.data.imageJob.requestId,'job');assert.deepEqual(nodes.map(n=>n.data.pendingResult.index),[0,1,2,3]);assert.ok(nodes.every(n=>n.data.pendingResult.sourceNode==='first'));assert.equal(batch.controller.data.comparison,undefined)
})
test('图生图直出仍保留底图快照，新增批次绕开既有图片',()=>{
 const batch=composerBatch('first','job','redraw','更换颜色',settings,{x:0,y:0},{id:'base',src:'current',original:'original'})
 assert.deepEqual(batch.controller.data.comparison,{original:'original',input:'current'})
 assert.deepEqual(composerPosition({x:0,y:0},[{x:400,y:0,width:340,height:200}],1480,200),{x:0,y:260})
 assert.deepEqual(composerPosition({x:0,y:0},[],1480,200),{x:0,y:0})
})

test('复用起始图像节点，1 到 4 张都只补充右侧剩余位置',()=>{
 for(const count of [1,2,3,4]){
  const origin={x:420,y:180}
  const batch=composerBatch('existing-image','request','redraw','场景',{...settings,count},origin,{id:'input',src:'reference'},['input','second'])
  assert.equal(batch.controller.id,'existing-image')
  assert.deepEqual(batch.controller.position,origin)
  assert.equal(batch.rest.length,count-1)
  assert.deepEqual(batch.controller.data.composerRequest.referenceIds,['input','second'])
  for(const [i,node] of batch.rest.entries()){
   assert.equal(node.position.y,origin.y)
   assert.equal(node.position.x,origin.x+(i+1)*380)
  }
 }
})
