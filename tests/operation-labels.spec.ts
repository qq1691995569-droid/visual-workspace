import {test,expect} from '@playwright/test'

test('task labels retain their operation in both themes and failure states',async({page})=>{
 await page.route('**/api/skills/images/tasks/**',r=>r.fulfill({json:{id:r.request().url().split('/').at(-1),status:Number(r.request().url().split('-').at(-1))%2?'failed':'running',images:[],createdAt:new Date().toISOString()}}))
 await page.setViewportSize({width:1500,height:1000})
 await page.goto('/')
 const cases=[['style','风格转换'],['material','材质优化'],['light','光影优化'],['furniture','模型替换'],['texture-restore','图片重绘'],['platform-upscale','图像放大'],['tone-skill','场景调色'],['redraw','图像']]
 const nodes=cases.map(([tool,name],i)=>({id:'label-'+i,type:'card',position:{x:100+i%4*340,y:170+Math.floor(i/4)*350},style:{width:300,height:260},data:{kind:'image',label:name,tool,pendingResult:{jobId:'mock-'+i,sourceNode:'label-'+i,index:0,endpoint:'images'},imageJob:{id:'mock-'+i,status:i%2?'failed':'running',message:i%2?'生成失败':'处理中',createdAt:new Date().toISOString()}}}))
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'labels.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'任务名称',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'切换深色主题'}).click()
  for(let i=0;i<cases.length;i++){
   await expect(page.locator('[data-id="label-'+i+'"] .image-origin-label>span')).toHaveText(cases[i][1])
   await expect(page.locator('[data-id="label-'+i+'"] .image-origin-label')).toHaveAttribute('data-status',i%2?'失败':'生成中')
  }
  await page.screenshot({path:'test-results/operation-labels-'+theme+'.png'})
 }
})
