import test from 'node:test'
import assert from 'node:assert/strict'
import {taskSummary,safeTaskMessage} from '../server/task-monitor.mjs'
import {adminManagement} from '../server/config-admin.mjs'
test('submission stages distinguish uncertainty and post-generation failure',()=>{
 assert.match(taskSummary({failure:{stage:'before_submit'},status:'paused'}).stage,/提交前/)
 assert.match(taskSummary({status:'submission_unknown'}).stage,/不确定/)
 assert.match(taskSummary({status:'paused'}).stage,/记录不足/)
 assert.match(taskSummary({taskId:'remote',remoteStatus:'failed'}).stage,/DREO 已停止/)
 assert.match(taskSummary({taskId:'remote',resultFailure:{stage:'download'}}).stage,/结果下载失败/)
 assert.match(taskSummary({taskId:'remote',resultFailure:{stage:'processing'}}).stage,/结果处理失败/)
 assert.match(taskSummary({taskId:'remote',status:'complete'}).stage,/已完成/)
})
test('monitor excludes private task payloads and sanitizes diagnostic text',()=>{
 const result=taskSummary({id:'id',prompt:'private prompt',base:'private image',functionConfig:{secret:'secret'},message:'https://example.test/?signature=secret Bearer secret token=secret'})
 assert.doesNotMatch(JSON.stringify(result),/private|signature|Bearer|token=secret/)
 assert.doesNotMatch(safeTaskMessage('api_key=hidden'),/=hidden/)
})
test('task monitoring requires the same admin authorization',async()=>{
 const manage=adminManagement({getKey:async()=>'valid'})
 for(const headers of [{},{authorization:'Bearer invalid'}])await assert.rejects(manage({method:'GET',url:'/api/skills/config-admin/tasks',headers},null,{}),e=>[401,403].includes(e.status))
})
