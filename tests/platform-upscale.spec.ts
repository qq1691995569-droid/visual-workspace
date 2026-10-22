import {test,expect} from '@playwright/test'
test('独立放大节点保留原图、恢复结果且刷新不重复提交',async({page})=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 let submits=0;let requestId=''
 await page.route('**/api/skills/upscale/workflows',route=>route.fulfill({json:{items:[{id:'flow',name:'测试放大工作流',version:1,is_default:true,editable_params:[{node_id:'1',params:[{name:'scale',display_name:'放大倍数',input_type:'int',min:1,max:4,step:1,default:2}]}]}],credits:2}}))
 await page.route('**/api/skills/upscale/tasks',route=>{submits++;const body=route.request().postDataJSON();requestId=body.requestId;expect(body.base).toBe(png);expect(body.workflowId).toBe('flow');return route.fulfill({json:{id:requestId,taskId:'remote-test',status:'running',message:'放大处理中'}})})
 await page.route('**/api/skills/images/tasks/*',route=>route.fulfill({json:{id:requestId,taskId:'remote-test',status:'complete',message:'放大完成',images:[{index:0,src:png,review:{}}]}}))
 await page.goto('/')
 const project={format:'visproj',schemaVersion:1,name:'独立放大验证',viewport:{x:0,y:0,zoom:1},edges:[{id:'edge',source:'base',target:'enlarge'}],nodes:[{id:'base',type:'card',position:{x:100,y:160},style:{width:240,height:240},data:{kind:'image',src:png,label:'原图'}},{id:'enlarge',type:'card',position:{x:420,y:130},style:{width:350},data:{kind:'tool',tool:'platform-upscale',label:'图像放大',generation:{model:'dreo-default',resolution:'2K',ratio:'auto',count:1}}}]}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'upscale-test.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const node=page.locator('[data-id="enlarge"]')
 await expect(node.getByRole('combobox',{name:'放大工作流'})).toContainText('测试放大工作流')
 await expect(node.getByRole('spinbutton',{name:'放大倍数'})).toHaveValue('2')
 await node.getByRole('button',{name:'开始放大',exact:true}).click()
 await expect(page.locator('[data-id="base"]')).toHaveCount(1)
 await expect(page.locator(`[data-id="skill-${requestId}-0"]`)).toHaveCount(1)
 expect(submits).toBe(1)
 await expect(page.getByText('已保存在此浏览器',{exact:false})).toBeVisible()
 await page.reload()
 await expect(page.locator(`[data-id="skill-${requestId}-0"]`)).toHaveCount(1)
 expect(submits).toBe(1)
 await page.getByRole('button',{name:'切换深色主题'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.screenshot({path:'artifacts/platform-upscale-dark.png'})
 await page.getByRole('button',{name:'切换浅色主题'}).click()
 await page.screenshot({path:'artifacts/platform-upscale-light.png'})
})
