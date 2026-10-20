import {test,expect} from '@playwright/test'
test('引用当前图默认一张，扩图提交实际边框',async({page})=>{
 const requests:{url:string;body:any}[]=[]
 await page.route('**/api/skills/canvas/tasks',async route=>{requests.push({url:route.request().url(),body:route.request().postDataJSON()});await route.fulfill({json:{id:'mock-reference',status:'paused',message:'测试'}})})
 await page.route('**/api/skills/expand/tasks',async route=>{requests.push({url:route.request().url(),body:route.request().postDataJSON()});await route.fulfill({json:{id:'mock-expand',status:'paused',message:'测试'}})})
 await page.goto('/')
 const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const project={format:'visproj',schemaVersion:1,name:'引用扩图',viewport:{x:0,y:0,zoom:1},draft:{generation:{count:4}},edges:[],nodes:[{id:'base',type:'card',position:{x:400,y:250},style:{width:240,height:240},data:{kind:'image',src,label:'当前底图'}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'ref.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const image=page.locator('[data-id="base"] .image-body')
 await image.click()
 await page.getByRole('button',{name:'引用生成',exact:true}).click()
 await expect(page.getByAltText('当前引用图片')).toBeVisible()
 await page.getByLabel('图片修改要求').fill('光线暖一点')
 await page.getByRole('toolbar',{name:'引用生成操作'}).getByRole('button',{name:'生成图片',exact:true}).click()
 await expect.poll(()=>requests.length).toBe(1)
 expect(requests[0].body.base).toBe(src);expect(requests[0].body.operation).toBe('redraw');expect(requests[0].body.options.count).toBe(1)
 await image.click()
 await page.getByRole('button',{name:'扩图',exact:true}).click()
 await page.getByLabel('扩图补充说明').fill('延续地板')
 const handle=page.getByLabel('调整扩图范围 e',{exact:true});const rect=await handle.boundingBox()
 await page.mouse.move(rect!.x+4,rect!.y+4);await page.mouse.down();await page.mouse.move(rect!.x+52,rect!.y+4);await page.mouse.up()
 await page.getByRole('toolbar',{name:'扩图操作'}).getByRole('button',{name:'确认',exact:true}).click()
 await expect.poll(()=>requests.length).toBe(2)
 expect(requests[1].body.base).toBe(src);expect(requests[1].body.options.count).toBe(1)
 expect(requests[1].body.frame.width).toBeGreaterThan(1.5);expect(requests[1].body.prompt).toBe('延续地板')
})
