import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

async function run(parameters,sample=false){
  const messages=[]
  const pixels=new Uint8ClampedArray(Array.from({length:32},()=>[90,100,110,80,130,140,150,255]).flat())
  class Canvas {
    constructor(width,height){this.width=width;this.height=height;this.pixels=new Uint8ClampedArray(width*height*4)}
    getContext(){return {
      drawImage:image=>{this.pixels.set(image.pixels)},
      getImageData:()=>({data:this.pixels.slice()}),
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:data=>{this.pixels.set(data.data)},
    }}
    async convertToBlob(){return new Blob([this.pixels],{type:'image/png'})}
  }
  const scope={Uint8ClampedArray,Uint8Array,Math,Error,Blob,OffscreenCanvas:Canvas,
    self:{postMessage:m=>messages.push(m)},
    fetch:async()=>({ok:true,blob:async()=>new Blob()}),
    createImageBitmap:async()=>({width:64,height:1,pixels,close(){}}),
  }
  const context=vm.createContext(scope)
  scope.importScripts=()=>vm.runInContext(readFileSync(new URL('../public/scene-tone/color.js',import.meta.url),'utf8'),context)
  vm.runInContext(readFileSync(new URL('../public/scene-tone/skill-worker.js',import.meta.url),'utf8'),context)
  await scope.self.onmessage({data:{base:'base',reference:'ref',parameters,sample}})
  return {result:messages.at(-1),pixels}
}
test('manual zero-strength export retains all pixels including alpha',async()=>{
  const {result,pixels}=await run({strength:0})
  assert.equal(result.blob.type,'image/png')
  assert.deepEqual(new Uint8ClampedArray(await result.blob.arrayBuffer()),pixels)
})
test('automatic sampling of identical references yields neutral initial correction',async()=>{
  const {result}=await run(undefined,true)
  assert.equal(result.parameters.warmth,0)
  assert.equal(result.parameters.tint,0)
  assert.equal(result.parameters.light,0)
  assert.equal(result.parameters.strength,70)
  assert.equal(result.blob,undefined)
})
test('manual warmth changes color without changing alpha or pixel count',async()=>{
  const {result,pixels}=await run({strength:70,warmth:18,naturalness:70,fidelity:70})
  const out=new Uint8ClampedArray(await result.blob.arrayBuffer())
  assert.equal(out.length,pixels.length)
  assert.equal(out[3],80);assert.equal(out[7],255)
  assert.notDeepEqual(out,pixels)
})
