import {createHmac,randomUUID} from 'node:crypto'
export function signedLiblibUrl(route,credentials,now=Date.now(),nonce=randomUUID()){
 const signature=createHmac('sha1',credentials.secretKey).update(`${route}&${now}&${nonce}`).digest('base64url')
 const url=new URL(route,'https://openapi.liblibai.cloud')
 url.search=new URLSearchParams({AccessKey:credentials.accessKey,Signature:signature,Timestamp:String(now),SignatureNonce:nonce}).toString()
 return url
}
export function workflowRequest(workflow,image,values={}){
 if(!workflow.template_uuid||!workflow.workflow_uuid||!/^\d+$/.test(workflow.load_image_node_id||''))throw Error('缺少实际 API 模板、工作流或图片节点 ID')
 const params=structuredClone(workflow.generate_params_template)
 if(!params||params[workflow.load_image_node_id]?.class_type!=='LoadImage')throw Error('图片节点与 API 模板不一致')
 const allowed=workflow.editable_params||[]
 for(const [node,fields] of Object.entries(values))for(const name of Object.keys(fields))if(!allowed.some(g=>g.node_id===node&&g.params.some(p=>p.name===name)))throw Error('存在未开放的参数')
 for(const group of allowed)for(const p of group.params){
  const value=values[group.node_id]?.[p.name]??p.default
  if(['int','float'].includes(p.input_type)){if(!Number.isFinite(value)||p.input_type==='int'&&!Number.isInteger(value)||p.min!==undefined&&value<p.min||p.max!==undefined&&value>p.max)throw Error('参数超出范围：'+p.name)}
  else if(p.input_type==='boolean'){if(typeof value!=='boolean')throw Error('开关参数无效')}
  else if(p.input_type==='select'){if(!p.options?.some(o=>(typeof o==='object'?o.value:o)===value))throw Error('选项无效')}
  else throw Error('暂不支持该参数类型')
  if(!params[group.node_id]?.inputs||!(p.name in params[group.node_id].inputs))throw Error('参数节点与模板不一致')
  params[group.node_id].inputs[p.name]=value
 }
 for(const rule of workflow.cross_field_rules||[]){const tuple=rule.fields.map(f=>params[f.node_id]?.inputs?.[f.param_name]);if(rule.forbidden_tuples?.some(t=>JSON.stringify(t)===JSON.stringify(tuple)))throw Error(rule.message||'参数组合禁止使用')}
 params.workflowUuid=workflow.workflow_uuid
 params[workflow.load_image_node_id].inputs.image=image
 return {templateUuid:workflow.template_uuid,generateParams:params}
}
export function liblibClient(credentials,fetcher=fetch){
 async function call(route,body){
  let response;try{response=await fetcher(signedLiblibUrl(route,credentials),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000),redirect:'error'})}catch{throw Error('Liblib 请求中断或超时')}
  if(!response.ok)throw Error(`Liblib HTTP ${response.status}`)
  const result=await response.json();if(result.code!==0||!result.data)throw Error('Liblib 业务请求失败，错误码：'+String(result.code).slice(0,30))
  return result.data
 }
 return {call,async upload(image){
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image||'');if(!match)throw Error('原图格式无效')
  const bytes=Buffer.from(match[2],'base64');if(bytes.length>30*1024*1024)throw Error('原图超过 30 MB')
  const info=await call('/api/generate/upload/signature',{name:'input',extension:match[1]==='jpeg'?'jpg':match[1]})
  const url=new URL(info.postUrl);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.endsWith('.aliyuncs.com'))throw Error('上传签名返回非预期 OSS 地址')
  const form=new FormData();for(const [field,key] of Object.entries({key:'key',policy:'policy','x-oss-signature':'xOssSignature','x-oss-date':'xOssDate','x-oss-signature-version':'xOssSignatureVersion','x-oss-credential':'xOssCredential','x-oss-expires':'xOssExpires'})){if(!info[key])throw Error('上传签名字段不完整');form.set(field,String(info[key]))}
  form.set('file',new Blob([bytes],{type:'image/'+match[1]}),'input.'+match[1])
  const response=await fetcher(url,{method:'POST',body:form,signal:AbortSignal.timeout(60000),redirect:'error'});if(!response.ok)throw Error('Liblib 原图上传失败')
  return new URL('/'+String(info.key).split('/').map(encodeURIComponent).join('/'),url.origin).href
 }}
}
