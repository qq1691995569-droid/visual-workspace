import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {localVision} from '../server/local-vision.mjs'
const sample=process.argv[2]
if(!sample)throw Error('Provide a sample PNG path')
const output=new URL('../artifacts/layered-trial/',import.meta.url)
await mkdir(output,{recursive:true})
const model=new URL('../.canvas-runtime/ComfyUI/models/diffusion_models/qwen_image_layered_fp8mixed.safetensors',import.meta.url)
const deadline=Date.now()+30*60*1000
while(!await access(model).then(()=>true,()=>false)){
 if(Date.now()>deadline)throw Error('Model download wait timed out')
 await new Promise(r=>setTimeout(r,5000))
}
const start=Date.now()
const images=await localVision({
 operation:'separate',
 base:'data:image/png;base64,'+(await readFile(sample)).toString('base64'),
 settings:{resolution:640,layers:4,steps:20},
 prompt:process.argv[3]||'Decompose the input image into independent transparent layers, preserving the depicted content and appearance.'
},message=>console.log(new Date().toISOString(),message))
if(images.length!==4)throw Error('Expected four independent layers, got '+images.length)
for(const [i,image] of images.entries())await writeFile(new URL(`layer-${i+1}.png`,output),Buffer.from(image.src.split(',')[1],'base64'))
await writeFile(new URL('report.json',output),JSON.stringify({seconds:(Date.now()-start)/1000,count:images.length,settings:{resolution:640,layers:4,steps:20}},null,2))
console.log('Layered trial complete:',images.length,'layers')
