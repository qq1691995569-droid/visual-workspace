import {test, expect} from '@playwright/test'

test('连线传输效果随任务状态停止并尊重减少动画设置',async({page})=>{
  page.on('dialog', dialog=>dialog.accept())
  await page.goto('/')
  const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  const project={format:'visproj',schemaVersion:1,name:'连线动画',viewport:{x:0,y:0,zoom:1},nodes:[
    {id:'a',type:'card',position:{x:300,y:200},style:{width:180,height:150},data:{kind:'image',label:'来源',src,skillState:{status:'running'}}},
    {id:'b',type:'card',position:{x:800,y:250},style:{width:180,height:150},data:{kind:'image',label:'结果',src}},
  ],edges:[{id:'ab',source:'a',target:'b'}]}
  const load=async()=>{await page.locator('input[accept=".visproj"]').setInputFiles({name:'flow.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('[data-id="a"] .image-body').click()}
  await load()
  const stream=page.locator('.edge-data-stream')
  await expect(stream).toHaveClass(/is-transmitting/)
  await expect(stream).toHaveCSS('animation-play-state','running')
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(stream).toHaveCSS('animation-name','none')
  await page.emulateMedia({reducedMotion:'no-preference'})
  project.nodes[0].data.skillState={status:'complete'}
  await load()
  await expect(stream).not.toHaveClass(/is-transmitting/)
  await expect(stream).toHaveCSS('animation-play-state','paused')
})

