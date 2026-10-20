import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graphCommand, applyGraphCommand } from '../src/graphHistory.ts'
const node = (id, x = 0) => ({ id, position: { x, y: 20 }, data: { kind: 'image', src: 'original' } })

test('移动和缩放可撤销重做，后台新增图片和任务状态均保留', () => {
  const before = { nodes: [node('a')], edges: [] }
  const after = { nodes: [{ ...node('a', 120), style: { width: 500 }, data: { ...node('a').data, expandedSize: { width: 500, height: 400 } } }], edges: [] }
  const command = graphCommand(before, after)
  const live = { nodes: [{ ...after.nodes[0], data: { ...after.nodes[0].data, imageJob: { status: 'complete', finishedAt: 'now' } } }, node('new-output')], edges: [] }
  const undone = applyGraphCommand(live, command, 'undo')
  assert.equal(undone.nodes[0].position.x, 0)
  assert.equal(undone.nodes[0].data.imageJob.status, 'complete')
  assert.equal(undone.nodes.length, 2)
  const redone = applyGraphCommand(undone, command, 'redo')
  assert.equal(redone.nodes[0].position.x, 120)
  assert.equal(redone.nodes[0].style.width, 500)
})

test('删除与断线可一起恢复，重连可撤销', () => {
  const before = { nodes: [node('a'), node('b')], edges: [{ id: 'e', source: 'a', target: 'b' }] }
  const after = { nodes: [node('a')], edges: [] }
  assert.deepEqual(applyGraphCommand(after, graphCommand(before, after), 'undo'), before)
  const reconnected = { ...before, edges: [{ id: 'e', source: 'b', target: 'a' }] }
  assert.deepEqual(applyGraphCommand(reconnected, graphCommand(before, reconnected), 'undo'), before)
})

test('选中、测量、计时与后台生成不会产生撤销步骤，复制结果图会记录', () => {
  const before = { nodes: [node('a')], edges: [] }
  const output = { ...node('skill-job-0'), data: { kind: 'image', skillResult: { jobId: 'job' } } }
  const after = { nodes: [{ ...node('a'), selected: true, measured: { width: 200 }, data: { ...node('a').data, imageJob: { status: 'running' } } }, output], edges: [{ id: 'result-skill-job-0', source: 'a', target: output.id }] }
  assert.equal(graphCommand(before, after), null)
  assert.ok(graphCommand(after, { ...after, nodes: [...after.nodes, { ...output, id: 'user-copy' }] }))
})

test('技能参数撤销只还原用户配置，不还原后台 jobId 或状态', () => {
  const before = { nodes: [{ ...node('a'), data: { skillState: { supplement: '旧要求', jobId: 'old' } } }], edges: [] }
  const after = { nodes: [{ ...node('a'), data: { skillState: { supplement: '新要求', jobId: 'old' } } }], edges: [] }
  const live = { nodes: [{ ...after.nodes[0], data: { skillState: { supplement: '新要求', jobId: 'new', status: 'running' } } }], edges: [] }
  const result = applyGraphCommand(live, graphCommand(before, after), 'undo')
  assert.deepEqual(result.nodes[0].data.skillState, { supplement: '旧要求', jobId: 'new', status: 'running' })
})
