import {test,expect} from '@playwright/test'
import {readFileSync,existsSync} from 'node:fs'
test.skip(!existsSync('artifacts/perf-images.json'),'Generate performance fixtures first')
test('navigation defers presentation work, then restores detail in both themes',async({page})=>{
 const image=JSON.parse(readFileSync('artifacts/perf-images.json','utf8'))[0]
 await page.goto('/')
 await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
 const project={format:'visproj',schemaVersion:1,name:'交互验证',nodes:[{id:'image',type:'card',position:{x:200,y:150},style:{width:340,height:340},data:{kind:'image',label:'细节预览',src:image.src,imagePresentationVersion:1}}],edges:[],viewport:{x:0,y:0,zoom:1}}
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'responsive.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name)
 const flow=page.locator('.react-flow'),img=page.locator('.image-body img')
 await expect.poll(()=>img.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true)
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'切换深色主题'}).click()
  const before=await flow.evaluate(e=>(e as HTMLElement).style.getPropertyValue('--port-scale'))
  await page.mouse.move(700,450);await page.mouse.wheel(0,-180)
  await expect(flow).toHaveClass(/viewport-interacting/)
  expect(await flow.evaluate(e=>(e as HTMLElement).style.getPropertyValue('--port-scale'))).toBe(before)
  await expect(flow).not.toHaveClass(/viewport-interacting/,{timeout:3000})
  await expect.poll(()=>flow.evaluate(e=>(e as HTMLElement).style.getPropertyValue('--port-scale'))).not.toBe(before)
  await expect.poll(()=>img.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true)
  await page.screenshot({path:`artifacts/responsive-${theme}.png`})
 }
})
