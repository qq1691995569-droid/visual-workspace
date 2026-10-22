import test from 'node:test'
import assert from 'node:assert/strict'
import {arrangeCanvas,arrangeWorkflow,avoidExpandedOverlap,toolPlacement} from '../src/canvasArrangement.ts'
import {absolutePosition} from '../src/graphLayout.ts'
import {graphCommand,applyGraphCommand} from '../src/graphHistory.ts'
const node=(id,x,y,w=100,h=80)=>({id,position:{x,y},selected:true,style:{width:w,height:h},data:{kind:'image'}})
test('展开容器避开其他容器与图片，子节点相对位置和其他卡片不变',()=>{
 const group={...node('g',0,0,600,400),data:{kind:'group',collapsed:false}},other={...node('other',300,0,280,330),data:{kind:'group',collapsed:true}},child={...node('child',30,70),parentId:'g'}
 const next=avoidExpandedOverlap([group,other,child],'g'),g=next[0]
 assert.notDeepEqual(g.position,group.position);assert.deepEqual(next[1].position,other.position);assert.equal(next[2].parentId,child.parentId);assert.deepEqual(next[2].data,child.data)
 assert.ok(g.position.x+Number(g.style.width)+36<=300||g.position.x>=616||g.position.y+Number(g.style.height)+36<=0||g.position.y>=366)
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
 const next=arrangeCanvas([group,child,outside],'top');assert.equal(next[1].parentId,'g');assert.deepEqual(absolutePosition('c',next),{x:130,y:270});assert.equal(next[2].position.y,200)
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

test('节点整理按依赖分列、同层纵向排列，保留未选节点、尺寸、连接且可撤销',()=>{
 const nodes=[node('base',30,200),{...node('tool',300,100,180,400),data:{kind:'tool'}},...Array.from({length:9},(_,i)=>({...node('r'+i,700+(i%4)*200,500+Math.floor(i/4)*100),data:{kind:'image',skillResult:{sourceNode:'tool',jobId:i<5?'a':'b'}}})),{...node('other',5000,400),selected:false}]
 const edges=[{source:'base',target:'tool'},...nodes.filter(n=>n.id.startsWith('r')).map(n=>({source:'tool',target:n.id}))]
 const next=arrangeWorkflow(nodes,edges),get=id=>next.find(n=>n.id===id)
 assert.ok(get('base').position.x+100<get('tool').position.x)
 assert.ok(get('tool').position.x+180<get('r0').position.x)
 assert.equal(get('r0').position.y,get('r3').position.y)
 assert.ok(get('r3').position.x>get('r0').position.x)
 assert.equal(get('r4').position.y,get('r0').position.y)

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
 assert.equal(next[1].parentId,'g');assert.deepEqual(next[1].data,child.data)
})

test('分支按来源排列，父节点居中且重复整理位置稳定',()=>{
 const nodes=[node('root',0,0),node('a',200,0),node('b',200,400),node('a1',400,500),node('a2',400,600),node('b1',400,0),node('b2',600,0)]
 const edges=[['root','a'],['root','b'],['a','a1'],['a','a2'],['b','b1'],['b1','b2']].map(([source,target])=>({source,target}))
 const next=arrangeWorkflow(nodes,edges),get=id=>next.find(n=>n.id===id)
 const direction=Math.sign(get('a').position.y-get('b').position.y)
 assert.equal(Math.sign(get('a1').position.y-get('b1').position.y),direction)
 assert.equal(Math.sign(get('a2').position.y-get('b1').position.y),direction)
 assert.ok(Math.abs(get('a').position.y-(get('a1').position.y+get('a2').position.y)/2)<1)
 assert.deepEqual(arrangeWorkflow(next,edges),next)
})
test('inline first result and its siblings form one row before downstream tasks',()=>{
 const nodes=[node('base',0,0),...Array.from({length:4},(_,i)=>({...node('r-'+i,400+i*50,i*200),data:{kind:'image',imageOutput:i===0,skillResult:{jobId:'same-task',sourceNode:'r-0'}}})),{...node('next',1200,900),data:{kind:'image',skillResult:{jobId:'next-task',sourceNode:'r-2'}}}]
 const edges=[{source:'base',target:'r-0'},...[1,2,3].map(i=>({source:'r-0',target:'r-'+i})),{source:'r-2',target:'next'}]
 const next=arrangeWorkflow(nodes,edges),row=next.slice(1,5)
 assert.equal(new Set(row.map(n=>n.position.y)).size,1)
 for(let i=1;i<row.length;i++)assert.ok(row[i].position.x>=row[i-1].position.x+row[i-1].style.width+40)
 assert.ok(next.at(-1).position.x>=row.at(-1).position.x+row.at(-1).style.width)
 assert.deepEqual(arrangeWorkflow(next,edges),next)
})

test('收拢卡片并排移动，内部图片不参与且保留局部位置',()=>{
 const a={...node('ga',10,40,280,330),width:280,height:330,data:{kind:'group',collapsed:true}},b={...node('gb',10,500,280,330),width:280,height:330,data:{kind:'group',collapsed:true}}
 const child={...node('child',30,60),parentId:'gb'},nodes=[a,b,child]
 const next=arrangeCanvas(nodes,'row');assert.deepEqual(next[0].position,{x:10,y:40});assert.deepEqual(next[1].position,{x:326,y:40});assert.deepEqual(next[2],child)
 const command=graphCommand({nodes,edges:[]},{nodes:next,edges:[]});assert.deepEqual(applyGraphCommand({nodes:next,edges:[]},command,'undo').nodes,nodes)
})
