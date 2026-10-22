import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {atomicJsonWriter} from './atomic-json.mjs'
import {workflowRequest} from './liblib-client.mjs'
import {readLiblibConfig} from './liblib-config.mjs'

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})}
const fields=['id','name','description','enabled','is_default','version','template_uuid','workflow_uuid','load_image_node_id','generate_params_template','editable_params','cross_field_rules']
function clean(w){return Object.fromEntries(fields.filter(k=>w[k]!==undefined).map(k=>[k,structuredClone(w[k])]))}
export function validateWorkflows(items){
 if(!Array.isArray(items)||items.length>50)fail('工作流数量无效')
 const ids=new Set();let defaults=0
 const workflows=items.map(raw=>{
  if(!raw||typeof raw!=='object')fail('工作流格式无效')
  const w=clean(raw)
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(w.id)||ids.has(w.id))fail('工作流编号为空、重复或格式无效')
  ids.add(w.id)
  if(typeof w.name!=='string'||!w.name.trim()||w.name.length>100)fail('请填写工作流名称（最多 100 字）')
  if(typeof w.enabled!=='boolean'||typeof w.is_default!=='boolean')fail('工作流启停或默认状态无效')
  if(w.is_default){if(!w.enabled)fail('默认工作流必须启用');defaults++}
  if(w.description!==undefined&&(typeof w.description!=='string'||w.description.length>1000))fail('说明过长或格式无效')
  if(!Array.isArray(w.editable_params)||!Array.isArray(w.cross_field_rules))fail('参数配置必须为数组')
  // Validate inactive workflows too: publishing must never silently accept broken templates.
  if(!/^[a-f0-9]{32}$/i.test(w.template_uuid)||!/^[a-f0-9]{32}$/i.test(w.workflow_uuid))fail('模板与工作流 UUID 必须为 32 位十六进制字符')
  try{workflowRequest(w,'validation',{})}catch(e){fail(e.message)}
  w.generate_params_template[w.load_image_node_id].inputs.image=''
  delete w.generate_params_template.workflowUuid
  w.version=1
  return w
 })
 if(defaults>1)fail('只能设置一个默认工作流')
 return workflows
}
export function upscaleAdmin(directory){
 const file=path.join(directory,'liblib.json'),draftFile=path.join(directory,'upscale-draft.json'),write=atomicJsonWriter()
 let queue=Promise.resolve()
 const hash=c=>createHash('sha256').update(JSON.stringify(c)).digest('hex')
 async function read(file,fallback){try{return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code==='ENOENT')return fallback;fail('放大配置无法读取，请检查本机文件')}}
 async function state(){const config=await read(file,{workflows:[]});return {config,draft:await read(draftFile,null)}}
 function view({config,draft},credentialsReady){return {revision:hash(config),draftRevision:draft?.revision||0,workflows:(draft?.workflows||config.workflows||[]).map(w=>({...clean(w),is_default:!!w.is_default})),active:(config.workflows||[]).map(w=>({...clean(w),is_default:!!w.is_default})),hasDraft:!!draft,credentialsReady,history:(config.managementHistory||[]).map(h=>({at:h.at,revision:h.revision,names:h.workflows.map(w=>w.name)}))}}
 async function get(){const s=await state();let ready=false;try{const c=await readLiblibConfig(directory);ready=!!(c?.accessKey&&c?.secretKey)}catch{}return view(s,ready)}
 async function mutate(action,body){
  const s=await state()
  if(body.expected!==hash(s.config)||body.draftRevision!==(s.draft?.revision||0))fail('配置已被其他页面修改，请刷新后重试',409)
  if(action==='draft'){
   const workflows=validateWorkflows(body.workflows)
   await write(draftFile,{revision:(s.draft?.revision||0)+1,workflows})
  }else if(action==='publish'){
   if(!s.draft)fail('请先保存草稿')
   const workflows=validateWorkflows(s.draft.workflows).map(w=>({...w,version:Math.max(0,...(s.config.workflows||[]).filter(old=>old.id===w.id).map(old=>old.version||0))+1}))
   const history=[...(s.config.managementHistory||[]),{revision:hash(s.config),at:new Date().toISOString(),workflows:s.config.workflows||[]}]
   await write(file,{...s.config,workflows,managementHistory:history})
   await write(draftFile,null)
  }else if(action==='restore'){
   const previous=s.config.managementHistory?.find(h=>h.revision===body.revision)
   if(!previous)fail('历史版本不存在')
   await write(draftFile,{revision:(s.draft?.revision||0)+1,workflows:previous.workflows.map(w=>({...w,is_default:!!w.is_default}))})
  }else fail('放大管理操作不存在',404)
  return get()
 }
 return {get,mutate(action,body){const work=queue.catch(()=>{}).then(()=>mutate(action,body));queue=work;return work}}
}
