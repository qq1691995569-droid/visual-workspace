import {AsyncLocalStorage} from 'node:async_hooks'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {atomicJsonWriter} from './atomic-json.mjs'

export const configContext=new AsyncLocalStorage()
export const switchDefinitions=[['generate','自由生图'],['tone-skill','场景调色'],['platform-upscale','图像放大'],['extract','提取资产']].map(([id,name])=>({id,name}))
export function publicFeatures(config){return [...config.features.map(({id,name,enabled})=>({id,name,enabled:enabled&&config.switches?.[id]!==false})),...switchDefinitions.map(({id,name})=>({id,name,enabled:config.switches?.[id]!==false}))]}
export const definitions=[
 ['style','风格转换','scene-style-v2.json','rules'],
 ['model','模型替换','model-replacement/SKILL.md','markdown'],
 ['material','材质优化',null,'supplement'],
 ['light','光影调整',null,'supplement'],
 ...['edit','redraw','white-background','background','erase','upscale','expand'].map((id,i)=>[id,['图片编辑','参考生图','白底图','去背景','消除','变清晰','扩图'][i],`canvas-${id}/SKILL.md`,'markdown']),
 ['texture-restore','图片重绘','texture-restore/SKILL.md','markdown'],
 ['separate','室内场景分层','interior-scene-separate/SKILL.md','markdown'],
].map(([id,name,file,format])=>({id,name,file,format}))
const fixedHeaders=Object.fromEntries(await Promise.all(definitions.filter(d=>d.format==='markdown').map(async d=>[d.id,(await readFile(new URL('./skills/'+d.file,import.meta.url),'utf8')).match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0].replace(/\r/g,'')||''])))
export async function defaults(){
 return {schema:1,revision:0,features:await Promise.all(definitions.map(async d=>{
  const text=d.file?await readFile(new URL('./skills/'+d.file,import.meta.url),'utf8'):''
  return {id:d.id,name:d.name,enabled:true,persona:'',text:d.format==='rules'?JSON.parse(text).rules.join('\n'):text}
 }))}
}
const restoreDefault=(await defaults()).features.find(f=>f.id==='texture-restore')
export function validateConfig(value){
 if(value?.features?.length===definitions.length-1&&!value.features.some(f=>f.id==='texture-restore'))value={...value,features:[...value.features,structuredClone(restoreDefault)]}
 if(value?.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.features)||value.features.length!==definitions.length)throw Error('配置版本或功能列表无效')
 const features=definitions.map(d=>{
  const f=value.features.find(f=>f.id===d.id)
  if(!f||typeof f.enabled!=='boolean'||typeof f.name!=='string'||!f.name.trim()||f.name.length>80||typeof f.persona!=='string'||f.persona.length>6000||typeof f.text!=='string'||f.text.length>30000)throw Error('功能配置字段无效：'+d.name)
  if(d.file&&!f.text.trim())throw Error(d.name+' 的规则不能为空')
  if(d.format==='markdown'){
   // Execution metadata is code-owned. Administrators edit instructions, not processors.
   if((f.text.match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0].replace(/\r/g,'')||'')!==fixedHeaders[d.id])throw Error(d.name+' 的执行器和文件头由程序管理，请只修改正文')
  }
  if(d.format==='rules'&&(f.text.split('\n').filter(Boolean).length>100||f.text.split('\n').some(line=>line.length>9999)))throw Error('风格规则最多 100 条，每条少于 10000 字')
  if(/\{\{[^}]+\}\}/.test(f.text+f.persona))throw Error('当前不支持模板变量，请填写直接生效的文本')
  return {id:d.id,name:f.name.trim(),enabled:f.enabled,persona:f.persona.trim(),text:f.text}
 })
 const switches={}
 for(const id of [...definitions,...switchDefinitions].map(d=>d.id)){if(value.switches?.[id]!==undefined){if(typeof value.switches[id]!=='boolean')throw Error('功能开关无效');switches[id]=value.switches[id]}}
 return {schema:1,revision:value.revision,features,switches}
}
export function featureConfig(id){return configContext.getStore()?.features.find(f=>f.id===id)}
export function configuredText(id,fallback){const f=featureConfig(id);return f?f.text:fallback}
export function personaText(id){return featureConfig(id)?.persona||''}
export function configSnapshot(){const c=configContext.getStore();return c?{revision:c.revision,features:c.features}:undefined}
export function featureForRoute(url,body){
 if(url.startsWith('/api/skills/texture-restore/'))return 'texture-restore'
 if(url==='/api/skills/upscale/tasks')return 'platform-upscale'
 if(url==='/api/skills/assets/extract/tasks')return 'extract'
 if(url==='/api/skills/images/tasks')return 'generate'
 if(url==='/api/skills/style/run'||url==='/api/skills/style/prepare')return 'style'
 if(url==='/api/skills/light/run')return 'light'
 if(url==='/api/skills/assets/edit/tasks')return body.edit?.kind
 if(url==='/api/skills/canvas/tasks')return body.operation
 if(url==='/api/skills/expand/tasks')return 'expand'
 return undefined
}
export function configStore(directory,{publishRemote,fetchRemote}={}){
 const write=atomicJsonWriter(),file=path.join(directory,'function-config.json')
 let chain=Promise.resolve(),lastCheck=0
 async function read(){try{const data=JSON.parse(await readFile(file,'utf8'));const fallback=await defaults();for(const config of [data.draft,data.active,...(data.versions||[])]){if(config&&!config.features.some(f=>f.id==='texture-restore'))config.features.push(fallback.features.find(f=>f.id==='texture-restore'))}return data}catch(e){if(e.code!=='ENOENT')throw e;const initial=await defaults();
  try{const legacy=JSON.parse(await readFile(path.join(directory,'skill-config.json'),'utf8'));const version=legacy.versions.find(v=>v.version===legacy.activeVersion);if(version?.rules)initial.features.find(f=>f.id==='style').text=version.rules.join('\n')}catch(error){if(error.code!=='ENOENT')throw error}
  return {draft:initial,active:initial,versions:[initial],audit:[],editRevision:0}}}
 function mutate(fn){const work=chain.then(async()=>{const data=await read();await fn(data);await write(file,data);return data});chain=work.catch(()=>{});return work}
 return {read,
  saveDraft(body){return mutate(data=>{if(body.expected!==data.editRevision)throw Object.assign(Error('配置已被其他窗口修改，请重新加载'),{status:409});data.draft=validateConfig(body.config);data.editRevision++})},
  publish(body){return mutate(async data=>{
   if(body.expected!==data.editRevision)throw Object.assign(Error('配置版本冲突，请重新加载'),{status:409})
   const source=body.rollback===undefined?data.draft:data.versions.find(v=>v.revision===body.rollback)
   if(!source)throw Error('回退版本不存在')
   const next=validateConfig({...source,revision:Math.max(...data.versions.map(v=>v.revision),data.active.revision)+1})
   // Remote commit is the publication boundary. Failure leaves the draft and active version intact.
   if(publishRemote)await publishRemote(next)
   data.active=next;data.draft=next;data.versions.push(next);data.editRevision++
   data.audit.push({at:new Date().toISOString(),actor:'local-admin',revision:next.revision,action:body.rollback===undefined?'publish':'rollback',from:body.rollback??null})
  })},
  async active(){
   if(fetchRemote&&Date.now()-lastCheck>60000){lastCheck=Date.now();try{const remote=validateConfig(await fetchRemote());await mutate(data=>{if(remote.revision>data.active.revision){const clean=JSON.stringify(data.draft)===JSON.stringify(data.active);data.active=remote;data.versions.push(remote);if(clean)data.draft=remote;data.editRevision++}})}catch{/* Offline: keep the last validated configuration. */}}
   return (await read()).active
  },
 }
}
