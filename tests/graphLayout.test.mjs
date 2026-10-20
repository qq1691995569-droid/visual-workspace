import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absolutePosition, groupBounds, detachGroup, nextBatchPosition, fitGroupNodes } from '../src/graphLayout.ts'

test('收拢组不会被远处子节点撑开，修复旧尺寸且保留展开布局', () => {
  const original = { width: 1800, height: 1000 }
  const nodes = [
    { id: 'g', position: { x: 0, y: 0 }, style: original, width: 1800, height: 1000, data: { kind: 'group', collapsed: true, expandedSize: original } },
    { id: 'photo', parentId: 'g', position: { x: 1450, y: 700 }, style: { width: 900, height: 600 }, data: { kind: 'image' } },
  ]
  const folded = fitGroupNodes(nodes)
  assert.deepEqual(folded[0].style, { width: 280, height: 330 })
  assert.equal(folded[0].width, 280)
  assert.equal(folded[1], nodes[1])
  assert.equal(folded[0].data.expandedSize, original)
  assert.equal(fitGroupNodes(folded), folded)
  const expanded = fitGroupNodes([{ ...folded[0], style: original, data: { ...folded[0].data, collapsed: false } }, folded[1]])
  assert.equal(expanded[0].style.width, 2378)
})

test('生成结果靠近所属节点，局部避让，不受远方图片影响', () => {
  const source={id:'tool',position:{x:0,y:80},style:{width:350,height:420},data:{kind:'tool'}}
  const far={id:'far',position:{x:9000,y:80},style:{width:340,height:240},data:{kind:'image'}}
  assert.deepEqual(nextBatchPosition('tool',[source,far]),{x:450,y:80})
  const old=Array.from({length:4},(_,i)=>({id:'old'+i,position:{x:450+i*380,y:80},style:{width:340,height:240},data:{kind:'image'}}))
  const nodes=[source,...old,far],before=structuredClone(nodes)
  assert.deepEqual(nextBatchPosition('tool',nodes),{x:450,y:360})
  assert.deepEqual(nodes,before)
  const group={id:'g',position:{x:100,y:200},style:{width:2000,height:800},data:{kind:'group'}}
  assert.deepEqual(nextBatchPosition('tool',[group,{...source,parentId:'g'},far]),{x:550,y:280})
  const obstacle={id:'near',position:{x:900,y:80},style:{width:300,height:240},data:{kind:'image'}}
  assert.deepEqual(nextBatchPosition('tool',[source,obstacle],{count:1,height:200}),{x:450,y:80})
  assert.notEqual(nextBatchPosition('tool',[source,obstacle],{count:4,height:200}).y,80)
})

const nodes = [
  { id: 'a', position: { x: -80, y: 60 }, measured: { width: 340, height: 300 }, data: { kind: 'image' } },
  { id: 'b', position: { x: 450, y: 120 }, measured: { width: 360, height: 420 }, data: { kind: 'tool' } },
]
test('创建分组后，移动容器及解除分组保持世界坐标', () => {
  const bounds = groupBounds(nodes)
  const group = { id: 'g', position: { x: bounds.x, y: bounds.y }, data: { kind: 'group' } }
  const grouped = [group, ...nodes.map(n => ({ ...n, parentId: 'g', extent: 'parent', expandParent: true, position: { x: n.position.x - bounds.x, y: n.position.y - bounds.y } }))]
  assert.deepEqual(absolutePosition('a', grouped), nodes[0].position)
  group.position.x += 100; group.position.y += 50
  const detached = detachGroup('g', grouped)
  assert.deepEqual(detached[0].position, { x: 20, y: 110 })
  assert.deepEqual(detached[1].position, { x: 550, y: 170 })
  assert.ok(detached.every(n => !n.parentId && !n.extent && !n.expandParent))
})
test('分组边界覆盖节点及标题空间，禁止嵌套或重复分组', () => {
  const bounds = groupBounds(nodes)
  assert.equal(bounds.x, -108)
  assert.equal(bounds.y, -4)
  assert.equal(bounds.width, 946)
  assert.equal(bounds.height, 572)
  assert.throws(() => groupBounds([nodes[0]]))
  assert.throws(() => groupBounds([nodes[0], { ...nodes[1], parentId: 'g' }]))
})
test('分组层级异常不会进入无限循环', () => {
  assert.throws(() => absolutePosition('a', [{ ...nodes[0], parentId: 'b' }, { ...nodes[1], parentId: 'a' }]))
})
