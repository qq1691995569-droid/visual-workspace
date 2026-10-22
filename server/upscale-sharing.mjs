import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {atomicJsonWriter} from './atomic-json.mjs'
const write=atomicJsonWriter()
export const tokenHash=token=>createHash('sha256').update(token||'').digest('hex')
export async function sharingConfig(directory){try{return JSON.parse(await readFile(path.join(directory,'upscale-sharing.json'),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw Error('共享配置无法读取')}}
export function sharingAdmin(directory){
 let queue=Promise.resolve()
 async function get(){const c=await sharingConfig(directory);return {configured:!!c,origin:c?.origin||'',clients:(c?.clients||[]).map(({id,name,enabled,createdAt})=>({id,name,enabled,createdAt}))}}
 return {get,mutate(action,body){const work=queue.catch(()=>{}).then(async()=>{
  const c=await sharingConfig(directory);if(!c)throw Error('请先运行共享服务初始化脚本')
  if(action==='create'){
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>60)throw Error('请填写同事名称（最多 60 字）')
   const token=randomBytes(32).toString('hex'),id=randomUUID()
   c.clients.push({id,name:body.name.trim(),enabled:true,createdAt:new Date().toISOString(),tokenHash:tokenHash(token)})
   await write(path.join(directory,'upscale-sharing.json'),c)
   return {...await get(),connection:{origin:c.origin,ca:await readFile(path.join(directory,'upscale-share-cert.pem'),'utf8'),token}}
  }
  if(action==='revoke'){const client=c.clients.find(i=>i.id===body.id);if(!client)throw Error('访问凭据不存在');client.enabled=false;await write(path.join(directory,'upscale-sharing.json'),c);return get()}
  throw Error('共享管理操作不存在')
 });queue=work;return work}}
}
