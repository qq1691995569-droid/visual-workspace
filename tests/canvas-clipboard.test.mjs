import test from 'node:test'
import assert from 'node:assert/strict'
import {copyCanvasImages,pasteCanvasImages} from '../src/canvasClipboard.ts'
test('复制图片保留相对布局，移除所有连线与任务来源并分配新ID',()=>{
 const nodes=[{id:'g',position:{x:100,y:200},selected:true,data:{kind:'group'}},{id:'a',parentId:'g',position:{x:10,y:20},data:{kind:'image',src:'image-a',skillResult:{sourceNode:'original',jobId:'paid-job'},comparison:{original:'base'},version:{parentId:'original'},iterationContext:{tool:'light'},imageOutput:true,imageJob:{id:'paid-job'},skillState:{jobId:'paid-job'},extraction:{id:'extraction'}}},{id:'b',position:{x:400,y:300},selected:true,data:{kind:'image',src:'image-b'}},{id:'pending',position:{x:0,y:0},selected:true,data:{kind:'image',pendingResult:{jobId:'paid-job'}}}]
 const graph=copyCanvasImages(nodes,[{id:'ab',source:'a',target:'b'},{id:'external',source:'outside',target:'a'}])
 assert.equal(graph.nodes.length,2);assert.deepEqual(graph.nodes[0].position,{x:110,y:220});assert.equal(graph.nodes[0].parentId,undefined)
 assert.equal(graph.nodes[0].data.imageJob,undefined);assert.equal(graph.nodes[0].data.extraction,undefined);assert.equal(graph.nodes[0].data.skillState,undefined)
 let n=0;const pasted=pasteCanvasImages(graph,{x:1000,y:1000},()=>`new-${++n}`)
 assert.deepEqual(pasted.nodes.map(n=>n.position),[{x:1000,y:1000},{x:1290,y:1080}])
 assert.equal(pasted.edges.length,0);assert.equal(graph.edges.length,0)
 for(const key of ['skillResult','comparison','version','iterationContext'])assert.equal(pasted.nodes[0].data[key],undefined)
 assert.equal(pasted.nodes[0].data.provenanceLinked,true)
 assert.equal(nodes[1].data.imageJob.id,'paid-job')
 pasted.nodes[0].data.src='changed';assert.equal(graph.nodes[0].data.src,'image-a')
})
