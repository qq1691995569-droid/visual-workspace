import test from 'node:test'
import assert from 'node:assert/strict'
import {builtinRuleReferences} from '../server/config-rule-reference.mjs'
import {defaults,configContext} from '../server/function-config.mjs'
import {imageToolError} from '../server/image-tool-error.mjs'
test('supplement-only features expose real built-in rules even when overrides are empty',async()=>{
 const config=await defaults()
 config.features.find(f=>f.id==='material').text='private draft override'
 const rules=configContext.run(config,()=>builtinRuleReferences())
 assert.match(rules.material,/material-object-outline-v4/)
 assert.match(rules.material,/完整可见/)
 assert.doesNotMatch(rules.material,/private draft override/)
 assert.match(rules.light,/室内摄影灯光师/)
 for(const feature of config.features)assert.ok(feature.text.trim()||rules[feature.id],feature.id+' has no visible rules')
})
test('image failures identify the stage without exposing raw diagnostics',()=>{
 assert.match(imageToolError('DecompressionBombError: secret path',{action:'inspect'}),/4000 万像素/)
 assert.match(imageToolError('ModuleNotFoundError: PIL',{action:'prepare'}),/依赖缺失/)
 assert.match(imageToolError('UnidentifiedImageError',{action:'inspect'}),/底图读取.*重新导入/)
 assert.doesNotMatch(imageToolError('ValueError: secret token',{action:'prepare'}),/secret/)
 assert.match(imageToolError('',{signal:'SIGTERM'}),/超时/)
})
