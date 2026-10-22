import {test,expect} from '@playwright/test'
test('folded collections hide ports and links and restore child links',async({page})=>{
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'收纳连接验证',nodes:[{id:'g',type:'card',position:{x:170,y:180},style:{width:280,height:330},data:{kind:'group',label:'收纳卡片',collapsed:true,expandedSize:{width:350,height:400}}},{id:'a',type:'card',parentId:'g',position:{x:30,y:70},style:{width:200,height:200},data:{kind:'image',label:'原图'}},{id:'b',type:'card',position:{x:650,y:200},data:{kind:'tool',tool:'style',label:'风格转换'}}],edges:[{id:'ab',source:'a',target:'b',targetHandle:'base'}],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'collection.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
 const group=page.locator('.react-flow__node[data-id="g"]')
 await expect(group.locator('.react-flow__handle')).toHaveCount(0)
 await expect(page.locator('.react-flow__edge')).toHaveCount(0)
 await page.screenshot({path:'artifacts/collection-folded.png'})
 await group.getByRole('button',{name:'展开卡片组'}).click()
 await expect(page.locator('.react-flow__edge')).toHaveCount(1)
 await group.getByRole('button',{name:'收拢卡片组'}).click()
 await expect(page.locator('.react-flow__edge')).toHaveCount(0)
})
