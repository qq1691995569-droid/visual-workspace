import {test, expect} from '@playwright/test'

test('local edit resolves browser URLs for original and all references without mutating canvas data', async ({page}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser module directly.
    const {prepareLocalEditSubmission} = await import('/src/localEditSubmission.ts')
    const canvas = document.createElement('canvas'); canvas.width=2; canvas.height=2
    const data=canvas.toDataURL('image/png')
    const blob=await (await fetch(data)).blob(), url=URL.createObjectURL(blob)
    const asset={kind:'material',name:'测试',image:url,prompt:'木材',tags:[],notes:'',sourceImage:url}
    const recipe={kind:'material',target:'桌子',points:[],asset,supplement:'',regions:[{target:'椅子',points:[],asset}]}
    try {
      const prepared=await prepareLocalEditSubmission(url,recipe)
      return {base:prepared.base===data,asset:prepared.edit.asset.image===data,source:prepared.edit.asset.sourceImage===data,region:prepared.edit.regions[0].asset.image===data,unchanged:recipe.asset.image===url}
    } finally {URL.revokeObjectURL(url)}
  })
  expect(result).toEqual({base:true,asset:true,source:true,region:true,unchanged:true})
})

test('expired object URL fails locally with an actionable message', async ({page}) => {
  await page.goto('/')
  const message=await page.evaluate(async()=>{
    // @ts-expect-error Vite serves the browser module directly.
    const {submissionImage}=await import('/src/localEditSubmission.ts')
    const url=URL.createObjectURL(new Blob(['test'],{type:'image/png'}));URL.revokeObjectURL(url)
    try {await submissionImage(url);return 'unexpected success'} catch(e){return (e as Error).message}
  })
  expect(message).toContain('请重新导入')
})

test('unaccepted submissions and submit errors never query a nonexistent task', async ({page}) => {
  let polls=0
  await page.route('**/api/skills/images/tasks/**', route=>{polls++;return route.fulfill({status:404,json:{code:'TASK_NOT_FOUND'}})})
  await page.goto('/')
  const nodes=['submitting','submit_error'].map((status,i)=>({id:status,type:'card',position:{x:100+i*320,y:200},style:{width:290,height:340},data:{kind:'image',label:'材质优化',imageJob:{requestId:status,status,message:'测试'},pendingResult:{jobId:status,sourceNode:status,index:0,endpoint:'images'}}}))
  await page.locator('input[accept=".visproj"]').setInputFiles({name:'submit.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'提交检查',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
  await expect(page.locator('[data-id="submitting"]')).toBeVisible()
  await page.waitForTimeout(4500)
  expect(polls).toBe(0)
})
