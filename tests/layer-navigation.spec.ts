import {test,expect} from '@playwright/test'
test('layer click reveals folded child and locates offscreen nodes',async({page})=>{
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'图层定位验证',nodes:[{id:'group',type:'card',position:{x:4000,y:3000},style:{width:280,height:330},data:{kind:'group',label:'PP01',collapsed:true,expandedSize:{width:800,height:700}}},{id:'child',type:'card',parentId:'group',position:{x:30,y:70},style:{width:340,height:400},data:{kind:'image',label:'组内目标'}},{id:'outside',type:'card',position:{x:-4000,y:-3000},style:{width:340,height:300},data:{kind:'image',label:'远处图片'}}],edges:[],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'layers.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await page.getByRole('button',{name:'图层面板',exact:true}).click()
 await page.locator('.layer-list button').filter({hasText:'组内目标'}).click()
 const child=page.locator('.react-flow__node[data-id="child"]')
 await expect(child).toBeVisible();await expect(child).toHaveClass(/selected/)
 await expect.poll(async()=>{const b=await child.boundingBox();return !!b&&b.x>280&&b.y>50&&b.x+b.width<1440&&b.y+b.height<900}).toBe(true)
 await page.screenshot({path:'artifacts/layer-locate-child.png'})
 await page.locator('.layer-list button').filter({hasText:'远处图片'}).click()
 const outside=page.locator('.react-flow__node[data-id="outside"]');await expect(outside).toBeVisible()
 await expect.poll(async()=>{const b=await outside.boundingBox();return !!b&&b.x>280&&b.y>50&&b.x+b.width<1440&&b.y+b.height<900}).toBe(true)
})
