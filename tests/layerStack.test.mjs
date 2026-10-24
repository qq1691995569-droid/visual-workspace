import {test} from 'node:test'
import assert from 'node:assert/strict'
import {restackLayerGroups} from '../src/layerStack.ts'

test('upgrading an existing stack keeps a moved layer at its canvas position',()=>{
 const group={id:'group',position:{x:400,y:200},style:{width:340,height:340},data:{kind:'group',layerStack:true}}
 const background={id:'background',parentId:'group',position:{x:0,y:0},style:{width:340,height:340},data:{kind:'image',dimensions:'1000 × 1000',skillResult:{review:{layer:'背景'}}}}
 const object={id:'object',parentId:'group',position:{x:20,y:40},style:{width:340,height:340},data:{kind:'image',dimensions:'1000 × 1000',skillResult:{review:{layer:'椅子',boundingBox:'100,200,400,600'}}}}
 const upgraded=restackLayerGroups([group,background,object])
 assert.deepEqual(upgraded[2].position,{x:54,y:108})
 assert.equal(upgraded[2].style.width,102)
 assert.equal(upgraded[2].style.height,136)
 assert.equal(restackLayerGroups(upgraded),upgraded)
})
