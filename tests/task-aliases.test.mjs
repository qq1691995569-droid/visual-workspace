import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeTaskAliases} from '../src/taskAliases.ts'
test('parent and child rows merge into four cards without changing results or layout',()=>{
 const nodes=['parent','child'].flatMap(job=>[0,1,2,3].map(i=>({id:`skill-${job}-${i}`,position:{x:i*380,y:job==='parent'?500:0},data:i<3?{src:'image'+i,skillResult:{jobId:job}}:{pendingResult:{jobId:job,index:i}}})))
 const edges=nodes.map(n=>({id:'edge-'+n.id,source:'tool',target:n.id}))
 const result=mergeTaskAliases(nodes,edges,[{alias:'child',canonical:'parent'}]);assert.equal(result.nodes.length,4);assert.equal(result.edges.length,4);assert.ok(result.nodes.every(n=>n.position.y===500));assert.deepEqual(result.nodes.slice(0,3).map(n=>n.data.src),['image0','image1','image2']);assert.equal(mergeTaskAliases(result.nodes,result.edges,[{alias:'child',canonical:'parent'}]).nodes,result.nodes)
})
test('distinct edited images survive alias reconciliation',()=>{const nodes=['parent','child'].map(job=>({id:`skill-${job}-0`,position:{x:0,y:0},data:{src:job,skillResult:{jobId:job}}}));assert.equal(mergeTaskAliases(nodes,[],[{alias:'child',canonical:'parent'}]).nodes.length,2)})
