import {test,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
const images=process.env.CANVAS_PERF ? JSON.parse(readFileSync('artifacts/perf-images.json','utf8')) : []
test.skip(!process.env.CANVAS_PERF,'Opt-in stress test: generate fixtures, then set CANVAS_PERF=1')
for(const count of [200,300])test(`canvas performance ${count}`,{timeout:180000},async({page})=>{
 test.setTimeout(180000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/');await expect(page.locator('.project-name')).toContainText('已保存在此浏览器')
 const nodes=images.slice(0,count).map((im:any,i:number)=>({id:`p${i}`,type:'card',position:{x:(i%20)*200,y:Math.floor(i/20)*165},style:{width:160,height:120},data:{kind:'image',label:`测试图片 ${i}`,src:im.src,previewSrc:im.previewSrc,imagePresentationVersion:1}}))
 const edges=nodes.slice(1).filter((_:any,i:number)=>i%20!==19).map((n:any)=>({id:'e'+n.id,source:'p'+(Number(n.id.slice(1))-1),target:n.id}))
 const project={format:'visproj',schemaVersion:1,name:`隔离性能测试 ${count}`,nodes,edges,viewport:{x:100,y:100,zoom:.24}}
 const start=Date.now()
 writeFileSync(`artifacts/performance-${count}.visproj`,JSON.stringify(project))
 await page.locator('input[accept=".visproj"]').setInputFiles(`artifacts/performance-${count}.visproj`)
 await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name,{timeout:60000})
 await expect(page.locator('.react-flow__node-card')).toHaveCount(count,{timeout:30000})
 await expect(page.locator('.project-name')).toContainText('已保存在此浏览器',{timeout:30000})
 await page.waitForTimeout(1500)
 const results:any={count,originalSize:1024,previewSize:512,loadAndSaveMs:Date.now()-start,bytes:Buffer.byteLength(JSON.stringify(project)),browser:await page.context().browser()!.version(),runs:[]}
 async function measure(name:string,action:()=>Promise<void>){
  await page.evaluate(()=>{const w=window as any;w.__perf={frames:[],long:[],last:0,active:true};w.__observer=new PerformanceObserver(list=>w.__perf.long.push(...list.getEntries().map(e=>e.duration)));w.__observer.observe({type:'longtask',buffered:false});const p=w.__perf;function frame(t:number){if(!p.active)return;if(p.last)p.frames.push(t-p.last);p.last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)})
  await action()
  const metric=await page.evaluate(()=>{const w=window as any,p=w.__perf;p.active=false;w.__observer.disconnect();const f=p.frames.sort((a:number,b:number)=>a-b),sum=f.reduce((a:number,b:number)=>a+b,0);return {fps:1000*f.length/sum,p95Ms:f[Math.floor(f.length*.95)],maxMs:f.at(-1),frames:f.length,over33ms:f.filter((x:number)=>x>33.4).length,longTasks:p.long.length,maxLongMs:Math.max(0,...p.long),mountedImages:document.querySelectorAll('.image-body img').length,domNodes:document.querySelectorAll('*').length}})
  results.runs.push({name,...metric});writeFileSync(`artifacts/performance-${count}.json`,JSON.stringify(results,null,2));console.log(count,name,metric.fps.toFixed(1),metric.p95Ms)
 }
 for(let round=1;round<=Number(process.env.PERF_ROUNDS||3);round++){
  await measure('idle-'+round,()=>page.waitForTimeout(2200))
  await measure('pan-'+round,async()=>{await page.mouse.move(700,440);await page.mouse.down({button:'middle'});for(let i=0;i<100;i++){await page.mouse.move(700+Math.sin(i/16)*130,440+Math.cos(i/16)*70);await page.waitForTimeout(16)}await page.mouse.up({button:'middle'})})
  await measure('zoom-'+round,async()=>{await page.mouse.move(750,400);for(let i=0;i<24;i++){await page.mouse.wheel(0,i<12?-35:35);await page.waitForTimeout(80)}})
  await measure('marquee-'+round,async()=>{await page.mouse.move(180,170);await page.mouse.down();for(let i=0;i<80;i++){await page.mouse.move(180+i*7,170+i*3);await page.waitForTimeout(20)}await page.mouse.up();await page.waitForTimeout(200)})
  await page.mouse.click(1370,760)
 }
 await page.getByRole('button',{name:'Zoom In',exact:true}).click({clickCount:4});await page.waitForTimeout(600)
 await measure('local-pan',async()=>{await page.mouse.move(800,450);await page.mouse.down({button:'middle'});for(let i=0;i<100;i++){await page.mouse.move(800-i*3,450+Math.sin(i/10)*50);await page.waitForTimeout(16)}await page.mouse.up({button:'middle'})})
 const visible=page.locator('.react-flow__node-card').filter({has:page.locator('.image-body img')});const candidates=await visible.all();let target
 for(const node of candidates){const b=await node.boundingBox();if(b&&b.x>100&&b.y>130&&b.x+b.width<1250&&b.y+b.height<730){target=node;break}}
 if(target){const b=(await target.boundingBox())!;await measure('drag-node',async()=>{await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();for(let i=0;i<80;i++){await page.mouse.move(b.x+b.width/2+i,b.y+b.height/2+Math.sin(i/15)*40);await page.waitForTimeout(20)}await page.mouse.up()})}
 await page.waitForTimeout(1000);await page.reload();await expect(page.getByRole('textbox',{name:'项目名称'})).toHaveValue(project.name,{timeout:60000})
 const stored=await page.evaluate(async()=>{const p='/src/canvasStorage.ts';const s=await(await import(p)).readCanvasProject();return {nodes:s.nodes.length,edges:s.edges.length}})
 expect(stored).toEqual({nodes:count,edges:edges.length});expect(errors).toEqual([])
 results.persisted=stored;results.errors=errors
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');results.metrics=(await cdp.send('Performance.getMetrics')).metrics.filter((m:any)=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents'].includes(m.name))
 writeFileSync(`artifacts/performance-${count}.json`,JSON.stringify(results,null,2));await page.screenshot({path:`artifacts/performance-${count}.png`})
})
