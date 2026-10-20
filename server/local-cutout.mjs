import {spawn} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
let worker,pending,buffer='',queue=Promise.resolve(),idle
function start(){
 if(worker)return
 worker=spawn(process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),[path.join(root,'server/cutout_worker.py')],{windowsHide:true})
 const child=worker
 worker.stderr.resume()
 worker.stdout.on('data',chunk=>{if(worker!==child)return;buffer+=chunk;const at=buffer.indexOf('\n');if(at<0)return;const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const result=JSON.parse(line);if(result.error)pending?.reject(Error('本地抠图未完成：'+result.error));else pending?.resolve(result)}catch{pending?.reject(Error('本地抠图结果无效'))}})
 const failed=()=>{if(worker!==child)return;worker=undefined;buffer='';pending?.reject(Error('本地抠图运行时未就绪，请运行安装脚本'));pending=undefined}
 worker.on('error',failed);worker.on('exit',failed);worker.stdin.on('error',()=>{})
}
export function localCutout(base,model='u2netp'){
 const run=queue.then(()=>new Promise((resolve,reject)=>{
  clearTimeout(idle);start()
  const timer=setTimeout(()=>{pending=undefined;const child=worker;worker=undefined;buffer='';child?.kill();reject(Error('本地抠图超时，请缩小图片后重试'))},120000)
  const finish=fn=>value=>{clearTimeout(timer);pending=undefined;idle=setTimeout(()=>worker?.kill(),120000);idle.unref();fn(value)}
  pending={resolve:finish(resolve),reject:finish(reject)}
  worker.stdin.write(JSON.stringify({base,model})+'\n')
 }))
 queue=run.catch(()=>{})
 return run
}
process.once('exit',()=>worker?.kill())
