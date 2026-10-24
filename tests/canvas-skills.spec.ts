import {test,expect} from '@playwright/test'
const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
test('独立技能入口、蒙版提交、分层回画布及刷新恢复',async({page})=>{
 const requests:any[]=[]
 await page.route('**/api/skills/canvas/tasks',async route=>{
  const body=route.request().postDataJSON();requests.push(body)
  await route.fulfill({json:{id:body.requestId,status:'running',message:'测试处理'}})
 })
 await page.route('**/api/skills/images/tasks/*',async route=>{
  const id=route.request().url().split('/').at(-1),request=requests.find(r=>r.requestId===id)
  const layers=request?.operation==='separate'
  await route.fulfill({json:{id,status:'complete',message:'测试完成',images:layers?[{index:0,src,review:{layer:'背景（遮挡区域 AI 补全）'}},{index:1,src,review:{layer:'人物'}}]:[{index:0,src,review:{}}]}})
 })
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'技能测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'skills.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 for(const [label,operation] of [['去背景','background'],['变清晰','upscale'],['消除','erase'],['多图层','separate']]){
  await page.locator('[data-id="base"] .image-body').click()
  await page.getByRole('button',{name:label,exact:true}).click()
  if(operation==='erase'){
   const mask=page.locator('.inline-mask'),box=await mask.boundingBox()
   await page.mouse.move(box!.x+90,box!.y+90);await page.mouse.down();await page.mouse.move(box!.x+140,box!.y+100);await page.mouse.up()
   await page.getByRole('toolbar',{name:'消除操作'}).getByRole('button',{name:'确认',exact:true}).click()
  }
  await expect.poll(()=>requests.at(-1)?.operation).toBe(operation)
  expect(requests.at(-1).options.count).toBe(1);expect(requests.at(-1).base).toBe(src)
  if(operation==='erase')expect(requests.at(-1).parameters.maskStrokes[0].length).toBeGreaterThan(1)
  if(operation==='separate')await expect(page.getByRole('textbox',{name:'工作流分组名称'})).toHaveValue('多图层 · 原图坐标透明图层')
  else await expect(page.locator('.generation-overlay')).toHaveCount(0)
 }
 const count=await page.locator('.react-flow__node').count()
 await page.waitForTimeout(700);await page.reload()
 await expect(page.getByRole('textbox',{name:'工作流分组名称'})).toHaveValue('多图层 · 原图坐标透明图层')
 await expect(page.locator('.react-flow__node')).toHaveCount(count)
 expect(requests.length).toBe(4)
})
