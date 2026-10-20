import test from 'node:test'
import assert from 'node:assert/strict'
import {previewBounds,clampPreview,zoomPreview} from '../src/previewGeometry.ts'
test('预览按原图比例适配窗口，缩小居中，放大限制拖动边界',()=>{
 assert.deepEqual(previewBounds(600,400,1000,1000,1),{width:400,height:400,x:0,y:0})
 const bounds=previewBounds(600,400,1000,1000,2)
 assert.deepEqual(clampPreview({x:1000,y:-1000},bounds),{x:100,y:-200})
 assert.deepEqual(clampPreview({x:100,y:100},previewBounds(600,400,1000,1000,.5)),{x:0,y:0})
 assert.deepEqual(zoomPreview({x:80,y:20},{x:10,y:5},2),{x:-60,y:-10})
})
