import {chromium} from '@playwright/test';import {writeFile,mkdir,readFile} from 'node:fs/promises';
const baseUrl=process.env.PERF_URL || 'http://127.0.0.1:5173', label=process.env.PERF_LABEL || 'latest';
const photo=process.env.PERF_PHOTO ? 'data:image/png;base64,'+(await readFile(process.env.PERF_PHOTO)).toString('base64') : undefined;
const browser=await chromium.launch({channel:'msedge'}), reports=[];
await mkdir('artifacts',{recursive:true});
for(const count of [100,200]){
 console.log(`Testing ${count} images...`);
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await page.goto(baseUrl);await page.locator('.react-flow__pane').waitFor();
 const sources=await page.evaluate(async ({n,photo})=>{
 const image=photo?new Image():undefined;if(image){image.src=photo;await image.decode()}
 return Array.from({length:n},(_,i)=>{const c=document.createElement('canvas');c.width=image?2048:512;c.height=image?Math.round(2048*image.naturalHeight/image.naturalWidth):512;const ctx=c.getContext('2d');if(image){ctx.drawImage(image,0,0,c.width,c.height);ctx.fillStyle=`hsl(${i*17%360} 40% 65%)`;ctx.fillRect(i*3%2000,0,8,8)}else{const g=ctx.createLinearGradient(0,0,512,512);g.addColorStop(0,`hsl(${i*17%360} 40% 65%)`);g.addColorStop(1,'#eee');ctx.fillStyle=g;ctx.fillRect(0,0,512,512)}return c.toDataURL('image/jpeg',image?.65:.8)})}, {n:count,photo});
 const nodes=[{id:'group',type:'card',position:{x:100,y:100},style:{width:3500,height:Math.ceil(count/10)*370+80},data:{kind:'group',label:'性能测试',collapsed:false}},...sources.map((src,i)=>({id:'n'+i,type:'card',parentId:'group',position:{x:20+i%10*345,y:60+Math.floor(i/10)*370},style:{width:320,height:320},data:{kind:'image',label:'测试图'+i,src}}))];
 const edges=[];
 if(photo){
  for(let i=0;i<10;i++){
   nodes.push({id:'tool'+i,type:'card',parentId:'group',position:{x:3550,y:60+i*650},style:{width:620},data:{kind:'tool',tool:'light',label:'光影优化',skillState:{options:{model:'doubao-seedream-5-0-pro-260628',resolution:'2K',ratio:'auto',count:4}}}});
   for(let j=i*count/10;j<(i+1)*count/10;j++)edges.push({id:'e'+j,source:'tool'+i,target:'n'+j});
  }
  nodes[0].style.width=4250;
 }
 const start=performance.now();await page.locator('input[accept=".visproj"]').setInputFiles({name:'perf.visproj',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'visproj',schemaVersion:1,name:'性能基线'+count,nodes,edges,viewport:{x:200,y:100,zoom:.2}}))});await page.locator('.react-flow__node[data-id="group"]').waitFor();await page.locator('.project-name').filter({hasText:'已保存在此浏览器'}).waitFor();
 const loadAndSaveMs=Math.round(performance.now()-start);
 const sample=async()=>{await page.evaluate(()=>{window.framesMeasured=[];let last=performance.now();window.measureActive=true;function frame(t){window.framesMeasured.push(t-last);last=t;if(window.measureActive)requestAnimationFrame(frame)}requestAnimationFrame(frame)});await page.mouse.move(1200,450);await page.mouse.down({button:'middle'});for(let i=0;i<120;i++)await page.mouse.move(1200-Math.sin(i/119*Math.PI)*96,450+Math.sin(i/119*Math.PI)*48);await page.mouse.up({button:'middle'});return page.evaluate(()=>{window.measureActive=false;const values=window.framesMeasured.slice(1).sort((a,b)=>a-b);return {frames:values.length,medianFrameMs:Math.round((values[Math.floor(values.length*.5)]||0)*10)/10,p95FrameMs:Math.round((values[Math.floor(values.length*.95)]||0)*10)/10}})};
 await page.waitForFunction(photo=>Array.from(document.querySelectorAll('.image-body img')).every(img=>img.complete && img.naturalWidth>0 && (!photo || Math.max(img.naturalWidth,img.naturalHeight)<=256)),!!photo,{timeout:120000});
 const previewReadyMs=Math.round(performance.now()-start);
 await page.screenshot({path:`artifacts/canvas-performance-${label}-${count}-expanded.png`});
 const expanded=await sample();let t=performance.now();await page.locator('.react-flow__controls-zoomin').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const zoomMs=Math.round(performance.now()-t);await page.locator('.react-flow__controls-zoomout').click();t=performance.now();await page.mouse.move(1200,850);await page.mouse.down();await page.mouse.move(200,100,{steps:16});await page.mouse.up();const selectionMs=Math.round(performance.now()-t);await page.mouse.click(1250,850);t=performance.now();await page.getByRole('button',{name:'收拢卡片组',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.react-flow__node-card').length===1);const foldMs=Math.round(performance.now()-t);await page.screenshot({path:`artifacts/canvas-performance-${label}-${count}-folded.png`});const folded=await sample();t=performance.now();await page.getByRole('button',{name:'展开卡片组',exact:true}).click();await page.getByRole('button',{name:'收拢卡片组',exact:true}).waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const expandMs=Math.round(performance.now()-t);
 reports.push({images:count,previewReadyMs,profile:photo?'2048px photo variants, 10 lighting nodes and image connections':'512px synthetic images',renderedNodes:await page.locator('.react-flow__node-card').count(),loadAndSaveMs,zoomMs,selectionMs,foldMs,expandMs,expanded,folded,foldedRenderedNodes:1});console.log(JSON.stringify(reports.at(-1)));await context.close();
}
await browser.close();await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/canvas-performance-${label}.json`,JSON.stringify({baseUrl,environment:'Edge headless, 1440x1000, JPEGs (see per-run profile), no backend generation; browser automation timing includes overhead',reports},null,2));console.log(JSON.stringify(reports));
