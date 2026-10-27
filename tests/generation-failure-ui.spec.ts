import {isGenerationFailure} from '../src/generationFailure'
import {test,expect} from '@playwright/test'

test('generated outputs use shared compact failure in both themes',async({page})=>{
 await page.setViewportSize({width:1700,height:760})
 await page.goto('/')
 const sizes=[[350,150],[300,169],[260,195],[225,225],[180,240],[150,267]]
 const statuses=['paused','failed','error','submit_error','paused','failed']
 let x=60
 const nodes=sizes.map(([width,height],i)=>{
  const id='failure-'+i,jobId='mock-'+i
  const node={id,type:'card',position:{x,y:200+267-height},style:{width,height},data:{kind:'image',label:'图像',imagePresentationVersion:1,imageJob:{id:jobId,status:statuses[i],message:'未完整识别：沙发。请具体描述对象后再提取',createdAt:new Date().toISOString()},pendingResult:{jobId,sourceNode:id,index:0,endpoint:'images'}}}
  x+=width+20
  return node
 })
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'failures.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'失败态验收',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
 for(const theme of ['light','dark']){
  if(theme==='dark'){await page.evaluate(()=>localStorage.setItem('visual-workspace-theme','dark'));await page.reload()}
  await expect(page.locator('.generation-failed')).toHaveCount(6)
  for(let i=0;i<6;i++){
   const node=page.locator('[data-id="failure-'+i+'"]')
   await expect(node.locator('.canvas-generation-failure>strong')).toHaveText('生成失败')
   await expect(node.locator('.canvas-generation-failure>strong')).toHaveCSS('font-size','20px')
   await expect(node.locator('.canvas-generation-failure>p')).toHaveText('请重试或检查提示词')
   await expect(node.locator('.canvas-notice-footer,.failure-placeholder-icon,.task-activity-track')).toHaveCount(0)
   await expect(node.locator('.image-origin-label')).toHaveAttribute('data-status','失败')
  }
  await page.screenshot({path:'test-results/generation-failure-'+theme+'.png'})
 }
})

test('manual, connection and download interruptions retain their own notices',()=>{
 for(const task of [{status:'paused',message:'已停止本地等待'},{status:'failed',message:'结果下载失败'},{status:'connection_lost',message:'连接中断'},{status:'submission_unknown',message:'正在确认提交'}]){
  expect(isGenerationFailure(task)).toBe(false)
 }
 expect(isGenerationFailure({status:'paused',message:'未完整识别：沙发'})).toBe(true)
})
