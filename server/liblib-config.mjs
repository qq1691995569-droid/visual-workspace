import {readFile} from 'node:fs/promises'
import path from 'node:path'
export async function readLiblibConfig(directory){
 let c
 try{c=JSON.parse((await readFile(path.join(directory,'liblib.json'),'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code==='ENOENT')return null;throw Error('本地 Liblib 配置无法读取')}
 if(c.credentialsFile){
  let keys;try{keys=JSON.parse((await readFile(c.credentialsFile,'utf8')).replace(/^\uFEFF/,''))}catch{throw Error('Liblib 凭据文件无法读取')}
  if(keys.base_url&&keys.base_url.replace(/\/$/,'')!=='https://openapi.liblibai.cloud')throw Error('Liblib 凭据接口地址不匹配')
  c={...c,accessKey:keys.access_key,secretKey:keys.secret_key}
 }
 return c
}
