import {test,expect} from '@playwright/test'
test('completed image status appears only on selection and edges never animate on hover',async({page})=>{
 await page.goto('/')
 const src=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d')!;x.fillStyle='#9a8568';x.fillRect(0,0,600,800);return c.toDataURL('image/png')})
 const project={format:'visproj',schemaVersion:1,name:'图片状态验证',nodes:[{id:'a',type:'card',position:{x:180,y:220},style:{width:240,height:320},data:{kind:'image',label:'原图',src,imagePresentationVersion:1}},{id:'b',type:'card',position:{x:650,y:220},style:{width:240,height:320},data:{kind:'image',label:'放大结果',src,generatedSkill:'图像放大',imagePresentationVersion:1}}],edges:[{id:'ab',source:'a',target:'b'}],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'status.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
 await page.mouse.click(1100,700)
 await expect(page.locator('.image-origin-label')).toHaveCount(0)
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'切换深色主题'}).click()
  await page.locator('.react-flow__node[data-id="b"] .image-body').click()
  await expect(page.locator('.image-origin-label')).toContainText('图像放大已完成')
  await expect(page.locator('.edge-data-stream')).toHaveCount(0)
  await page.mouse.move(535,380)
  await expect(page.locator('.edge-data-stream')).toHaveCount(0)
  const label=await page.locator('.image-origin-label').boundingBox(),toolbar=await page.getByRole('toolbar',{name:'图片快捷修改'}).boundingBox()
  expect(toolbar!.y+toolbar!.height).toBeLessThan(label!.y)
  const picture=await page.locator('.react-flow__node[data-id="b"] .card.image').boundingBox()
  expect(label!.y).toBeGreaterThan(picture!.y)
  expect(label!.x).toBeGreaterThanOrEqual(picture!.x)
  expect(label!.x+label!.width).toBeLessThanOrEqual(picture!.x+picture!.width)
  expect(label!.y+label!.height).toBeLessThan(picture!.y+picture!.height)
  await page.screenshot({path:`artifacts/image-status-${theme}.png`})
  await page.mouse.click(1100,700)
  await expect(page.locator('.image-origin-label')).toHaveCount(0)
 }
})
