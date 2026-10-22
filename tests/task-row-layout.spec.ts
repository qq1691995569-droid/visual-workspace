import {test,expect} from '@playwright/test'
test('task siblings arrange together through toolbar',async({page})=>{
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'任务并排验证',nodes:[{id:'base',type:'card',position:{x:40,y:220},style:{width:120,height:160},data:{kind:'image',label:'原图'}},...[0,1,2,3].map(i=>({id:'r-'+i,type:'card',position:{x:260+(i?200:0),y:100+i*150},style:{width:120,height:160},data:{kind:'image',label:'结果'+i,imageOutput:i===0,skillResult:{jobId:'batch',sourceNode:'r-0',review:{}}}}))],edges:[{id:'input',source:'base',target:'r-0'},...[1,2,3].map(i=>({id:'e'+i,source:'r-0',target:'r-'+i}))],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'batch.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
 for(const id of ['base','r-0','r-1','r-2','r-3']) await page.locator(`.react-flow__node[data-id="${id}"]`).click({modifiers:['Shift'],force:true})
 await page.getByRole('button',{name:'节点整理',exact:true}).click()
 const boxes=await Promise.all([0,1,2,3].map(i=>page.locator(`.react-flow__node[data-id="r-${i}"]`).boundingBox()))
 expect(new Set(boxes.map(b=>Math.round(b!.y))).size).toBe(1)
 await page.screenshot({path:'artifacts/task-row-layout.png'})
})
