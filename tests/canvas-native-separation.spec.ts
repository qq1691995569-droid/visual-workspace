import {test,expect} from '@playwright/test'

const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('多图层结果按独立节点导入并在刷新后保留',async({page})=>{
 const requests:any[]=[]
 await page.route('**/api/skills/canvas/tasks',async route=>{
  const body=route.request().postDataJSON();requests.push(body)
  await route.fulfill({json:{id:body.requestId,status:'running',message:'测试处理'}})
 })
 await page.route('**/api/skills/images/tasks/*',async route=>{
  const id=route.request().url().split('/').at(-1)
  await route.fulfill({json:{id,status:'complete',message:'测试完成',images:[{index:0,src,review:{layer:'背景'}},{index:1,src,review:{layer:'盆栽',alphaValidated:'true',boundingBox:'100,200,400,600'}}]}})
 })
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'分层测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'native-layers.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'多图层',exact:true}).click()
 await expect.poll(()=>requests.length).toBe(1)
 await expect(page.getByRole('textbox',{name:'工作流分组名称'})).toHaveValue('多图层 · 原图坐标透明图层')
 await expect(page.locator('[data-id^="skill-"]')).toHaveCount(2)
 await page.reload()
 await expect(page.getByRole('textbox',{name:'工作流分组名称'})).toHaveValue('多图层 · 原图坐标透明图层')
 await expect(page.locator('[data-id^="skill-"]')).toHaveCount(2)
})

test('DREO 明确拒绝拆分时显示可读提示且不提供无效的原任务查询',async({page})=>{
 await page.route('**/api/skills/canvas/tasks',async route=>{
  const body=route.request().postDataJSON()
  await route.fulfill({json:{id:body.requestId,status:'analyzing',message:'正在准备'}})
 })
 await page.route('**/api/skills/images/tasks/*',async route=>{
  const id=route.request().url().split('/').at(-1)
  await route.fulfill({json:{id,status:'submit_error',message:'DREO 拒绝了原生图层拆分请求（HTTP 422），未返回任务号。',images:[]}})
 })
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'分层拒绝测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'rejected-layers.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.getByRole('button',{name:'切换深色主题'}).click()
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'多图层',exact:true}).click()
 await expect(page.getByText('提交未被受理')).toBeVisible()
 await expect(page.locator('.canvas-task-notice > p')).toContainText('DREO 拒绝了原生图层拆分请求')
 await expect(page.getByRole('button',{name:'查询原任务'})).toHaveCount(0)
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
})
