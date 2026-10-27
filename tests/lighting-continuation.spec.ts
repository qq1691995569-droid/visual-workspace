import {test, expect} from '@playwright/test'

test('光影沿用参数、部分结果刷新恢复且不重复提交', async ({page}) => {
  let posts = 0, complete = false
  const id = '11111111-1111-4111-8111-111111111111'
  const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  await page.route('**/api/skills/light/run', async route => {
    posts++
    expect(route.request().postDataJSON()).toMatchObject({base:src,lighting:{sunlight:true,temperature:25}})
    await route.fulfill({json:{id,status:'running',message:'模拟生成',createdAt:'2026-10-20T06:00:00Z'}})
  })
  await page.route(`**/api/skills/images/tasks/${id}`, route => route.fulfill({json:{
    id,status:complete?'complete':'running',message:complete?'已保存 2/2 张':'已保存 1/2 张',
    images:Array.from({length:complete?2:1},(_,index)=>({index,src,review:{}})),
  }}))
  await page.goto('/')
  const project = {format:'visproj',schemaVersion:1,name:'恢复测试',viewport:{x:0,y:0,zoom:1},edges:[],nodes:[
    {id:'result',type:'card',position:{x:350,y:120},style:{width:220,height:180},data:{kind:'image',label:'光影版本1',src,version:{revision:1,parentLabel:'原图'},skillResult:{sourceNode:'deleted',jobId:'prior',review:{}},iterationContext:{tool:'light',lighting:{sunlight:true,temperature:25},prompt:'保留构图',referenceIds:[],options:{model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:2}}}},
  ]}
  await page.locator('input[accept=".visproj"]').setInputFiles({name:'restore.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await page.locator('.image-body').click()
  await expect(page.getByRole('button',{name:'收起创作面板',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'沿用技能',exact:true}).click()
  await page.getByLabel('结果补充说明').fill('阴影柔和一点')
  await page.screenshot({path:'artifacts/unified-composer-preview.png'})
  await page.locator('.refine-submit').click()
  await expect(page.locator(`[data-id="skill-${id}-0"] .image-body`)).toBeVisible()
  await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
  complete = true
  await page.reload()
  await expect(page.locator(`[data-id="skill-${id}-1"] .image-body`)).toBeVisible()
  await expect(page.locator(`[data-id="skill-${id}-0"]`)).toHaveCount(1)
  expect(posts).toBe(1)
  await page.locator(`[data-id="skill-${id}-1"] .image-body`).click()
  await expect(page.getByRole('button',{name:'收起创作面板',exact:true})).toBeVisible()
  await expect(page.getByLabel('结果补充说明')).toContainText('阴影柔和一点')
  const downloaded=page.waitForEvent('download')
  await page.getByRole('button',{name:'导出项目',exact:true}).click()
  const stream=await (await downloaded).createReadStream()
  const chunks=[]
  for await(const chunk of stream!)chunks.push(chunk)
  const saved=JSON.parse(Buffer.concat(chunks).toString())
  const result=saved.nodes.find((n:{id:string})=>n.id==='skill-'+id+'-1')
  expect(result.data.version).toMatchObject({revision:2,parentLabel:'光影版本1'})
  expect(result.data.iterationContext.lighting).toEqual({sunlight:true,temperature:25})
})
