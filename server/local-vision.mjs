import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createWriteStream} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url))
const runtime=process.env.CANVAS_RUNTIME_DIR||path.join(root,'.canvas-runtime')
const python=path.join(runtime,'vision-env/Scripts/python.exe')
const comfyRoot=path.join(runtime,'ComfyUI')
const endpoint='http://127.0.0.1:8189'
const children=new Set()
let queue=Promise.resolve(),comfy
export const localProcessors=['local-cutout','local-vision','qwen-layered']
export function localVision(input,onMessage=()=>{}) {
 const run=queue.then(async()=>{
  // Release cached layered models before another GPU engine runs.
  if(input.operation!=='separate')await fetch(endpoint+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(2000)}).catch(()=>{})
  return input.operation==='separate'?layered(input,onMessage):runPython(input,onMessage)
 })
 queue=run.catch(()=>{});return run
}
async function runPython(input,onMessage){
 await access(python).catch(()=>{throw Error('本地视觉运行环境未安装，请运行 scripts/setup-vision.ps1')})
 const dir=path.join(runtime,'jobs',randomUUID());await mkdir(dir,{recursive:true})
 const request=path.join(dir,'request.json'),result=path.join(dir,'result.json')
 await writeFile(request,JSON.stringify(input))
 await new Promise((resolve,reject)=>{
  const child=spawn(python,[path.join(root,'server/local-vision.py'),request,result],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1',OMP_NUM_THREADS:'4',OPENBLAS_NUM_THREADS:'4'}})
  children.add(child)
  let diagnostic='',buffer='',expired=false
  const timer=setTimeout(()=>{expired=true;child.kill()},15*60*1000)
  child.stderr.on('data',c=>{diagnostic=(diagnostic+c.toString()).slice(-2000)})
  child.stdout.on('data',c=>{buffer+=c.toString();let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const event=JSON.parse(line);if(event.message)onMessage(event.message)}catch{ /* Non-protocol library log. */ }}})
  child.once('error',error=>{clearTimeout(timer);reject(error)})
  child.once('exit',code=>{children.delete(child);clearTimeout(timer);if(code===0)resolve();else reject(Error(expired?'本地处理超时，请缩小图片后重试':/not installed|No such file|cannot find|does not exist/i.test(diagnostic)?'模型文件尚未就绪，请完成本地模型安装':'本地模型执行失败；请检查运行环境或显存。诊断：'+diagnostic.slice(-400)))})
 })
 return JSON.parse(await readFile(result,'utf8')).images
}
async function api(route,body){
 const r=await fetch(endpoint+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})
 if(!r.ok)throw Error('多图层服务请求失败（'+r.status+'）')
 return r.json()
}
async function ensureComfy(){
 await access(python).catch(()=>{throw Error('本地视觉运行环境未安装，请运行 scripts/setup-vision.ps1')})
 if(await api('/system_stats').catch(()=>null))return
 const files=['diffusion_models/qwen_image_layered_fp8mixed.safetensors','text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors','vae/qwen_image_layered_vae.safetensors']
 for(const f of files)await access(path.join(comfyRoot,'models',f)).catch(()=>{throw Error('多图层模型尚未下载完成：'+path.basename(f))})
 if(!comfy){
  const check=await promisify(execFile)(python,['-c','import torch; print(torch.cuda.is_available())'],{windowsHide:true,timeout:30000}).catch(()=>({stdout:''}))
  if(!check.stdout.includes('True'))throw Error('Qwen 多图层需要 CUDA 运行环境；当前 GPU 运行库尚未就绪，未提交任务')
  const log=createWriteStream(path.join(runtime,'comfy-server.log'),{flags:'a'})
  const child=spawn(python,[path.join(comfyRoot,'main.py'),'--listen','127.0.0.1','--port','8189','--lowvram','--disable-auto-launch'],{cwd:comfyRoot,windowsHide:true,env:{...process.env,PYTHONUTF8:'1'},stdio:['ignore','pipe','pipe']})
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.once('close',()=>log.end())
  comfy=child;child.on('error',()=>{if(comfy===child)comfy=undefined});child.on('exit',()=>{if(comfy===child)comfy=undefined})
 }
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,1000));if(await api('/system_stats').catch(()=>null))return;if(!comfy)break}
 throw Error('多图层服务未启动，请检查 ComfyUI 运行环境')
}
export function layeredPrompt(filename,settings,prefix){
 const n=(class_type,inputs)=>({class_type,inputs})
 return {
  '1':n('LoadImage',{image:filename}),
  '2':n('ImageScaleToMaxDimension',{image:['1',0],upscale_method:'lanczos',largest_size:settings.resolution}),
  '3':n('UNETLoader',{unet_name:'qwen_image_layered_fp8mixed.safetensors',weight_dtype:'default'}),
  '4':n('CLIPLoader',{clip_name:'qwen_2.5_vl_7b_fp8_scaled.safetensors',type:'qwen_image',device:'default'}),
  '5':n('VAELoader',{vae_name:'qwen_image_layered_vae.safetensors'}),
  '6':n('CLIPTextEncode',{clip:['4',0],text:settings.prompt}),
  '7':n('CLIPTextEncode',{clip:['4',0],text:''}),
  '8':n('VAEEncode',{pixels:['2',0],vae:['5',0]}),
  '9':n('ReferenceLatent',{conditioning:['6',0],latent:['8',0]}),
  '10':n('ReferenceLatent',{conditioning:['7',0],latent:['8',0]}),
  '11':n('ModelSamplingAuraFlow',{model:['3',0],shift:1}),
  '12':n('GetImageSize',{image:['2',0]}),
  '13':n('EmptyQwenImageLayeredLatentImage',{width:['12',0],height:['12',1],layers:settings.layers,batch_size:1}),
  '14':n('KSampler',{model:['11',0],positive:['9',0],negative:['10',0],latent_image:['13',0],seed:0,steps:settings.steps,cfg:2.5,sampler_name:'euler',scheduler:'simple',denoise:1}),
  '15':n('LatentCut',{samples:['14',0],dim:'t',index:1,amount:16384}),
  '16':n('LatentCutToBatch',{samples:['15',0],dim:'t',slice_size:1}),
  '17':n('VAEDecode',{samples:['16',0],vae:['5',0]}),
  '18':n('SaveImage',{images:['17',0],filename_prefix:prefix})
 }
}
async function layered(input,onMessage){
 onMessage('Qwen 多图层 · 正在准备本地模型');await ensureComfy()
 const name='canvas-'+randomUUID()+'.png'
 // Upload through ComfyUI rather than assuming shared input paths.
 const form=new FormData();form.append('image',new Blob([Buffer.from(input.base.split(',')[1],'base64')]),name)
 const response=await fetch(endpoint+'/upload/image',{method:'POST',body:form,signal:AbortSignal.timeout(30000)})
 if(!response.ok)throw Error('多图层输入上传失败')
 const uploaded=await response.json()
 const settings={...input.settings,prompt:input.prompt||'Decompose the input image into independent transparent layers, preserving the depicted content and appearance.'}
 const accepted=await api('/prompt',{prompt:layeredPrompt(uploaded.name,settings,'canvas-'+randomUUID()),client_id:randomUUID()})
 if(!accepted.prompt_id)throw Error('多图层工作流未被接受')
 onMessage('Qwen 多图层 · 正在分离与补全（本地处理较慢）')
 for(let i=0;i<1200;i++){
  await new Promise(r=>setTimeout(r,1500));const records=await api('/history/'+accepted.prompt_id);const record=records[accepted.prompt_id]
  if(!record)continue
  if(record.status?.status_str==='error')throw Error('多图层推理失败，请检查显存与工作流日志')
  const files=record.outputs?.['18']?.images
  if(files?.length){
   const images=[]
   for(const [index,file] of files.entries()){
    const r=await fetch(endpoint+'/view?'+new URLSearchParams(file),{signal:AbortSignal.timeout(30000)})
    if(!r.ok)throw Error('多图层结果读取失败')
    images.push({src:'data:image/png;base64,'+Buffer.from(await r.arrayBuffer()).toString('base64'),review:{layer:'图层 '+(index+1),protection:'Qwen 独立 RGBA 图层；遮挡部分为 AI 推断补全，需复核'}})
   }
   await api('/free',{unload_models:true,free_memory:true}).catch(()=>{})
   return images
  }
 }
 // Do not interrupt unrelated ComfyUI work or resubmit automatically.
 throw Error('多图层等待超时；请核对本地 ComfyUI 原任务，未自动重新提交')
}
process.once('exit',()=>{for(const child of children)child.kill();comfy?.kill()})
