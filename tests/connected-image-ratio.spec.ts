import {test,expect} from '@playwright/test'

test('connecting an image to an existing generator matches the source ratio',async({page})=>{
 await page.goto('/')
 const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const nodes=[{id:'input',type:'card',position:{x:300,y:150},style:{width:180,height:240},data:{kind:'image',src,label:'竖图',dimensions:'1500 × 2000'}},{id:'generator',type:'card',position:{x:700,y:150},style:{width:240,height:240},data:{kind:'tool',tool:'redraw',canvasImageNode:true,label:'图像',generation:{ratio:'1:1',resolution:'2K',count:1}}}]
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'ratio.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'比例测试',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
 const source=page.locator('[data-id="input"] .source'),target=page.locator('[data-id="generator"] .target')
 await expect(source).toBeVisible();await expect(target).toBeVisible()
 const a=(await source.boundingBox())!,b=(await target.boundingBox())!
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up()
 await expect(page.locator('.dock-status')).toContainText('3:4')
})
