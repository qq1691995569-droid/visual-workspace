import {test,expect} from '@playwright/test'
test('generator frame follows connected reference geometry',async({page})=>{
 await page.goto('/')
 const src=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;c.getContext('2d')!.fillRect(0,0,200,200);return c.toDataURL()})
 for(const [width,height] of [[320,320],[380,190],[240,360]]){
 const project={format:'visproj',schemaVersion:1,name:`尺寸验证${width}`,nodes:[{id:'a',type:'card',position:{x:160,y:220},style:{width,height},data:{kind:'image',label:'参考图',src,imagePresentationVersion:1}},{id:'b',type:'card',position:{x:650,y:220},style:{width:340,height:210},data:{kind:'tool',canvasImageNode:true,tool:'redraw',label:'图像'}}],edges:[{id:'ab',source:'a',target:'b'}],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'size.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
 const frame=page.locator('.react-flow__node[data-id="b"]')
 await expect(frame).toHaveCSS('width',`${width}px`)
 await expect(frame).toHaveCSS('height',`${height}px`)
 await expect(frame.locator('.generator-identity strong,.generator-identity small')).toHaveCount(0)
 const frameBox=await frame.boundingBox(),iconBox=await frame.locator('.generator-icon').boundingBox()
 expect(Math.abs((iconBox!.x+iconBox!.width/2)-(frameBox!.x+frameBox!.width/2))).toBeLessThan(1)
 expect(Math.abs((iconBox!.y+iconBox!.height/2)-(frameBox!.y+frameBox!.height/2))).toBeLessThan(1)
 await page.screenshot({path:`artifacts/generator-frame-${width}.png`})
 }
})
