import {test,expect} from '@playwright/test'

test('image connection endpoints stay attached through zoom in both themes',async({page})=>{
 await page.goto('/')
 const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const nodes=['a','b'].map((id,i)=>({id,type:'card',position:{x:350+i*450,y:200},style:{width:180,height:180},data:{kind:'image',src,label:id}}))
 await page.locator('input[accept=".visproj"]').setInputFiles({name:'geometry.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'Geometry test',nodes,edges:[{id:'ab',source:'a',target:'b'}],viewport:{x:0,y:0,zoom:1}}))})
 await page.locator('[data-id="a"] .image-body').click()
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme)
  for(const delta of [80,80,-80,-80]){
   await page.mouse.move(600,350);await page.mouse.wheel(0,delta);await page.waitForTimeout(250)
   await expect.poll(()=>page.evaluate(()=>{
    const path=document.querySelector('.react-flow__edge-path') as SVGPathElement
    if(!path)return 999
    const matrix=path.getScreenCTM()!
    const points=[path.getPointAtLength(0).matrixTransform(matrix),path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix)]
    const handles=[document.querySelector('[data-id="a"] .source')!,document.querySelector('[data-id="b"] .target')!].map(el=>el.getBoundingClientRect())
    return Math.max(...points.map((p,i)=>Math.hypot(p.x-(i?handles[i].left:handles[i].right),p.y-(handles[i].top+handles[i].height/2))))
   })).toBeLessThan(3)
  }
 }
})
