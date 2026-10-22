import {taskMonitor} from './task-monitor.mjs'
import {upscaleAdmin} from './upscale-admin.mjs'
import {sharingAdmin} from './upscale-sharing.mjs'
import {builtinRuleReferences} from './config-rule-reference.mjs'
import {fileURLToPath} from 'node:url'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {randomBytes,timingSafeEqual} from 'node:crypto'
import path from 'node:path'
import {configStore,definitions,switchDefinitions} from './function-config.mjs'
import {fetchPublished,publishConfig} from './config-publication.mjs'
const directory=process.env.CANVAS_DATA_DIR||fileURLToPath(new URL('../.canvas-data/',import.meta.url))
export const functionStore=configStore(directory,{fetchRemote:fetchPublished,publishRemote:publishConfig})
const upscaleManagement=upscaleAdmin(directory)
const sharingManagement=sharingAdmin(directory)
export async function adminKey(){
 const file=path.join(directory,'config-admin-key.txt')
 try{return (await readFile(file,'utf8')).trim()}catch(e){if(e.code!=='ENOENT')throw e}
 await mkdir(directory,{recursive:true})
 try{await writeFile(file,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e}
 return (await readFile(file,'utf8')).trim()
}
export function sameKey(actual,expected){const a=Buffer.from(actual||''),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)}
export function adminManagement({store=functionStore,getKey=adminKey}={}){return async function(req,res,body){
 const key=req.headers.authorization?.replace(/^Bearer /,'')
 if(!key)throw Object.assign(Error('请输入本机管理口令'),{status:401})
 if(!sameKey(key,await getKey()))throw Object.assign(Error('管理口令无效'),{status:403})
 const route=req.url
 if(req.method==='GET'&&route==='/api/skills/config-admin/upscale-sharing')return sharingManagement.get()
 if(req.method==='POST'&&/^\/api\/skills\/config-admin\/upscale-sharing\/(create|revoke)$/.test(route))return sharingManagement.mutate(route.split('/').at(-1),body)
 if(req.method==='GET'&&route==='/api/skills/config-admin/upscale')return upscaleManagement.get()
 if(req.method==='POST'&&/^\/api\/skills\/config-admin\/upscale\/(draft|publish|restore)$/.test(route))return upscaleManagement.mutate(route.split('/').at(-1),body)
 if(req.method==='GET'&&route==='/api/skills/config-admin/tasks')return taskMonitor(directory)
 if(req.method==='GET'&&route==='/api/skills/config-admin'){
  await store.active()
  return {...await store.read(),builtinRules:builtinRuleReferences(),switchDefinitions,definitions:definitions.map(({id,name,format})=>({id,name,format}))}
 }
 if(req.method==='POST'&&route==='/api/skills/config-admin/draft')return store.saveDraft(body)
 if(req.method==='POST'&&route==='/api/skills/config-admin/publish')return store.publish(body)
 throw Object.assign(Error('管理接口不存在'),{status:404})
}}
export const manageConfig=adminManagement()
