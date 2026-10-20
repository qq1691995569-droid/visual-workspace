import {test,expect} from '@playwright/test'
const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
test('无会话恢复缓存时，含已暂停人物提取的整张画布可连续刷新',{timeout:60000},async({page})=>{
 await page.goto('/')
 await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
 const task={id:'12345678-1234-1234-1234-123456789abc',kind:'person',index:0,status:'paused',message:'请指定人物',createdAt:new Date().toISOString()}
 const project={format:'visproj',schemaVersion:1,name:'人物记录恢复回归',viewport:{x:0,y:0,zoom:1},draft:{prompt:'保留此草稿',referenceIds:['base']},nodes:[{id:'base',type:'card',position:{x:150,y:150},data:{kind:'image',label:'原始图片',src},style:{width:180,height:180}},{id:'person',type:'card',position:{x:450,y:150},data:{kind:'image',label:'人物提取',extraction:task},style:{width:180,height:180}}],edges:[{id:'relation',source:'base',target:'person'}]}
 await page.evaluate(async value=>{const url='/src/canvasStorage.ts';const store=await import(url);await store.writeCanvasProject(value);sessionStorage.clear()},project)
 for(let i=0;i<2;i++){
  await page.reload()
  await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
  await expect(page.locator('[data-id="base"] .image-body')).toBeVisible()
  await expect(page.locator('[data-id="person"]')).toBeVisible()
  await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
  const saved=await page.evaluate(async()=>{const url='/src/canvasStorage.ts';return (await import(url)).readCanvasProject()})
  expect(saved.nodes.map((n:any)=>n.id)).toEqual(['base','person']);expect(saved.edges).toHaveLength(1);expect(saved.draft.prompt).toBe('保留此草稿')
 }
})
test('读取异常明确提示并保留原记录，不显示空白新项目',{timeout:60000},async({page})=>{
 await page.goto('/');await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
 const invalid={format:'visproj',schemaVersion:999,name:'不可覆盖的原记录',nodes:[],edges:[]}
 await page.evaluate(async value=>{const url='/src/canvasStorage.ts';await (await import(url)).writeCanvasProject(value)},invalid)
 await page.reload()
 await expect(page.getByRole('heading',{name:'画布读取未完成'})).toBeVisible()
 await expect(page.getByRole('heading',{name:'把想象，连接成画面。'})).toHaveCount(0)
 const saved=await page.evaluate(async()=>{const url='/src/canvasStorage.ts';return (await import(url)).readCanvasProject()})
 expect(saved).toEqual(invalid)
})
