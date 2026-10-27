import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {prepareReference,referenceLimits} from '../server/reference-image.mjs'
import {prepareVisionImages,visionImageLimits} from '../server/vision-images.mjs'
const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const fixture=(w,h)=>execFileSync(python,['-c',`from PIL import Image;import io,base64;b=io.BytesIO();Image.new('RGBA',(${w},${h}),(80,100,120,128)).save(b,format='PNG');print('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())`],{encoding:'utf8',maxBuffer:8e6}).trim()

test('shared vision input compresses large originals and preserves order and small images',async()=>{
 const large=fixture(3584,4800),small=fixture(80,60)
 const result=await prepareVisionImages([large,small,large])
 assert.equal(result[1],small);assert.equal(result[0],result[2]);assert.notEqual(result[0],large)
 const metadata=await prepareReference(result[0],visionImageLimits)
 assert.equal(metadata.resized,false);assert.equal(metadata.height,2048)
 assert.ok(Buffer.from(result[0].split(',')[1],'base64').length<=2_000_000)
})
test('limits follow selected model and use selected resolution as a safe fallback',()=>{
 const caps={routes:{'conversation-image':{available_routes:[{provider:'seedream',model:'pro',limits:{max_pixels:4624220,max_edge:3136}},{provider:'gemini',model:'g',input_limits:{max_pixels:9000000,max_edge:3000},limits:{max_pixels:1000000,max_edge:1000}},{provider:'seedream',model:'fallback',supported_resolutions:['1K','2K','4K']}]}}}
 const req=model=>({tool_type:'conversation-image',params:{route_override:{provider:model==='pro'?'seedream':model==='g'?'gemini':'seedream',model},resolution:'1K'}})
 assert.equal(referenceLimits(caps,req('pro')).max_pixels,4624220)
 assert.equal(referenceLimits(caps,req('g')).max_edge,3000)
 assert.deepEqual(referenceLimits(caps,{tool_type:'conversation-image',params:{route_override:{provider:'seedream',model:'fallback'},resolution:'2K'}}),{max_pixels:2048*2048,max_edge:2048,max_bytes:8_000_000})
})
test('large reference fits pixel and edge limits, keeps aspect and transparency; small bytes unchanged',async()=>{
 const original=fixture(6000,4000)
 const r=await prepareReference(original,{max_pixels:4624220,max_edge:3136,max_bytes:8000000})
 assert.ok(r.resized);assert.ok(r.width*r.height<=4624220);assert.ok(Math.max(r.width,r.height)<=3136);assert.ok(Math.abs(r.width/r.height-1.5)<.002)
 const check=execFileSync(python,['-c',"import sys,json,base64,io;from PIL import Image;i=Image.open(io.BytesIO(base64.b64decode(sys.stdin.read().split(',')[1])));print(i.mode,i.getpixel((0,0))[3])"],{input:r.image,encoding:'utf8'})
 assert.equal(check.trim(),'RGBA 128')
 const small=fixture(100,60),s=await prepareReference(small,{max_pixels:1000000,max_edge:1000,max_bytes:8000000})
 assert.equal(s.image,small);assert.equal(s.resized,false)
 const oversized=await prepareReference(fixture(7000,6000),{max_pixels:36000000,max_edge:10000,max_bytes:30000000})
 assert.ok(oversized.resized);assert.ok(oversized.width*oversized.height<=36000000);assert.ok(Math.max(oversized.width,oversized.height)<=10000)
})
