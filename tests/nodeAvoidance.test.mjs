import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pushNeighbours} from '../src/nodeAvoidance.ts'
const node=(id,x,y=0,extra={})=>({id,position:{x,y},data:{kind:'tool'},style:{width:100,height:100},...extra})
test('pushes a collision chain without moving remote nodes',()=>{
 const ns=[node('a',0),node('b',110),node('c',230),node('remote',900)]
 const out=pushNeighbours(ns,{...ns[0],position:{x:40,y:0},dragging:true})
 assert.equal(out[1].position.x,164);assert.equal(out[2].position.x,288);assert.equal(out[3],ns[3])
})
test('does not move locked or selected nodes or groups',()=>{
 for(const extra of [{draggable:false},{selected:true},{data:{kind:'group'}}]){
  const ns=[node('a',0),node('b',110,0,extra)]
  assert.equal(pushNeighbours(ns,{...ns[0],position:{x:40,y:0}}),ns)
 }
})
test('group children and far nodes do not react to drag',()=>{
 const ns=[node('a',0),node('b',30,0,{parentId:'group'}),node('c',900)]
 assert.equal(pushNeighbours(ns,ns[0]),ns)
})

test('group siblings push each other and grow their parent without touching other scopes',()=>{
 const group=node('g',400,300,{data:{kind:'group'},style:{width:300,height:200}})
 const ns=[group,node('a',20,50,{parentId:'g'}),node('b',130,50,{parentId:'g'}),node('c',240,50,{parentId:'g'}),node('outside',130,50),node('other',130,50,{parentId:'other-group'})]
 const out=pushNeighbours(ns,{...ns[1],position:{x:60,y:50}})
 assert.equal(out[2].position.x,184);assert.equal(out[3].position.x,308)
 assert.equal(out[0].style.width,428);assert.equal(out[0].data.expandedSize.width,428)
 assert.deepEqual(out[0].position,group.position)
 assert.equal(out[4],ns[4]);assert.equal(out[5],ns[5])
})
test('group edge pushes stay clear of the header and left boundary',()=>{
 const ns=[node('g',0,0,{data:{kind:'group'},style:{width:250,height:200}}),node('a',100,50,{parentId:'g'}),node('b',20,50,{parentId:'g'})]
 const out=pushNeighbours(ns,ns[1])
 assert.ok(out[2].position.x>=20);assert.ok(out[2].position.y>=50)
 assert.ok(out[2].position.y>=174 || out[2].position.x>=224)
 assert.ok(out[0].style.height>=out[2].position.y+120)
})
test('chains longer than 24 nodes continue to avoid overlap',()=>{
 const ns=Array.from({length:30},(_,i)=>node(String(i),i*124))
 const out=pushNeighbours(ns,{...ns[0],position:{x:40,y:0}})
 for(let i=1;i<out.length;i++)assert.ok(out[i].position.x>=out[i-1].position.x+124)
})
test('collapsed groups do not rearrange hidden contents',()=>{
 const ns=[node('g',0,0,{data:{kind:'group',collapsed:true}}),node('a',20,50,{parentId:'g'}),node('b',30,50,{parentId:'g'})]
 assert.equal(pushNeighbours(ns,ns[1]),ns)
})
