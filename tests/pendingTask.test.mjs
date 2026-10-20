import test from 'node:test'
import assert from 'node:assert/strict'
import {pendingTask} from '../src/pendingTask.ts'
test('占位图使用主任务实时状态，兼容提交 ID 与后台 ID',()=>{
 const job={id:'server',requestId:'client',status:'running'}
 assert.equal(pendingTask('client',{imageJob:job}),job)
 assert.equal(pendingTask('server',{imageJob:job}),job)
 const failed={...job,status:'paused',message:'HTTP 500'}
 assert.equal(pendingTask('client',{imageJob:failed},{status:'restoring'}),failed)
 const skill={jobId:'skill',requestId:'request',status:'running'}
 assert.equal(pendingTask('request',{skillState:skill}),skill)
})
test('旧批次不使用新批次状态，没有来源时保留查询结果',()=>{
 const fallback={status:'paused',message:'旧批次失败'}
 assert.equal(pendingTask('old',{imageJob:{id:'new',status:'running'}},fallback),fallback)
 assert.equal(pendingTask('old',undefined,fallback),fallback)
 assert.equal(pendingTask('old'),undefined)
})
