import test from 'node:test'
import assert from 'node:assert/strict'
import {arrangeCanvas,arrangeWorkflow,avoidExpandedOverlap,toolPlacement} from '../src/canvasArrangement.ts'
import {graphCommand,applyGraphCommand} from '../src/graphHistory.ts'
const node=(id,x,y,w=100,h=80)=>({id,position:{x,y},selected:true,style:{width:w,height:h},data:{kind:'image'}})
test('展开容器避开其他容器与图片，子节点相对位置和其他卡片不变',()=>{
 const group={...node('g',0,0,600,400),data:{kind:'group',collapsed:false}},other={...node('other',300,0,280,330),data:{kind:'group',collapsed:true}},child={...node('child',30,70),parentId:'g'}
 const next=avoidExpandedOverlap([group,other,child],'g'),g=next[0]
 assert.notDeepEqual(g.position,group.position);assert.deepEqual(next[1].position,other.position);assert.equal(next[2],child)
 assert.ok(g.position.x+600+36<=300||g.position.x>=616||g.position.y+400+36<=0||g.position.y>=366)
 assert.deepEqual(avoidExpandedOverlap(next,'g'),next)
})
test('对齐考虑不同尺寸，等距与网格保持间隔，整理操作可撤销',()=>{
 const nodes=[node('a',20,40),node('b',250,100,200,60),node('c',500,200,80,100)]
 const right=arrangeCanvas(nodes,'right');assert.deepEqual(right.map(n=>n.position.x+Number(n.style.width)),[580,580,580])
 const row=arrangeCanvas(nodes,'horizontal'),gap=row[1].position.x-row[0].position.x-100;assert.equal(row[2].position.x-row[1].position.x-200,gap)
 const grid=arrangeCanvas(nodes,'grid');assert.equal(grid[0].position.y,grid[1].position.y);assert.ok(grid[2].position.y>=grid[0].position.y+100+36)
 const command=graphCommand({nodes,edges:[]},{nodes:right,edges:[]});assert.deepEqual(applyGraphCommand({nodes:right,edges:[]},command,'undo').nodes,nodes)
})
test('选中组与子节点时只整理组，分组内单选节点使用世界坐标对齐',()=>{
 const group={...node('g',100,200,400,300),data:{kind:'group'}},child={...node('c',30,70),parentId:'g'},outside=node('x',700,400)
 const next=arrangeCanvas([group,child,outside],'top');assert.equal(next[1],child);assert.equal(next[2].position.y,200)
 const inner=arrangeCanvas([{...group,selected:false},child,outside],'top');assert.equal(inner[2].position.y,270)
})

test('拖线松手位置优先于源图与远处结果，未指定位置时才放在源图旁',()=>{
 const nodes=[node('a',100,200),node('far',90000,0)]
 assert.deepEqual(toolPlacement('a',nodes,{x:260,y:320},{x:0,y:0}),{x:260,y:320})
 assert.deepEqual(toolPlacement('a',nodes,undefined,{x:0,y:0}),{x:310,y:200})
})

test('并排对齐仅移动选中图片，按从左到右顺序顶对齐且固定间距，可撤销',()=>{
 const nodes=[node('b',500,100,200,60),node('a',20,400),node('c',500,600,80,100),{...node('tool',0,0),data:{kind:'tool'}},{...node('unselected',900,800),selected:false}]
 const next=arrangeCanvas(nodes,'row')
 assert.deepEqual(next.slice(0,3).map(n=>n.position),[{x:156,y:100},{x:20,y:100},{x:392,y:100}])
 assert.equal(next[3],nodes[3]);assert.equal(next[4],nodes[4])
 assert.deepEqual(next.map(n=>n.style),nodes.map(n=>n.style))
 const command=graphCommand({nodes,edges:[]},{nodes:next,edges:[]})
 assert.deepEqual(applyGraphCommand({nodes:next,edges:[]},command,'undo').nodes,nodes)
})

test('节点整理按依赖分列、每批最多四张并排，保留未选节点、尺寸、连接且可撤销',()=>{
 const nodes=[node('base',30,200),{...node('tool',300,100,180,400),data:{kind:'tool'}},...Array.from({length:9},(_,i)=>({...node('r'+i,700+(i%4)*200,500+Math.floor(i/4)*100),data:{kind:'image',skillResult:{sourceNode:'tool',jobId:i<5?'a':'b'}}})),{...node('other',5000,400),selected:false}]
 const edges=[{source:'base',target:'tool'},...nodes.filter(n=>n.id.startsWith('r')).map(n=>({source:'tool',target:n.id}))]
 const next=arrangeWorkflow(nodes,edges),get=id=>next.find(n=>n.id===id)
 assert.ok(get('base').position.x+100<get('tool').position.x)
 assert.ok(get('tool').position.x+180<get('r0').position.x)
 assert.equal(get('r0').position.y,get('r3').position.y)
 assert.ok(get('r4').position.y>get('r0').position.y)
 assert.ok(get('r5').position.y>get('r4').position.y)
 assert.equal(next.at(-1),nodes.at(-1));assert.deepEqual(next.map(n=>n.style),nodes.map(n=>n.style))
 for(let i=0;i<next.length-1;i++)for(let j=i+1;j<next.length-1;j++){const a=next[i],b=next[j];assert.ok(a.position.x+a.style.width<=b.position.x||b.position.x+b.style.width<=a.position.x||a.position.y+a.style.height<=b.position.y||b.position.y+b.style.height<=a.position.y)}
 const command=graphCommand({nodes,edges},{nodes:next,edges});assert.deepEqual(applyGraphCommand({nodes:next,edges},command,'undo'),{nodes,edges})
 assert.deepEqual(arrangeWorkflow(next,edges),next)
})
test('节点整理可处理环路、无连接节点和选中父子组',()=>{
 const nodes=[node('a',0,0),node('b',50,50),node('c',100,100)]
 assert.equal(arrangeWorkflow(nodes,[{source:'a',target:'b'},{source:'b',target:'a'}]).length,3)
 const group={...node('g',0,0,500,400),data:{kind:'group'}},child={...node('child',30,70),parentId:'g'}
 const next=arrangeWorkflow([group,child,node('outside',800,100)],[])
 assert.equal(next[1],child)
})
