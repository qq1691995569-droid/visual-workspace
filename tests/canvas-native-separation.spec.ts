import {test,expect} from '@playwright/test'

const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('多图层结果按原图尺寸叠放，独立 PNG 可选择下载且刷新后保留',async({page})=>{
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
 const project={format:'visproj',schemaVersion:1,name:'分层测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图',dimensions:'1 × 1',imagePresentationVersion:1}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'native-layers.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'多图层',exact:true}).click()
 await expect.poll(()=>requests.length).toBe(1)
 await expect(page.locator('.layer-stack')).toBeVisible()
 await expect(page.locator('.layer-stack-heading')).toHaveText('多图层结果')
 await expect(page.locator('.layer-stack-heading button')).toHaveCount(1)
 await expect(page.locator('[data-id^="skill-"]')).toHaveCount(2)
 const base=await page.locator('[data-id="base"]').boundingBox()
 const background=await page.locator('[data-id^="skill-"]').nth(0).boundingBox()
 const object=await page.locator('[data-id^="skill-"]').nth(1).boundingBox()
 expect(background).not.toBeNull();expect(object).not.toBeNull();expect(base).not.toBeNull()
 expect(object!.x-background!.x).toBeCloseTo(24,0)
 expect(object!.y-background!.y).toBeCloseTo(48,0)
 expect(background!.width).toBeCloseTo(base!.width,0)
 expect(background!.height).toBeCloseTo(base!.height,0)
 expect(object!.width).toBeCloseTo(72,0)
 expect(object!.height).toBeCloseTo(96,0)
 expect(background!.x).toBeGreaterThan(base!.x+base!.width)
 await page.locator('[data-id^="skill-"]').nth(1).locator('.image-body').click()
 await expect(page.locator('[data-id^="skill-"]').nth(1).locator('.stack-layer.active')).toBeVisible()
 await page.getByRole('button',{name:'更多图层操作'}).click()
 await expect(page.getByRole('menu',{name:'更多图层操作'})).toBeVisible()
 await page.keyboard.press('Escape')
 const start={x:object!.x+object!.width/2,y:object!.y+object!.height/2}
 await page.mouse.move(start.x,start.y)
 await page.mouse.down()
 await page.mouse.move(start.x+35,start.y+25,{steps:6})
 await page.mouse.up()
 const moved=await page.locator('[data-id^="skill-"]').nth(1).boundingBox()
 const stillBackground=await page.locator('[data-id^="skill-"]').nth(0).boundingBox()
 expect(moved!.x-object!.x).toBeGreaterThan(20)
 expect(moved!.y-object!.y).toBeGreaterThan(12)
 expect(stillBackground!.x).toBeCloseTo(background!.x,0)
 expect(stillBackground!.y).toBeCloseTo(background!.y,0)
 await page.mouse.click(60,300)
 await page.getByRole('button',{name:'查看分层图片'}).click()
 await expect(page.getByRole('group',{name:'独立 PNG 图层'})).toContainText('盆栽')
 await page.getByRole('group',{name:'独立 PNG 图层'}).getByRole('button',{name:/盆栽/}).first().click()
 await expect(page.locator('[data-id^="skill-"]').nth(1).locator('.stack-layer.active')).toBeVisible()
 await expect(page.locator('[data-id^="skill-"]').nth(1)).toHaveCSS('pointer-events','auto')
 const download=page.waitForEvent('download')
 await page.getByRole('button',{name:'下载 盆栽'}).click()
 expect((await download).suggestedFilename()).toBe('盆栽.png')
 await page.reload()
 await expect(page.locator('.layer-stack')).toBeVisible()
 await expect(page.locator('[data-id^="skill-"]')).toHaveCount(2)
 const persisted=await page.locator('[data-id^="skill-"]').nth(1).boundingBox()
 expect(persisted!.x).toBeCloseTo(moved!.x,0)
 expect(persisted!.y).toBeCloseTo(moved!.y,0)
 await page.getByRole('button',{name:'查看分层图片'}).click()
 await page.getByRole('button',{name:'分开到画布'}).click()
 const freeBackground=await page.locator('[data-id^="skill-"]').nth(0).boundingBox()
 const freeObject=await page.locator('[data-id^="skill-"]').nth(1).boundingBox()
 const from={x:freeObject!.x+freeObject!.width/2,y:freeObject!.y+freeObject!.height/2}
 const to={x:freeBackground!.x+freeBackground!.width/2,y:freeBackground!.y+freeBackground!.height/2}
 await page.mouse.move(from.x,from.y)
 await page.mouse.down()
 await page.mouse.move(to.x,to.y,{steps:10})
 await page.mouse.up()
 const overlaid=await page.locator('[data-id^="skill-"]').nth(1).boundingBox()
 const fixed=await page.locator('[data-id^="skill-"]').nth(0).boundingBox()
 expect(fixed!.x).toBeCloseTo(freeBackground!.x,0)
 expect(fixed!.y).toBeCloseTo(freeBackground!.y,0)
 expect(overlaid!.x).toBeGreaterThan(fixed!.x)
 expect(overlaid!.x).toBeLessThan(fixed!.x+fixed!.width)
})

