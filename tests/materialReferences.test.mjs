import test from 'node:test'
import assert from 'node:assert/strict'
import {syncMaterialReferences,unlinkMaterialReferences} from '../src/materialReferences.ts'
const asset={name:'织物',image:'cover',prompt:'matte',kind:'material'}
const regions=[{id:'a',target:'椅子',asset,useImageReference:true},{id:'b',target:'地毯',asset:{...asset,image:'rug'},useImageReference:false}]
const owner={id:'tool',position:{x:500,y:0},data:{kind:'tool',localEdit:{kind:'material',regions}}}
test('显式图片参考创建对应图和连线，提示词模式不连接封面，重复同步不重复创建',()=>{
 const first=syncMaterialReferences([owner],[])
 assert.equal(first.nodes.length,2);assert.equal(first.edges.length,1);assert.equal(first.edges[0].targetHandle,'style');assert.equal(first.nodes[1].data.src,'cover')
 const again=syncMaterialReferences(first.nodes,first.edges);assert.equal(again.nodes,first.nodes);assert.equal(again.edges,first.edges)
 const moved=first.nodes.map(n=>n.id===owner.id?n:{...n,position:{x:9,y:99}})
 assert.deepEqual(syncMaterialReferences(moved,first.edges).nodes[1].position,{x:9,y:99})
})
test('两项图片参考全部连接；断开一条同时关闭该对象的图片指导，不删除参考图片',()=>{
 const first=syncMaterialReferences([{...owner,data:{...owner.data,localEdit:{kind:'material',regions:regions.map(r=>({...r,useImageReference:true}))}}}],[])
 assert.equal(first.edges.length,2)
 const changed=unlinkMaterialReferences(first.nodes,new Set([first.edges[0].source]))
 assert.equal(changed[0].data.localEdit.regions[0].useImageReference,false);assert.equal(changed[0].data.localEdit.regions[1].useImageReference,true)
 const next=syncMaterialReferences(changed,first.edges)
 assert.equal(next.nodes.length,3);assert.equal(next.edges.length,1);assert.equal(next.edges[0].source,first.edges[1].source)
})
