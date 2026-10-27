import {configuredText,personaText} from './function-config.mjs'
// Normalized UI values are edit intentions, not native renderer parameters.
// Give the image model observable targets as well as the continuous value.
function level(value, descriptions) {
 return descriptions[Math.min(4, Math.floor(value / 20))]
}
function sliderTargets(effective) {
 const targets=[]
 if(effective.temperature!==undefined){
  const value=effective.temperature, strength=level(Math.abs(value),['轻微','柔和','明显','较强','强烈但自然'])
  targets.push(value===0?'自然光白平衡中性：消除自然光的冷暖偏色，白色受光表面保持中性。':`自然光色温 ${value}/100：${strength}${value<0?'偏冷，受自然光照亮的白色表面呈冷白、浅蓝倾向':'偏暖，受自然光照亮的白色表面呈暖白、金黄倾向'}；程度随绝对值连续增加。仅改变光照色偏，不替换材质固有色，不覆盖人工灯具色温。`)
 }
 if(effective.intensity!==undefined){
  const value=effective.intensity
  targets.push(`太阳直射光相对环境光强度 ${value}/100：${value===0?'无太阳直射贡献，移除直射光斑及其投影，保留环境光和接触阴影':level(value,['极弱直射，受光区与背光区只有轻微亮度差','柔弱直射，光斑较淡，环境光占主导','中等直射，受光面与背光面有明确但适中的光比','强直射，光斑明亮，受光面与背光面的亮度差明显','很强直射，光斑与投影形成鲜明光比，但保留高光纹理'])}。数值增大时提高直射相对环境光的贡献，不用整图提曝光代替，不改变投影软硬。`)
 }
 if(effective.hardness!==undefined){
  const value=effective.hardness
  targets.push(`太阳投影边缘清晰度 ${value}/100：${level(value,['非常柔软，远离接触处的投影具有宽阔、连续的半影过渡，不能保留刀切般窗影','柔和，远离接触处的窗影和物体投影边缘明显羽化，不应出现硬直边','适中，投影轮廓可辨且边缘有自然过渡','较硬，投影轮廓明确，半影过渡窄','很硬，远离接触处的投影仍轮廓清晰、边缘锐利，保留自然抗锯齿'])}。数值越低半影越宽，越高边缘越清晰；只调整照明投影，不能模糊照片、家具或人物，保留接触阴影。`)
 }
 return targets
}
export const exteriorCheckPrompt='你是场景结构检查员。仅检查原始底图是否存在真实窗户或敞开的外门，并且能直接看到室外景观。墙面、画框、镜面反射、电视、光斑、窗影、被窗帘完全遮挡的开口以及推断的画外光源都不算。不得依据用户想要的外景猜测存在窗户。只输出 JSON：{"visibleExterior":true或false,"confidence":"high或medium或low","region":"实际可见窗外区域的位置和边界，未发现时为空"}。不确定时返回 false。'
export function lightingPlan(settings={},supplement='',exteriorEvidence){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('光影参数无效')
 if(typeof supplement!=='string'||supplement.length>5000)throw Error('补充说明请控制在 5000 字以内')
 const hidden=new Set(Array.isArray(settings.hiddenModules)?settings.hiddenModules:[]),effective={}
 for(const key of ['sunlight','temperature','intensity','hardness','mode','direction','lamps','weather','time','exterior']){
  const v=settings[key];if(v===undefined||hidden.has(key))continue
  if(key==='sunlight'){if(typeof v!=='boolean')throw Error('阳光参数无效')}
  else if(['temperature','intensity','hardness'].includes(key)){if(!Number.isFinite(v)||v<(key==='temperature'?-100:0)||v>100)throw Error('光影滑块超出范围')}
  else if(!({mode:['optimize','reshape'],direction:['auto','left','right','front','back'],lamps:['keep','on','off'],weather:['keep','sunny','overcast','rainy'],time:['keep','morning','noon','afternoon','night'],exterior:['keep','residential','city','forest','ocean']}[key].includes(v)))throw Error('光影选项无效')
  effective[key]=v
 }
 const adjustments=[]
 const exteriorAllowed=exteriorEvidence?.visibleExterior===true&&exteriorEvidence?.confidence==='high'&&typeof exteriorEvidence?.region==='string'&&exteriorEvidence.region.trim().length>0
 if(effective.exterior&&effective.exterior!=='keep'&&!exteriorAllowed){delete effective.exterior;adjustments.push('底图未确认有可见窗外区域，本次忽略外景选项，禁止新增窗户或改变墙体结构')}

 if(effective.time==='night'&&(effective.sunlight===true||effective.intensity!==undefined||effective.hardness!==undefined)){adjustments.push('夜晚优先于直射阳光参数，取消太阳直射光及其强度和软硬设置');effective.sunlight=false}
 if(effective.sunlight===false){delete effective.intensity;delete effective.hardness}
 if(effective.intensity===0&&effective.hardness!==undefined){delete effective.hardness;adjustments.push('阳光强度为零，本次不应用太阳投影软硬；保留环境光和接触阴影')}
 const instructions=[]
 if(effective.sunlight!==undefined)instructions.push(effective.sunlight&&effective.intensity!==0?'从底图已有窗户或合理的画外入光方向引入太阳直射光，不新增窗户或虚构窗格。':'去除太阳直射成分，保留柔和环境光、已有灯光和接触阴影。')
 instructions.push(...sliderTargets(effective))
 if(effective.direction&&effective.direction!=='auto')instructions.push(`主入光来自画面${{left:'左侧',right:'右侧',front:'正面',back:'侧后方'}[effective.direction]}，物体投影向背离光源的方向延伸；人物、家具、地面、高光与反射遵循同一光向。`)
 if(effective.lamps&&effective.lamps!=='keep')instructions.push(`底图已有室内照明灯具${effective.lamps==='on'?'开启':'关闭'}，不新增灯具，不改变产品指示灯。`)
 if(effective.weather&&effective.weather!=='keep')instructions.push(`天气：${{sunny:'晴天，环境光清透，是否有直射光遵循阳光开关',overcast:'阴天，以柔和天空漫射为主',rainy:'雨天，柔和低对比环境光；雨只存在窗外，不新增室内雨水或湿地面'}[effective.weather]}。若阴雨天同时启用阳光，表现云隙透光而非均匀阴天与强烈全幅直射并存。`)
 if(effective.time&&effective.time!=='keep')instructions.push(`时间：${{morning:'清晨',noon:'正午',afternoon:'午后',night:'夜晚，无太阳直射；保留合理夜间环境光，不自动开启未指定的灯具'}[effective.time]}。显式色温优先于时间对应的惯常冷暖。`)
 const exterior=effective.exterior&&effective.exterior!=='keep'
 if(exterior)instructions.push(`底图已确认的窗外区域（位置数据）：${JSON.stringify(exteriorEvidence.region.slice(0,500))}。窗外景观：${{residential:'住宅小区',city:'城市建筑',forest:'森林树木',ocean:'海洋远景'}[effective.exterior]}。只修改底图已有窗户中实际可见的室外区域，保持窗框、玻璃、窗帘及遮挡边界和原透视，不扩窗、不移动机位；没有可见窗外区域时不生成新窗或壁画，仅保留室内。`)
 const mode=effective.mode==='reshape'||exterior||effective.time&&effective.time!=='keep'||effective.weather&&effective.weather!=='keep'||effective.sunlight!==undefined||effective.direction&&effective.direction!=='auto'?'reshape':'optimize'
 const prompt=`结构保护是本任务不可被光影参数或补充说明覆盖的前提。禁止新增、扩大、移动或删除窗户、门洞、墙体与窗框。画外入光只能改变明暗，不能将画外光源变成画内窗户。${exterior?'外景仅允许出现在底图已确认的可见区域，保持其原有边界。':'本次不执行外景替换，不生成窗户或任何新的室外视野；即使补充说明提到外景，也不能据此开窗。'}
你是室内摄影灯光师。以唯一输入底图为结构依据，执行${mode==='reshape'?'光影重塑':'光影优化，保留原主光方向和时间感'}。先根据窗户、窗帘和投影判断环境光与太阳直射光；画外光源只能合理推断，不新增窗户、灯具或窗格投影。
 优先级：用户补充说明 > 显式光影参数 > 底图与默认规则。若补充说明与参数冲突，按补充说明调整冲突项；其余项保留。未明确设置的项沿用底图。参数为视觉意图，不是精确物理量。
 显式光影目标：${instructions.join(' ')||'自然改善曝光、白平衡、高光和暗部层次，不改变原照明布局。'}
 执行要求：保留结构不等于保留旧光照。显式指定的光照目标应体现在受光面、光斑和投影上；若底图不符，应重算对应照明，不仅做轻微全图调色。未指定的光照属性继续沿用。检查结果是否达到指定的冷暖、光比和投影边缘目标；不要求输出检查文字。天气和时间的惯常光影不得覆盖显式滑块目标。
 用户补充说明：${supplement||'无'}
 保持机位、透视、裁切、构图、家具和人物的数量、位置、尺度、造型、姿态与遮挡。保持纹理、材质固有色、产品外观与原有文字。${exterior?'除上述明确授权的窗外景观外，其余区域只调整光影。':'保持原有窗外景观。'}只调整光照导致的明暗、色偏、高光、投影和反射，统一全图光照，保留自然接触阴影。禁止换家具、换材质、改变人物身份或新增装饰。输出一张完整照片，不添加文字、编号、分屏或说明。`
 return {version:'scene-lighting-v5',promptRevision:2,mode,adjustments,exteriorEvidence,effective,supplement,prompt:[personaText('light'),prompt,configuredText('light','')].filter(Boolean).join('\n')}
}