test('旧版横排图层打开后在原位置恢复为叠放视图',async({page})=>{
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'旧图层',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[
  {id:'base',type:'card',position:{x:100,y:150},style:{width:260,height:260},data:{kind:'image',src,label:'原图',dimensions:'1 × 1',imagePresentationVersion:1}},
  {id:'group',type:'card',position:{x:430,y:150},style:{width:740,height:340},data:{kind:'group',label:'多图层 · 原图坐标透明图层',expandedSize:{width:740,height:340}}},
  ...['背景','椅子'].map((label,index)=>({id:`layer-${index}`,type:'card',parentId:'group',position:{x:20+index*360,y:50},style:{width:340,height:340},data:{kind:'image',src,label,dimensions:'1 × 1',skillResult:{jobId:'test',sourceNode:'group',review:{layer:label}},version:{parentId:'base'}}})),
 ]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'old-layers.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.locator('.layer-stack')).toBeVisible()
 const a=await page.locator('[data-id="layer-0"]').boundingBox(),b=await page.locator('[data-id="layer-1"]').boundingBox()
 expect(a).not.toBeNull();expect(b).not.toBeNull()
 expect(a!.x).toBeCloseTo(b!.x,0);expect(a!.y).toBeCloseTo(b!.y,0)
 expect(a!.width).toBeCloseTo(260,0)
 await page.getByRole('button',{name:'切换深色主题'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.getByRole('button',{name:'查看分层图片'}).click()
 await expect(page.getByRole('group',{name:'独立 PNG 图层'})).toBeVisible()
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
 await expect(page.getByText('生成失败')).toBeVisible()
 await expect(page.locator('.canvas-task-notice > p')).toContainText('请重试或检查提示词')
 const compactWidth=(await page.locator('.canvas-task-notice').boundingBox())!.width
 expect(compactWidth).toBeLessThanOrEqual(190)
 await expect(page.locator('.canvas-task-notice > p')).toHaveCSS('white-space','nowrap')
 await expect(page.getByRole('button',{name:'查询原任务'})).toHaveCount(0)
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.locator('.canvas-task-notice summary').click()
 await expect(page.locator('.canvas-task-notice details')).toHaveAttribute('open','')
 expect((await page.locator('.canvas-task-notice').boundingBox())!.width).toBeGreaterThan(compactWidth)
 await page.locator('.canvas-task-notice summary').click()
 await expect(page.locator('.canvas-task-notice details')).not.toHaveAttribute('open','')
 await page.getByRole('button',{name:'切换浅色主题'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})

test('视觉分析格式异常显示可读提示且不显示无效恢复按钮',async({page})=>{
 await page.route('**/api/skills/canvas/tasks',async route=>{
  const body=route.request().postDataJSON()
  await route.fulfill({json:{id:body.requestId,status:'analyzing',message:'正在识别对象'}})
 })
 await page.route('**/api/skills/images/tasks/*',async route=>{
  const id=route.request().url().split('/').at(-1)
  await route.fulfill({json:{id,status:'paused',message:'Unexpected token \'根\', "根据\\n您的要求"... is not valid JSON',images:[]}})
 })
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'视觉格式异常测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'vision-format-error.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'多图层',exact:true}).click()
 await expect(page.getByText('视觉分析未完成')).toBeVisible()
 await expect(page.locator('.canvas-task-notice > p')).toContainText('未按要求返回结构化结果')
 await expect(page.locator('.canvas-task-notice')).not.toContainText('Unexpected token')
 await expect(page.getByRole('button',{name:'查询原任务'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'停止等待'})).toHaveCount(0)
})

test('多图层处理中复用统一生成状态卡片',async({page})=>{
 const createdAt=new Date(Date.now()-40_000).toISOString()
 await page.route('**/api/skills/canvas/tasks',async route=>{
  const body=route.request().postDataJSON()
  await route.fulfill({json:{id:body.requestId,status:'analyzing',message:'正在识别对象',createdAt}})
 })
 await page.route('**/api/skills/images/tasks/*',async route=>{
  const id=route.request().url().split('/').at(-1)
  await route.fulfill({json:{id,status:'running',message:'正在拆分图层',createdAt}})
 })
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'进度测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:300,y:240},style:{width:240,height:240},data:{kind:'image',src,label:'底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'layer-progress.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'多图层',exact:true}).click()
 await expect(page.getByRole('progressbar')).toHaveCount(0)
 await expect(page.locator('.processing-status .generation-progress')).toHaveText(/%$/)
 await expect(page.locator('.processing-status .generation-primary')).toHaveText('正在拆分图层')
 await expect(page.locator('.task-activity-track')).toHaveCount(0)
 await page.getByRole('button',{name:'切换深色主题'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await expect(page.locator('.processing-status .generation-primary')).toHaveText('正在拆分图层')
})
