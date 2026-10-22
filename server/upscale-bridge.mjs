import {createHash} from 'node:crypto'

export function upscaleBridge({dreo,load,save,create,active,monitor,publicJob,imageValid}) {
  const remote=dreo
  return async function handle(method,url,body) {
    if(method==='GET'&&url==='/api/skills/upscale/workflows') {
      try{return await remote('GET','/upscale/workflows')}
      catch(error){throw Error('平台图像放大接入尚未可用，请先发布平台接口或检查账号权限。'+error.message)}
    }
    if(method==='POST'&&url==='/api/skills/upscale/recover'){
      const job=await load(body.requestId)
      if(!job.upscale||!job.taskId)throw Error('没有可查询的远端放大任务，请先核对平台记录')
      job.status='running';job.message='正在重新获取原放大任务与结果';await save(job);monitor(job.id);return publicJob(job)
    }
    if(method!=='POST'||url!=='/api/skills/upscale/tasks')return
    if(!/^[a-f0-9-]{36}$/.test(body.requestId)||!imageValid(body.base)||typeof body.workflowId!=='string'||!Number.isInteger(body.workflowVersion)||!body.paramValues||typeof body.paramValues!=='object'||Array.isArray(body.paramValues))throw Error('图像放大输入无效')
    const fingerprint=createHash('sha256').update(JSON.stringify({base:body.base,workflow:body.workflowId,version:body.workflowVersion,params:body.paramValues})).digest('hex')
    try{const prior=await load(body.requestId);if(prior.fingerprint!==fingerprint)throw Error('请求 ID 冲突');return publicJob(prior)}catch(error){if(error.code!=='ENOENT')throw error}
    const catalog=await remote('GET','/upscale/workflows')
    const workflow=catalog.items?.find(item=>item.id===body.workflowId&&item.version===body.workflowVersion)
    if(!workflow)throw Error('放大工作流已变更，请刷新工作流后再提交')
    for(const group of workflow.editable_params||[])for(const param of group.params){
      const value=body.paramValues[group.node_id]?.[param.name]??param.default
      if(['int','float'].includes(param.input_type)&&(typeof value!=='number'||!Number.isFinite(value)||param.input_type==='int'&&!Number.isInteger(value)||param.min!==undefined&&value<param.min||param.max!==undefined&&value>param.max))throw Error((param.display_name||param.name)+' 超出允许范围或格式无效')
    }
    for(const rule of workflow.cross_field_rules||[]){
      const selected=rule.fields.map(field=>body.paramValues[field.node_id]?.[field.param_name]??workflow.editable_params.find(group=>group.node_id===field.node_id)?.params.find(param=>param.name===field.param_name)?.default)
      if(rule.forbidden_tuples?.some(tuple=>JSON.stringify(tuple)===JSON.stringify(selected)))throw Error(rule.message||'放大参数组合无效')
    }
    const job={id:body.requestId,type:'generation',feature:'image',upscale:true,fingerprint,options:{count:1},status:'uploading',message:'正在上传放大原图',images:[],createdAt:new Date().toISOString()}
    if(!await create(job)){const prior=await load(job.id);if(prior.fingerprint!==fingerprint)throw Error('请求 ID 冲突');return publicJob(prior)}
    active.add(job.id)
    void(async()=>{
      let attempted=false
      try{
        const uploaded=await remote('POST','/upload',{image:body.base})
        if(!uploaded.storage_key)throw Error('底图上传未返回存储键')
        job.status='submitting';job.message='正在提交平台放大任务';await save(job)
        attempted=true
        const task=await remote('POST','/tasks',{tool_type:'upscaler',params:{source_path:uploaded.storage_key,workflow_config_id:body.workflowId,workflow_version:body.workflowVersion,param_values:body.paramValues}})
        if(!task.task_id)throw Error('平台未返回任务编号')
        job.taskId=task.task_id;job.status='running';job.message='平台正在放大图片';await save(job)
      }catch(error){job.status=job.taskId?'running':attempted?'submission_unknown':'paused';job.message=job.taskId?'远端任务已提交，请查询原任务':attempted?'提交结果未确认，请核对平台任务；不会自动重新提交':error.message;try{await save(job)}catch{/* Preserve initial record; never resubmit. */}}
      finally{active.delete(job.id);if(job.taskId)monitor(job.id)}
    })()
    return publicJob(job)
  }
}
