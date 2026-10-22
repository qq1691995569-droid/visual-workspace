import {configContext} from './function-config.mjs'
import {localEditPlan} from './canvas-assets.mjs'
import {lightingPlan} from './lighting.mjs'

// Render the actual execution contracts, not a second copy of the rules.
export function builtinRuleReferences(){
 return configContext.run(undefined,()=>{
  const points=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]
  const asset={kind:'material',name:'所选材质',prompt:'用户绑定的材质描述',image:'data:image/png;base64,AAAA'}
  const plan=localEditPlan({kind:'material',supplement:'',spatialGuidance:'object-outline',regions:[{target:'用户点选对象',points,mark:[.5,.5],selectionReviewed:true,asset}]})
  return {
   material:[`内置规则版本：${plan.ruleVersion}`,'角色：对象边界校正与材质编辑专家。',...plan.instructionPriority,plan.conflictResolution,plan.editBoundary,plan.boundaryCorrection,...Object.entries(plan.defaultPreservation).map(([key,value])=>`${key}：${value}`),plan.note].filter(Boolean).join('\n\n'),
   light:lightingPlan().prompt,
  }
 })
}
