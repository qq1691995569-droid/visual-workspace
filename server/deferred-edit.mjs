import {cleanAsset,localEditPlan,localEditImages,usesAssetReference} from './canvas-assets.mjs'
import {validMark} from './object-selection.mjs'
export function deferredEdit(edit){
 if(!edit||edit.deferredSelection!==true||!['material','model'].includes(edit.kind)||!Array.isArray(edit.regions)||edit.regions.length<1||edit.regions.length>4||typeof edit.supplement!=='string'||edit.supplement.length>5000)throw Error('请点选 1–4 个对象并绑定资产')
 return {kind:edit.kind,supplement:edit.supplement,regions:edit.regions.map((r,i)=>{
  const mark=validMark(r.mark),asset=cleanAsset(r.asset)
  if(asset.kind!==edit.kind||typeof r.target!=='string'||r.target.length>200)throw Error(`对象 ${i+1} 的资产或名称无效`)
  return {id:r.id||String(i+1),mark,target:r.target||`对象 ${i+1}`,asset,useImageReference:r.useImageReference===true}
 })}
}
export async function prepareDeferredEdit(job,body,{save,inspect,capabilities,validate,locate,prepare,submit}){
 const edit=deferredEdit(body.edit),total=edit.regions.length
 const stage=async(step,message)=>{job.phase={step,total:4};job.status=step===1?'locating':'composing';job.message=message;await save(job)}
 await stage(1,`步骤 1/4 · 正在校验底图与参数，等待识别 ${total} 个对象`)
 const metadata=await inspect(body.base),caps=await capabilities()
 job.ratio=metadata.ratio
 validate({mode:'redraw',prompt:'参数校验',images:Array(edit.regions.some(r=>usesAssetReference(edit.kind,r))?4:3).fill(body.base),options:{...body.options,ratio:job.ratio}},caps)
 let completed=0
 await stage(1,`步骤 1/4 · 后台识别对象范围（0/${total}）`)
 const results=await Promise.allSettled(edit.regions.map(async(region,i)=>{
  try{const found=await locate(edit.kind,region.mark,region.target);completed++;await stage(1,`步骤 1/4 · 后台识别对象范围（${completed}/${total}）`);return {...region,...found,target:found.name||region.target,selectionReviewed:true,strokes:[]}}
  catch(error){throw Error(`对象 ${i+1}（${region.target}）识别失败：${error.message}；尚未提交生图，请调整标记或名称后重试`)}
 }))
 const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason
 const regions=results.map(r=>r.value),resolved={...edit,regions,...(edit.kind==='material'?{spatialGuidance:'object-outline'}:{})}
 const plan=localEditPlan(resolved);plan.regions.forEach(r=>{r.selectionSource='根据用户点选自动识别的建议范围，生成后需复核'})
 job.resolvedRegions=regions.map(r=>({id:r.id,target:r.name||r.target,points:r.points,polygons:r.polygons,exclusions:r.exclusions,mark:r.mark,confidence:r.confidence,notes:r.notes}))
 await stage(2,'步骤 2/4 · 正在组合对象范围、目标轮廓定位图与编号材质参考')
 const prepared=await prepare({action:'prepare',base:body.base,regions:regions.map(r=>({...r,useImageReference:usesAssetReference(edit.kind,r)}))})
 const input={mode:'redraw',prompt:JSON.stringify(plan),images:localEditImages(body.base,prepared,resolved),options:{...body.options,ratio:job.ratio}}
 const request=validate(input,caps)
 job.localEdit={base:body.base,...(resolved.spatialGuidance?{spatialGuidance:resolved.spatialGuidance}:{}),regions:regions.map(r=>({points:r.points,polygons:r.polygons,exclusions:r.exclusions,strokes:r.strokes}))}
 delete job.deferredEdit
 job.options={...input.options};await save(job)
 await submit(job,input,request)
}
