import {test,expect} from '@playwright/test'

test('restoring, cancellation and completed aliases display their actual state',async({page})=>{
 const polls:Record<string,number>={}
 const cases=[['restoring','查询中','正在查询任务状态'],['cancelled','已取消','已取消'],['canceled','已取消','已取消'],['completed',null,'正在载入结果']] as const
 await page.route('**/api/skills/images/tasks/**',route=>{const status=route.request().url().split('/').at(-1)!;polls[status]=(polls[status]||0)+1;return route.fulfill({json:{id:status,status,message:"测试状态",images:[],createdAt:new Date(Date.now()-5000).toISOString()}})})
 await page.goto('/')
 const nodes=cases.map(([status],i)=>({id:status,type:'card',position:{x:100+i*320,y:200},style:{width:290,height:340},data:{kind:'image',label:'图像',imagePresentationVersion:1,imageJob:{id:status,status:status.startsWith('cancel')?'running':status,message:"测试状态",createdAt:new Date(Date.now()-5000).toISOString()},pendingResult:{jobId:status,sourceNode:status,index:0,endpoint:'images'}}}))
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'states.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'状态检查',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
 for(const [status,badge,text] of cases){
  const node=page.locator('[data-id="'+status+'"]')
  if(badge)await expect(node.locator('.image-origin-label')).toHaveAttribute('data-status',badge)
  await expect(node).toContainText(text)
  if(status==='completed')await expect(node.locator('.task-timing')).toContainText('历史任务未记录结束时间')
 }
 await page.waitForTimeout(200)
 const terminalPolls={cancelled:polls.cancelled,canceled:polls.canceled}
 expect(terminalPolls.cancelled).toBeGreaterThan(0)
 expect(terminalPolls.canceled).toBeGreaterThan(0)
 await page.waitForTimeout(4300) // Beyond the polling interval: terminal responses must not schedule another query.
 expect(polls.cancelled).toBe(terminalPolls.cancelled)
 expect(polls.canceled).toBe(terminalPolls.canceled)
})
