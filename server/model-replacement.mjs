import {configuredText,personaText} from './function-config.mjs'
import {readFileSync} from 'node:fs'

// The reviewable skill document is also the instruction sent to generation.
export function modelReplacementPlan(plan,edit){
  const instructions=configuredText('model',readFileSync(new URL('./skills/model-replacement/SKILL.md',import.meta.url),'utf8')).replace(/^---[\s\S]*?---\s*/,'')
  const inputs=edit.regions||[edit]
  return {...plan,schemaVersion:4,ruleVersion:'model-whole-object-v2',spatialGuidance:'object-outline',
    referenceRoles:['原始场景底图','旧对象粗轮廓定位图，不是硬裁切蒙版',...(edit.regions?['编号对象区域示意图，仅定位']:[]),edit.regions?'编号模型资产参考板，整件造型与配套附件参考':'模型资产参考，整件造型与配套附件参考'],
    instructionPriority:['用户针对目标对象的明确补充','参考资产可见造型及附件组合','资产文字补充','内置规则'],
    locks:{camera:true,composition:true,lighting:true,productLogo:true,unselectedPixels:'语义保护外围场景，不使用旧对象蒙版像素贴回',objectGeometry:'按参考替换整件对象，允许新轮廓与邻近阴影适度变化，其他独立对象保持'},
    note:'旧附件随旧家具清除；参考带附件则使用参考组合，参考没有则不添加。轮廓仅定位，禁止按旧轮廓裁切新造型。',
    objectLocations:inputs.map((r,i)=>({id:i+1,mark:r.mark,polygons:r.polygons||[r.points],protectedOccluders:r.exclusions||[]})),
    instructions:personaText('model')+'\n'+instructions,
  }
}
