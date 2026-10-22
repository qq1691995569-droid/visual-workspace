import {test,expect} from '@playwright/test'
test('upscale administration layout in both themes without touching real configuration',async({page})=>{
 const workflow={id:'adi',name:'ADI TTP 放大',enabled:true,is_default:true,version:2,template_uuid:'a'.repeat(32),workflow_uuid:'b'.repeat(32),load_image_node_id:'193',generate_params_template:{'193':{class_type:'LoadImage',inputs:{image:''}}},editable_params:[],cross_field_rules:[]}
 await page.route('**/api/skills/config-admin**',route=>{const url=new URL(route.request().url());return route.fulfill({json:url.pathname.endsWith('/upscale-sharing')?{configured:true,origin:'https://10.0.0.1:5443',clients:[]}:url.pathname.endsWith('/upscale')?{revision:'test',draftRevision:0,workflows:[workflow],active:[workflow],credentialsReady:true,hasDraft:false,history:[]}:{draft:{features:[]},active:{revision:0},versions:[],editRevision:0,audit:[]}})})
 await page.goto('/admin');await page.getByRole('textbox',{name:'管理口令'}).fill('mock-only');await page.getByRole('button',{name:'进入后台'}).click()
 await page.getByRole('button',{name:'放大工作流 管理工作流、参数与发布版本'}).click()
 await expect(page.getByLabel('工作流名称')).toHaveValue('ADI TTP 放大')
 await expect(page.getByRole('button',{name:'发布到本机服务'})).toBeDisabled()
 for(const theme of ['light','dark']){if(theme==='dark')await page.getByRole('button',{name:'切换深色主题'}).click();await expect(page.getByRole('heading',{name:'同事共享访问'})).toBeVisible();await page.screenshot({path:`artifacts/upscale-admin-${theme}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
})
