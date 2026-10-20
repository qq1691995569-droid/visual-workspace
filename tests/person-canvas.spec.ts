import {test,expect} from '@playwright/test'
test('人物提取在画布生成两张，刷新恢复并且不重复提交',async({page})=>{
  const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  let id='',posts=0,complete=false
  await page.route('**/api/skills/assets/person/tasks',async route=>{posts++;id=route.request().postDataJSON().requestId;await route.fulfill({json:{id,status:'running'}})})
  await page.route('**/api/skills/images/tasks/*',route=>route.fulfill({json:{id,status:complete?'complete':'running',message:'人物生成',...(complete?{asset:{id:'person',kind:'person',name:'人物A',image:src,prompt:'外观',tags:[],notes:'',views:[{label:'全身照',image:src},{label:'综合细节图',image:src}]}}:{})}}))
  await page.route('**/api/skills/assets',route=>route.fulfill({json:{assets:[]}}))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles({name:'person.png',mimeType:'image/png',buffer:Buffer.from(src.split(',')[1],'base64')})
  await page.locator('.image-body').click()
  await page.getByRole('button',{name:'提取资产',exact:true}).click()
  await page.getByRole('button',{name:'AI 人物',exact:true}).click()
  await page.getByRole('button',{name:'提取到画布',exact:true}).click()
  await expect.poll(()=>posts).toBe(1)
  await expect(page.locator('[data-id^="extract-"]')).toHaveCount(2)
  await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
  complete=true
  await page.reload()
  await expect(page.locator('[data-id^="extract-"] .image-body')).toHaveCount(2)
  await expect(page.locator('[data-id^="extract-"]')).toHaveCount(2)
  expect(posts).toBe(1)
})
