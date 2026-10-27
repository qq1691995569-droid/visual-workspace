import {test,expect} from '@playwright/test'
test('toolbar preview failures keep centered message and blurred input in both themes',async({page})=>{
 await page.setViewportSize({width:1500,height:850})
 await page.goto('/')
 const ops=['edit','separate','background','erase','expand','upscale']
 const sizes=[[420,180],[360,203],[230,230],[210,280],[300,200],[200,267]]
 const previews=await page.evaluate(sizes=>sizes.map(([width,height])=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d')!;ctx.fillStyle='#9b9081';ctx.fillRect(0,0,width,height);ctx.fillStyle='#39483c';ctx.fillRect(10,10,65,90);ctx.fillStyle='#ddd9cb';ctx.fillRect(90,10,55,110);ctx.fillStyle='#685d52';ctx.fillRect(140,100,160,70);return c.toDataURL()}),sizes)
 const nodes=ops.map((op,i)=>{
  const [width,height]=sizes[i]
  return {id:'preview-'+i,type:'card',position:{x:90+i%3*460,y:140+Math.floor(i/3)*330},style:{width,height},data:{kind:'image',src:previews[i],imagePresentationVersion:1,canvasOperation:op,label:op,imageJob:{id:'mock-'+i,status:i%2?'paused':'failed',message:'处理失败',createdAt:new Date().toISOString()}}}
 })
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'preview-failure.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'图片工具失败态',nodes,edges:[],viewport:{x:0,y:0,zoom:1}}))})
 for(const theme of ['light','dark']){
  if(theme==='dark'){await page.evaluate(()=>localStorage.setItem('visual-workspace-theme','dark'));await page.reload()}
  await expect(page.locator('.preview-failed')).toHaveCount(6)
  for(let i=0;i<6;i++){
   const node=page.locator('[data-id="preview-'+i+'"]')
   await expect(node.locator('.canvas-generation-failure>strong')).toHaveText('生成失败')
   await expect(node.locator('.canvas-generation-failure>strong')).toHaveCSS('font-size','20px')
   await expect(node.locator('.task-preview-media img')).toHaveCSS('filter','blur(4.5px)')
   const radius=await node.locator('.clean-image').evaluate(el=>getComputedStyle(el).borderRadius)
   await expect(node.locator('.generation-overlay')).toHaveCSS('border-radius',radius)
   await expect(node.locator('.image-processing')).toHaveCSS('border-radius',radius)
   await expect(node.locator('.image-body')).toHaveCSS('border-radius',radius)
   await expect(node.locator('.generation-overlay')).toHaveCSS('overflow','hidden')
   await expect(node.locator('.canvas-notice-footer,.failure-placeholder-icon,.processing-dot-array,.task-timing')).toHaveCount(0)
   await expect(node.locator('.image-origin-label')).toHaveAttribute('data-status','失败')
   const frame=await node.locator('.image-processing').boundingBox(),status=await node.locator('.processing-status').boundingBox()
   expect(Math.abs(status!.y+status!.height/2-frame!.y-frame!.height/2)).toBeLessThan(2)
  }
  await page.screenshot({path:'test-results/toolbar-failure-'+theme+'.png'})
 }
})
