import test from 'node:test'
import assert from 'node:assert/strict'
import {lightingPlan} from '../server/lighting.mjs'

test('滑块编译为可观察的软硬、光比和冷暖目标，而不是仅提交数字',()=>{
 const soft=lightingPlan({sunlight:true,hardness:22,direction:'right',weather:'sunny'})
 assert.match(soft.prompt,/22\/100：柔和.*明显羽化/)
 assert.match(soft.prompt,/背离光源/)
 assert.doesNotMatch(soft.prompt,/投影方向与光源一致/)
 assert.match(lightingPlan({hardness:90}).prompt,/边缘锐利/)
 assert.match(lightingPlan({hardness:0}).prompt,/宽阔、连续的半影/)
 assert.match(lightingPlan({intensity:15}).prompt,/只有轻微亮度差/)
 assert.match(lightingPlan({intensity:95}).prompt,/鲜明光比/)
 assert.match(lightingPlan({temperature:-80}).prompt,/冷白、浅蓝/)
 assert.match(lightingPlan({temperature:80}).prompt,/暖白、金黄/)
 assert.equal(soft.promptRevision,2)
 assert.match(soft.prompt,/不得覆盖显式滑块目标/)
})

test('阳光开关开启但强度为零时，不同时要求引入直射光',()=>{
 const plan=lightingPlan({sunlight:true,intensity:0,hardness:90})
 assert.equal(plan.effective.intensity,0)
 assert.match(plan.prompt,/无太阳直射贡献/)
 assert.doesNotMatch(plan.prompt,/引入太阳直射光/)
 assert.equal(plan.effective.hardness,undefined)
 assert.doesNotMatch(plan.prompt,/边缘锐利/)
 assert.equal(plan.adjustments.length,1)
})
test('光影启用值与零值有效，关闭阳光不提交强度，移除与缓存不参与生成',()=>{
 const plan=lightingPlan({sunlight:false,temperature:0,intensity:80,hardness:30,hiddenModules:['lamps'],lamps:'on',remembered:{direction:'left'}},'暗部不要太黑')
 assert.deepEqual(plan.effective,{sunlight:false,temperature:0});assert.match(plan.prompt,/中性/);assert.match(plan.prompt,/暗部不要太黑/)
 assert.equal(lightingPlan({intensity:0}).effective.intensity,0)
 assert.equal(lightingPlan({}).mode,'optimize');assert.equal(lightingPlan({direction:'right'}).mode,'reshape')
 assert.throws(()=>lightingPlan({temperature:101}));assert.throws(()=>lightingPlan({sunlight:'yes'}))
})

test('天气时间外景参与提示词，夜晚消除直射冲突，隐藏选项不生效',()=>{
 const plan=lightingPlan({weather:'rainy',time:'night',sunlight:true,intensity:75,exterior:'forest'},'',{visibleExterior:true,confidence:'high',region:'左侧原有窗户内可见室外'})
 assert.equal(plan.effective.sunlight,false);assert.equal(plan.effective.intensity,undefined);assert.equal(plan.adjustments.length,1)
 assert.match(plan.prompt,/雨只存在窗外/);assert.match(plan.prompt,/森林树木/);assert.match(plan.prompt,/没有可见窗外区域/);assert.equal(plan.version,'scene-lighting-v5')
 assert.equal(lightingPlan({weather:'sunny',hiddenModules:['weather']}).effective.weather,undefined)
 assert.throws(()=>lightingPlan({time:'invalid'}));assert.throws(()=>lightingPlan({exterior:'invalid'}))
})

test('外景须有确定的可见开口证据；缺失、模糊、分析失败均不提交景观目标',()=>{
 for(const evidence of [undefined,{visibleExterior:false,confidence:'high',region:''},{visibleExterior:true,confidence:'low',region:'左侧'}, {visibleExterior:true,confidence:'high',region:''}]){
 const plan=lightingPlan({exterior:'forest'},'',evidence)
 assert.equal(plan.effective.exterior,undefined);assert.doesNotMatch(plan.prompt,/森林/);assert.match(plan.prompt,/本次不执行外景替换/);assert.equal(plan.adjustments.length,1)
 }
 const plan=lightingPlan({exterior:'ocean'},'',{visibleExterior:true,confidence:'high',region:'右侧窗框内部'})
 assert.equal(plan.effective.exterior,'ocean');assert.match(plan.prompt,/海洋远景/)
})
