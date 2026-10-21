import {test,expect} from '@playwright/test'
test('分组内空白处框选子图片，标题仍可移动整组',async({page})=>{
 await page.goto('/')
 const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const nodes=[{id:'group',type:'card',position:{x:200,y:160},style:{width:700,height:450},data:{kind:'group',label:'测试分组'}},...['a','b'].map((id,i)=>({id,type:'card',parentId:'group',position:{x:100+i*220,y:120},style:{width:160,height:160},data:{kind:'image',src,label:id}}))]
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'selection.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'分组框选',viewport:{x:0,y:0,zoom:1},edges:[],nodes}))})
 const group=page.locator('[data-id="group"]')
 await expect(group).toBeVisible()
 await page.mouse.move(270,250);await page.mouse.down();await page.mouse.move(710,470,{steps:15});await page.mouse.up()
 await expect(page.locator('[data-id="a"]')).toHaveClass(/selected/)
 await expect(page.locator('[data-id="b"]')).toHaveClass(/selected/)
 await expect(group).not.toHaveClass(/selected/)
 const before=await group.boundingBox()
 const childBefore=await page.locator('[data-id="a"]').boundingBox()
 const heading=(await group.locator('.group-heading').boundingBox())!;await page.mouse.move(heading.x+35,heading.y+10);await page.mouse.down();await page.mouse.move(heading.x+85,heading.y+40,{steps:10});await page.mouse.up()
 await expect.poll(async()=>Math.round((await group.boundingBox())!.x-before!.x)).toBeGreaterThan(40)
 await expect.poll(async()=>Math.abs(((await page.locator('[data-id="a"]').boundingBox())!.x-childBefore!.x)-((await group.boundingBox())!.x-before!.x))).toBeLessThan(.5)
 await group.getByRole('button',{name:'收拢卡片组',exact:true}).click()
 await expect(group.locator('.collection-folded')).toBeVisible()
 await group.getByRole('button',{name:'展开卡片组',exact:true}).click()
 await expect(group.locator('.collection-folded')).toHaveCount(0)
})
