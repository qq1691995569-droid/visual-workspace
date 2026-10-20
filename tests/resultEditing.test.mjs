import test from 'node:test'
import assert from 'node:assert/strict'
import {resultEditing} from '../src/resultEditing.ts'
test('文生图、图生图和编辑结果使用常规窗口，旧项目仍按来源识别',()=>{
 for(const tool of ['generate','redraw','edit'])assert.equal(resultEditing({iterationContext:{tool}}).skill,false)
 assert.equal(resultEditing({}, {tool:'generate'}).skill,false)
 assert.equal(resultEditing({tool:'redraw'}).skill,false)
})
test('只有实际技能结果使用技能补充框，资产快照及删除来源后仍可识别',()=>{
 for(const tool of ['style','material','light','furniture'])assert.equal(resultEditing({iterationContext:{tool}}).skill,true)
 assert.equal(resultEditing({localEdit:{kind:'model'}}).skill,true)
 assert.equal(resultEditing({}, {tool:'style'}).skill,true)
 assert.equal(resultEditing({iterationContext:{tool:'generate'}},{tool:'style'}).skill,false)
})
