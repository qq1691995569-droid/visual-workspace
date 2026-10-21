import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveSkillRatio} from '../server/skill-ratio.mjs'
const route = (aspects) => [{model:'test',supported_aspects:aspects}]
test('轻微裁切和像素取整的底图可匹配标准比例',()=>{
 assert.equal(resolveSkillRatio({model:'test'},route(['3:4','1:1']),2060,2746).ratio,'3:4')
})
test('非标准底图优先模型自动匹配，不再标准比例报错',()=>{
 assert.equal(resolveSkillRatio({ratio:'auto'},route(['auto','1:1']),1100,1700).ratio,'auto')
})
test('无 auto 能力选择相近比例并告知，而不是请求不支持的比例',()=>{
 const result=resolveSkillRatio({},route(['1:1','16:9']),1500,1000)
 assert.equal(result.ratio,'16:9');assert.match(result.warning,/最接近/)
})
test('手动比例优先，非法比例和无可用模型在提交前阻止',()=>{
 assert.equal(resolveSkillRatio({ratio:'16:9'},route(['16:9','1:1']),1000,1000).ratio,'16:9')
 assert.throws(()=>resolveSkillRatio({ratio:'9:16'},route(['1:1']),1000,1000),/不支持/)
 assert.throws(()=>resolveSkillRatio({},[],1000,1000),/不可用/)
})
