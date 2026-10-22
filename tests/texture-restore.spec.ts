import {test,expect} from '@playwright/test'
test('one-click restoration hides intermediate line controls',async({page})=>{
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 let submissions=0
 await page.route('**/api/skills/texture-restore/**',async route=>{if(route.request().method()==='POST'){submissions++;expect(route.request().postDataJSON().automatic).toBe(true)}await route.fulfill({json:{id:'22222222-2222-4222-8222-222222222222',status:'line',message:'正在生成构图线稿'}})})
 await page.route('**/api/skills/images/tasks/*',async route=>route.fulfill({json:{id:route.request().url().split('/').at(-1),status:'running',message:'正在准备重绘图片…',images:[]}}))
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'重绘验证',nodes:[{id:'texture',type:'card',position:{x:350,y:110},style:{width:370},data:{kind:'tool',label:'图片重绘',tool:'texture-restore',textureState:{base:image,reference:image}}}],edges:[],viewport:{x:0,y:0,zoom:.85}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'restore.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('button',{name:'开始重绘'})).toBeEnabled()
 await expect(page.getByText('准备线稿',{exact:true})).toHaveCount(0)
 await expect(page.getByLabel('已检查线稿构图与物体轮廓')).toHaveCount(0)
 await page.screenshot({path:'artifacts/texture-auto-light.png'})
 await page.getByRole('button',{name:'切换深色主题'}).click()
 await page.screenshot({path:'artifacts/texture-auto-dark.png'})
 await page.getByRole('button',{name:'开始重绘'}).click()
 await expect(page.getByRole('button',{name:'重绘处理中…'})).toBeDisabled();expect(submissions).toBe(1)
 await page.locator('.react-flow__controls-fitview').click()
 await expect(page.locator('.react-flow__node .result-placeholder')).toHaveCount(4)
 await page.screenshot({path:'artifacts/texture-result-placeholders.png'})
})
