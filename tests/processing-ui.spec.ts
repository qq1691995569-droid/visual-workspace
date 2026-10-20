import {test,expect} from '@playwright/test'
import fs from 'node:fs'
test('本地抠图等待保留原图，提交完成前不查询任务',async({page})=>{
 let acknowledged=false,earlyPolls=0,polls=0
 await page.route('**/api/skills/canvas/tasks',async route=>{
  await new Promise(resolve=>setTimeout(resolve,1600))
  acknowledged=true
  await route.fulfill({json:{id:'local-cutout-test',status:'running',message:'本地抠图'}})
 })
 await page.route('**/api/skills/images/tasks/**',async route=>{
  polls++;if(!acknowledged)earlyPolls++
  await route.fulfill({json:{id:'local-cutout-test',status:'running',message:'本地抠图',images:[]}})
 })
 await page.goto('/')
 const src=fs.existsSync('artifacts/cutout-source.png')?'data:image/png;base64,'+fs.readFileSync('artifacts/cutout-source.png').toString('base64'):'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const project={format:'visproj',schemaVersion:1,name:'抠图交互测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[{id:'base',type:'card',position:{x:150,y:170},style:{width:260,height:260},data:{kind:'image',src,label:'原图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'processing.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.locator('[data-id="base"] .image-body').click()
 await page.getByRole('button',{name:'去背景',exact:true}).click()
 await expect(page.getByAltText('处理中的原图预览')).toBeVisible()
 await expect(page.getByText('本地处理 · 保留原图')).toBeVisible()
 await expect.poll(()=>acknowledged).toBe(true)
 await expect.poll(()=>polls).toBeGreaterThan(0)
 expect(earlyPolls).toBe(0)
 await expect(page.locator('.task-input-preview')).toHaveCSS('filter','none')
 await page.screenshot({path:'artifacts/local-cutout-loading.png'})
})
