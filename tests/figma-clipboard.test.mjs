import test from 'node:test';import assert from 'node:assert/strict';import {buildFigmaClipboard} from '../src/figmaClipboard.ts';import {parseClipboardHtml,decodeFigmaData} from '@figit/fig-kiwi';
test('多图剪贴板包含四个独立图片及原始资源，保持相对位置和图像比例',async()=>{
 const old=globalThis.createImageBitmap;let closed=0;globalThis.createImageBitmap=async()=>({width:240,height:180,close(){closed++}});
 try{const images=Array.from({length:4},(_,i)=>({src:'data:image/png;base64,iVBORw0KGgo=',label:`test ${i}`,x:100+i*300,y:200,width:240,height:102}));
 const html=await buildFigmaClipboard(images);const m=decodeFigmaData(parseClipboardHtml(html).fig).message;const nodes=m.nodeChanges.filter(n=>n.type==='ROUNDED_RECTANGLE');
 assert.equal(nodes.length,4);assert.equal(m.blobs.length,4);assert.equal(closed,4);
 nodes.forEach((n,i)=>{assert.equal(n.name,`test ${i}`);assert.deepEqual(n.size,{x:240,y:180});assert.equal(n.transform.m02,i*300);assert.equal(n.fillPaints[0].image.dataBlob,i);assert.equal(n.fillPaints[0].image.hash.length,20)});
 }finally{globalThis.createImageBitmap=old}
});
test('空选择及过量选择在读取图片前拒绝',async()=>{await assert.rejects(buildFigmaClipboard([]));await assert.rejects(buildFigmaClipboard(Array(51).fill({})))})
