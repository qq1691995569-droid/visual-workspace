import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const model = 'doubao-seedream-5-0-pro-260628'
const plan = { schemaVersion: 1, palette: '米白', materials: { 墙面: '石灰泥', 产品: '黑色产品完全保护' }, texture: '细纹', atmosphere: '沿用底图光影', note: 'normal', areaPalette: { '白色(80%)': '墙面' }, mappingVersion: 'mi', targetSurfaces: [{ id: 't1', target: '墙面', source: '主参考1·墙面', match: 'compatible_material', color: '米白', material: '灰泥', texture: '细纹', reason: '同类墙面', uncertain: false, preserve: false }, { id: 'p1', target: '产品', match: 'preserve', reason: '黑色产品完全保护', uncertain: false, preserve: true }] }
test('隔离本机集成：预处理、生成请求去重、仅双结构图、下载四图及跨源拒绝', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canvas-skill-test-'))
  const large=spawnSync(process.env.CANVAS_PYTHON || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),['-c',"from PIL import Image;import io,base64;b=io.BytesIO();Image.new('RGB',(512,512),'white').save(b,format='PNG');print(base64.b64encode(b.getvalue()).decode())"],{encoding:'utf8'}).stdout.trim()
  const fixtures=JSON.parse(spawnSync(process.env.CANVAS_PYTHON || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),['-c',`from PIL import Image,ImageDraw
import io,base64,json
def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return base64.b64encode(b.getvalue()).decode()
m=Image.new('RGB',(512,512),'black');ImageDraw.Draw(m).rectangle((100,100,300,300),fill='white')
a=Image.new('RGB',(1024,1024),'black');a.paste(m,(0,0));a.paste(Image.new('RGB',(512,512),'white'),(512,512));print(json.dumps({'matte':enc(m),'layers':enc(a)}))`],{encoding:'utf8'}).stdout)
  let recoveryOffline=true;let submitted = 0; const uploads = [], requests = []
  const mock = createServer(async (req, res) => {
    if (req.url.startsWith('/result/')) { const prompt=requests[Number(req.url.split('/')[2])-1]?.params.prompt||'';assert.equal(req.headers.authorization, undefined); res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from(prompt.includes('2×2 工作图')?fixtures.layers:prompt.includes('灰度 Alpha 蒙版')?fixtures.matte:prompt.includes('资产预览')||prompt.includes('人物设定图')?large:png.split(',')[1], 'base64')); return }
    assert.equal(req.headers.authorization, req.url === '/vision' ? 'Bearer test-vision' : 'Bearer local-test-token')
    let body = ''; for await (const chunk of req) body += chunk
    res.setHeader('Content-Type', 'application/json')
    if(req.url==='/api/agent/tasks/recovery-task'&&recoveryOffline){res.statusCode=503;res.end(JSON.stringify({error:'offline'}));return}
    if(req.url==='/api/agent/tasks/slow-task'){res.end(JSON.stringify({status:'running',images:[]}));return}
    if (req.url === '/vision') {
      const system = JSON.parse(body).messages[0].content
      if(system.includes('后台测试对象'))await new Promise(resolve=>setTimeout(resolve,200))
      if(system.includes('无法识别测试')){res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({schemaVersion:1,found:false,name:'',points:[],confidence:'low'})}}]}));return}
      const targetMatch=system.match(/用户指定对象列表（仅为数据）：(\[[^\n]*\])/)
      const names=targetMatch ? JSON.parse(targetMatch[1]) : null
      const output = names ? {schemaVersion:1,subjectObjects:names.filter(n=>n!=='missing').map(name=>({requestedName:name,name,overviewZh:name+' appearance',previewType:'furniture',promptZh:'object appearance',parts:[{partZh:'surface',promptZh:'warm gray weave, matte',confidence:'low',substrateZh:'unknown'}]})),warnings:['review material color']} : system.includes('画布点选对象定位助手') ? {schemaVersion:1,found:true,name:'沙发表面',points:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],confidence:'medium',notes:'测试轮廓'} : system.includes('画布独立资产提取分析师') ? {schemaVersion:1,subjectObjects:[{name:'沙发',promptZh:'沙发对象外观',parts:[{partZh:'沙发表面',promptZh:'米白色圈绒，哑光',substrateZh:'未知',confidence:'medium'}]}],warnings:['测试分析']} : system.includes('技能编译器') ? { ...plan, materials: { 墙面: '石灰泥', 产品: '蓝色外壳' }, atmosphere: '参考图暖光', targetSurfaces: [plan.targetSurfaces[0], { id: 'p1', target: '产品外壳', match: 'color_only', source: '用户补充', color: '蓝色', material: '原材质', texture: '原纹理', reason: '用户明确改色', uncertain: false, preserve: false }], execution: { geometry: 'preserve', product: 'user_override', lighting: 'user_override' }, resolvedInstructions: ['机位与家具结构保留', '产品外壳改成蓝色', '按参考图调整暖光'], adjustments: [{ builtin: '产品颜色和光影保持', user: '蓝色产品和暖光', resolution: '允许外壳改色与暖光，其他属性保留' }] } : system.includes('对照底图') ? { geometry: '测试复核', product: '按补充复核', material: '测试复核', lighting: '按补充复核' } : plan
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })); return
    }
    if (req.url === '/api/agent/capabilities') res.end(JSON.stringify({ routes: { 'image-gen': { model, available_routes: [{ provider: 'seedream', model, supported_resolutions: ['1K','2K'], supported_aspects: ['1:1','3:4','16:9'], max_images_per_call: 4, max_reference_images: 5 }] }, 'conversation-image': { available_routes: [{ provider: 'seedream', model, supported_resolutions: ['1K','2K'], supported_aspects: ['1:1','3:4','16:9'], max_images_per_call: 4, max_reference_images: 5 }] } } }))
    else if (req.url === '/api/agent/upload') { uploads.push(JSON.parse(body)); res.end(JSON.stringify({ storage_key: `structure-${uploads.length}` })) }
    else if (req.url === '/api/agent/tasks' && req.method === 'POST') { submitted++; requests.push(JSON.parse(body)); res.end(JSON.stringify({ task_id: `mock-task-${submitted}`, status: 'running' })) }
    else if(requests[Number(req.url.split('-').pop())-1]?.params.prompt.includes('failed-object'))res.end(JSON.stringify({status:'failed',images:[]}))
    else res.end(JSON.stringify({ status: 'success', images: Array.from({ length: requests[Number(req.url.split('-').pop()) - 1]?.params.count || 4 }, (_, i) => ({ url: `http://127.0.0.1:${mock.address().port}/result/${req.url.split('-').at(-1)}/${i}.png` })) }))
  })
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve))
  const credentials = path.join(directory, 'credentials.json')
  await writeFile(credentials, JSON.stringify({ origin: `http://127.0.0.1:${mock.address().port}`, token: 'local-test-token' }))
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort'], { cwd: process.cwd(), windowsHide: true, env: { ...process.env, CANVAS_DATA_DIR: path.join(directory, 'data'), CANVAS_RUNTIME_DIR: path.join(directory,'uninstalled-runtime'), CANVAS_DREO_CONFIG: credentials, CANVAS_VISION_CONFIG_PATH: '', CANVAS_VISION_ENDPOINT: `http://127.0.0.1:${mock.address().port}/vision`, CANVAS_VISION_TOKEN: 'test-vision', CANVAS_VISION_MODEL: 'mock-vision', CANVAS_PYTHON: process.env.CANVAS_PYTHON || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe') }, stdio: 'ignore' })
  const endpoint = 'http://127.0.0.1:5188'
  async function call(route, body, headers = {}) { const response = await fetch(endpoint + route, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { code: response.status, data: await response.json() } }
  try {
    let connected = false
    for (let i = 0; i < 40; i++) { try { const status = await call('/api/skills/status'); connected = status.data.dreoConnected; if (connected) break } catch { /* Server boot. */ } await new Promise(resolve => setTimeout(resolve, 200)) }
    assert.ok(connected, 'isolated test server started')
    const absentTask=await call('/api/skills/images/tasks/'+randomUUID());assert.equal(absentTask.code,404);assert.equal(absentTask.data.code,'TASK_NOT_FOUND')
    assert.equal((await call('/api/skills/status', undefined, { Origin: 'https://untrusted.example' })).code, 400)
    const prep = await call('/api/skills/style/prepare', { base: png })
    assert.equal(prep.code, 200); assert.equal(prep.data.width, 1); assert.equal(prep.data.ratio, '1:1'); assert.match(prep.data.gray, /^data:image\/png/)
    const body = { base: png, requestId: randomUUID(), preparationId: prep.data.id, protection: '产品', confirmProtection: true, references: [png], plan }
    const noAnalysis = await call('/api/skills/style/analyze', body)
    assert.equal(noAnalysis.code, 200)
    assert.equal((await call('/api/skills/style/tasks', { ...body, confirmProtection: false })).code, 400)
    assert.equal((await call('/api/skills/style/tasks', { ...body, base: png + 'bad' })).code, 400)
    const first = await call('/api/skills/style/tasks', body)
    assert.equal(first.code, 200)
    const duplicate = await call('/api/skills/style/tasks', body)
    assert.equal(duplicate.data.id, first.data.id)
    let last
    for (let i = 0; i < 30; i++) { last = await call(`/api/skills/style/tasks/${first.data.id}`); if (last.data.status === 'complete') break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.equal(last.data.status, 'complete'); assert.equal(last.data.images.length, 4)
    assert.ok(Date.parse(last.data.finishedAt) >= Date.parse(first.data.createdAt))
    assert.ok(Date.parse(last.data.serverNow) >= Date.parse(last.data.finishedAt))
    const timingAgain = await call(`/api/skills/style/tasks/${first.data.id}`)
    assert.equal(timingAgain.data.createdAt, first.data.createdAt)
    assert.equal(timingAgain.data.finishedAt, last.data.finishedAt)
    assert.equal(submitted, 1); assert.equal(uploads.length, 2)
    assert.deepEqual(requests[0].params.image_paths, ['structure-1','structure-2'])
    assert.equal(requests[0].params.count, 4); assert.equal(requests[0].params.resolution, '2K')
    assert.equal(requests[0].params.route_override.model, model)
    assert.equal(JSON.parse(requests[0].params.prompt).product, 'preserve')
    const initialAdmin = await call('/api/skills/admin'); assert.equal(initialAdmin.data.activeVersion, 2)
    const published = await call('/api/skills/admin/publish', { rules: ['测试新默认规则'] }); assert.equal(published.data.activeVersion, 3)
    assert.equal(published.data.versions.find(v => v.version === 1).rules.length, initialAdmin.data.versions.find(v => v.version === 1).rules.length)
    await call('/api/skills/admin/activate', { version: 2 })
    const automatic = await call('/api/skills/style/run', { requestId: randomUUID(), base: png, references: [png], supplement: '把产品外壳改为蓝色，使用参考图暖光', options: { model, resolution: '1K', ratio: '16:9', count: 2 } })
    assert.equal(automatic.code, 200)
    for (let i = 0; i < 60; i++) { last = await call(`/api/skills/style/tasks/${automatic.data.id}`); if (['complete','paused'].includes(last.data.status)) break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.equal(last.data.status, 'complete', last.data.message); assert.equal(last.data.images.length, 2)
    assert.equal(submitted, 2); assert.equal(uploads.length, 4)
    const sent = requests[1].params, prompt = JSON.parse(sent.prompt)
    assert.equal(sent.count, 2); assert.equal(sent.resolution, '1K'); assert.equal(sent.ratio, '16:9')
    assert.equal(prompt.product, 'user_override'); assert.equal(prompt.lighting, 'user_override')
    assert.deepEqual(prompt.constraints, ['机位与家具结构保留', '产品外壳改成蓝色', '按参考图调整暖光'])
    assert.equal(prompt.skill.version, 2); assert.equal(last.data.adjustments.length, 1)
    const audit = await call('/api/skills/admin/jobs'); assert.equal(audit.data.find(job => job.id === automatic.data.id).adjustments.length, 1)
    assert.equal('images' in audit.data[0], false)
    const textBody = { requestId: randomUUID(), mode: 'generate', prompt: '白色陶瓷杯', images: [], options: { model, resolution: '2K', ratio: '1:1', count: 1, quality: 'auto' } }
    const textJob = await call('/api/skills/images/tasks', textBody); assert.equal(textJob.code, 200)
    assert.equal((await call('/api/skills/images/tasks', textBody)).data.id, textJob.data.id)
    for (let i = 0; i < 40; i++) { last = await call(`/api/skills/images/tasks/${textJob.data.id}`); if (last.data.status === 'complete') break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.equal(last.data.status, 'complete'); assert.equal(last.data.images.length, 1); assert.equal(uploads.length, 4); assert.equal(submitted, 3)
    assert.equal(requests[2].tool_type, 'image-gen'); assert.equal('image_paths' in requests[2].params, false)
    const redraw = await call('/api/skills/images/tasks', { ...textBody, requestId: randomUUID(), mode: 'redraw', images: [png,png], options: { ...textBody.options, count: 2 } }); assert.equal(redraw.code, 200)
    for (let i = 0; i < 40; i++) { last = await call(`/api/skills/images/tasks/${redraw.data.id}`); if (last.data.status === 'complete') break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.equal(last.data.status, 'complete'); assert.equal(last.data.images.length, 2); assert.equal(uploads.length, 6)
    assert.deepEqual(requests[3].params.image_paths, ['structure-5','structure-6']); assert.equal(requests[3].tool_type, 'conversation-image')

    const asset = { kind:'material',name:'米白圈绒',image:png,prompt:'米白色细密圈绒，哑光',tags:['沙发'],notes:'内部基材未知' }
    const saved = await call('/api/skills/assets/save',asset); assert.equal(saved.code,200)
    assert.equal((await call('/api/skills/assets/save',asset)).data.duplicate,true)
    assert.equal((await call('/api/skills/assets')).data.assets.length,1)
    const located=await call('/api/skills/assets/locate',{base:png,kind:'material',mark:[.5,.5]});assert.equal(located.code,200);assert.equal(located.data.name,'沙发表面');assert.equal(located.data.requiresReview,true);assert.equal(submitted,4);assert.equal((await call('/api/skills/assets/locate',{base:png,kind:'material',mark:[-1,1]})).code,400)
    const analysis = await call('/api/skills/assets/analyze',{base:png,kind:'material',focus:'沙发',points:[[0,0],[1,0],[1,1],[0,1]]});assert.equal(analysis.code,200,JSON.stringify(analysis.data));assert.equal(analysis.data.candidates[0].prompt,'米白色圈绒，哑光');assert.match(analysis.data.candidates[0].notes,/未知/);assert.equal((await call('/api/skills/assets')).data.assets.length,1)
    const editBody = { requestId:randomUUID(),base:png,options:{model,resolution:'2K',count:4},edit:{kind:'material',target:'沙发',asset,points:[[0,0],[1,0],[1,1],[0,1]],supplement:'保持原色'} }
    assert.equal((await call('/api/skills/assets/edit/tasks',{...editBody,edit:{...editBody.edit,points:[[0,0],[1,1]]}})).code,400)
    const localized = await call('/api/skills/assets/edit/tasks',editBody); assert.equal(localized.code,200,JSON.stringify(localized.data))
    assert.equal((await call('/api/skills/assets/edit/tasks',editBody)).data.id,localized.data.id)
    for(let i=0;i<40;i++){last=await call(`/api/skills/images/tasks/${localized.data.id}`);if(last.data.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete');assert.equal(last.data.images.length,4);assert.equal(submitted,5);assert.equal(uploads.length,8)
    assert.equal(requests[4].params.image_paths.length,2)
    const localPlan = JSON.parse(requests[4].params.prompt); assert.equal(localPlan.operation,'localized_material_transfer');assert.equal(localPlan.supplement,'保持原色');assert.equal(localPlan.defaultPreservation.camera,true)
    assert.match(last.data.images[0].review.protection,/选区外像素/)

    const personBody={requestId:randomUUID(),base:png,focus:'person'}
    const person=await call('/api/skills/assets/person/tasks',personBody);assert.equal(person.code,200)
    assert.equal((await call('/api/skills/assets/person/tasks',personBody)).data.id,person.data.id)
    for(let i=0;i<50;i++){last=await call(`/api/skills/images/tasks/${person.data.id}`);if(last.data.asset || last.data.status==='paused')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(last.data.asset.kind,'person');assert.equal(last.data.asset.views.length,2)
    assert.equal(last.data.asset.image,last.data.asset.views[0].image);assert.equal(submitted,7)
    const restored=(await call('/api/skills/assets')).data.assets.find(a=>a.id===last.data.asset.id);assert.equal(restored.views.length,2)
    assert.equal((await call('/api/skills/images/tasks/'+person.data.id)).data.asset.id,restored.id);assert.equal(submitted,7)
    assert.equal((await call('/api/skills/assets/person/tasks',{...personBody,focus:'other'})).code,400)

    const extractBody={requestId:randomUUID(),base:png,kind:'material',focus:'沙发、地板'}
    const extraction=await call('/api/skills/assets/extract/tasks',extractBody);assert.equal(extraction.code,200)
    assert.equal((await call('/api/skills/assets/extract/tasks',extractBody)).data.id,extraction.data.id)
    for(let i=0;i<60;i++){last=await call('/api/skills/assets/extract/tasks/'+extraction.data.id);if(['complete','paused'].includes(last.data.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(last.data.assets.length,2);assert.equal(submitted,10)
    assert.deepEqual(last.data.assets.map(a=>a.previewType).sort(),['furniture','space']);assert.ok(last.data.assets.every(a=>a.sourceImage===png&&a.reviewStatus==='pending'))
    assert.match(requests[7].params.prompt,/白底近景特写/);assert.match(requests[8].params.prompt,/空间应用图/)
    const repeat=await call('/api/skills/assets/extract/tasks',{...extractBody,requestId:randomUUID()})
    for(let i=0;i<40;i++){last=await call('/api/skills/assets/extract/tasks/'+repeat.data.id);if(['complete','paused'].includes(last.data.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete');assert.equal(last.data.assets.length,2);assert.equal(submitted,10)
    const missing=await call('/api/skills/assets/extract/tasks',{...extractBody,requestId:randomUUID(),focus:'missing'})
    for(let i=0;i<40;i++){last=await call('/api/skills/assets/extract/tasks/'+missing.data.id);if(last.data.status==='paused')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'paused');assert.equal(last.data.assets.length,0);assert.equal(submitted,10)

    const partial=await call('/api/skills/assets/extract/tasks',{...extractBody,requestId:randomUUID(),focus:'failed-object、cabinet'})
    for(let i=0;i<60;i++){last=await call('/api/skills/assets/extract/tasks/'+partial.data.id);if(last.data.status==='paused')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'paused');assert.equal(last.data.assets.length,1);assert.equal(submitted,13);assert.match(last.data.message,/1\/2/)
    assert.equal(last.data.items.find(i=>i.name.startsWith('failed-object')).status,'paused')

    const beforeCount=(await call('/api/skills/assets')).data.assets.length
    const stagedBody={requestId:randomUUID(),base:png,kind:'material',focus:'staged-chair',placement:'canvas'}
    const staged=await call('/api/skills/assets/extract/tasks',stagedBody)
    for(let i=0;i<60;i++){last=await call('/api/skills/assets/extract/tasks/'+staged.data.id);if(['complete','paused'].includes(last.data.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(last.data.results.length,1);assert.equal(last.data.results[0].archived,false);assert.equal(submitted,15)
    assert.equal((await call('/api/skills/assets')).data.assets.length,beforeCount)
    const draft=last.data.results[0].asset;assert.equal(draft.materialCategory,'fabric');assert.ok(draft.name)
    const confirmed=await call('/api/skills/assets/save',{...draft,name:'User approved fabric'})
    assert.equal(confirmed.code,200);assert.equal(confirmed.data.asset.materialCategory,'fabric');assert.equal((await call('/api/skills/assets')).data.assets.length,beforeCount+1)
    await call('/api/skills/assets/extract/tasks/'+staged.data.id);assert.equal(submitted,15)






    const deferredBody={requestId:randomUUID(),base:png,options:{model,resolution:'2K',count:4},edit:{kind:'material',deferredSelection:true,supplement:'仅替换表面',regions:[{id:'point-1',mark:[.5,.5],target:'后台测试对象',asset}]}}
    const queued=await call('/api/skills/assets/edit/tasks',deferredBody)
    assert.equal(queued.code,200,JSON.stringify(queued.data));assert.equal(queued.data.phase.step,1);assert.equal(queued.data.status,'locating')
    assert.equal((await call('/api/skills/assets/edit/tasks',deferredBody)).data.id,queued.data.id)
    for(let i=0;i<80;i++){last=await call('/api/skills/images/tasks/'+queued.data.id);if(['complete','paused'].includes(last.data.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(last.data.phase.step,4);assert.equal(last.data.images.length,4);assert.equal(submitted,16)
    assert.equal(last.data.resolvedRegions[0].target,'沙发表面')
    assert.equal(requests.at(-1).params.image_paths.length,3);assert.equal(JSON.parse(requests.at(-1).params.prompt).regions[0].guidance,'prompt')
    await call('/api/skills/assets/edit/tasks',deferredBody);assert.equal(submitted,16)
    const beforeRecovery=submitted,recoveryId=randomUUID(),slowId=randomUUID()
    const record={type:'generation',feature:'image',status:'running',images:[],options:{count:4},createdAt:new Date().toISOString()}
    await writeFile(path.join(directory,'data',recoveryId+'.json'),JSON.stringify({...record,id:recoveryId,taskId:'recovery-task'}))
    for(let attempt=0;attempt<3;attempt++)last=await call('/api/skills/images/tasks/'+recoveryId)
    assert.equal(last.data.status,'connection_lost');assert.equal(submitted,beforeRecovery)
    recoveryOffline=false
    last=await call('/api/skills/images/tasks/'+recoveryId)
    assert.equal(last.data.status,'complete');assert.equal(last.data.images.length,4);assert.equal(last.data.warning,undefined);assert.equal(submitted,beforeRecovery)
    await writeFile(path.join(directory,'data',slowId+'.json'),JSON.stringify({...record,id:slowId,taskId:'slow-task',createdAt:new Date(Date.now()-16*60*1000).toISOString()}))
    last=await call('/api/skills/images/tasks/'+slowId)
    assert.equal(last.data.status,'needs_attention');assert.match(last.data.message,/15 分钟/);assert.equal(submitted,beforeRecovery)
    const rejected=await call('/api/skills/assets/edit/tasks',{...deferredBody,requestId:randomUUID(),edit:{...deferredBody.edit,regions:[{...deferredBody.edit.regions[0],target:'无法识别测试'}]}})
    for(let i=0;i<50;i++){last=await call('/api/skills/images/tasks/'+rejected.data.id);if(last.data.status==='paused')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'paused');assert.match(last.data.message,/对象 1/);assert.equal(submitted,16)
    const lightBody={requestId:randomUUID(),base:png,lighting:{sunlight:false,temperature:0,intensity:80,remembered:{hardness:90}},supplement:'保持沙发原色',options:{model,resolution:'2K',ratio:'auto',count:2}}
    const beforeLight=submitted,uploadBefore=uploads.length
    const light=await call('/api/skills/light/run',lightBody);assert.equal(light.code,200)
    assert.equal((await call('/api/skills/light/run',lightBody)).data.id,light.data.id)
    for(let i=0;i<50;i++){last=await call('/api/skills/images/tasks/'+light.data.id);if(last.data.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete');assert.equal(last.data.images.length,2);assert.equal(submitted,beforeLight+1);assert.equal(uploads.length,uploadBefore+1)
    assert.match(requests.at(-1).params.prompt,/中性/);assert.match(requests.at(-1).params.prompt,/保持沙发原色/);assert.doesNotMatch(requests.at(-1).params.prompt,/80\/100|90\/100/)
    assert.equal((await call('/api/skills/light/run',{...lightBody,lighting:{temperature:200}})).code,400)
    const expandBody={requestId:randomUUID(),base:png,frame:{x:-.5,y:-.5,width:2,height:2},prompt:'延续地板',options:{model,resolution:'2K',count:4}}
    const beforeExpand=submitted
    const expanded=await call('/api/skills/expand/tasks',expandBody);assert.equal(expanded.code,200,JSON.stringify(expanded.data))
    assert.equal((await call('/api/skills/expand/tasks',expandBody)).data.id,expanded.data.id)
    for(let i=0;i<50;i++){last=await call('/api/skills/images/tasks/'+expanded.data.id);if(last.data.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(last.data.images.length,1);assert.equal(submitted,beforeExpand+1)
    assert.equal(requests.at(-1).params.count,1);assert.match(requests.at(-1).params.prompt,/新增区域/)
    assert.equal((await call('/api/skills/expand/tasks',{...expandBody,frame:{x:0,y:0,width:1,height:1}})).code,400)
    for(const operation of ['edit','redraw','erase','background','upscale','separate','white-background']){
      const before=submitted,input={requestId:randomUUID(),operation,base:'data:image/png;base64,'+large,parameters:{prompt:'保持构图',maskStrokes:[[[500,500],[600,500]]]},options:{model,resolution:'2K',count:4}}
      const created=await call('/api/skills/canvas/tasks',input);assert.equal(created.code,200,JSON.stringify(created.data));assert.equal(created.data.skillHash.length,64)
      assert.equal((await call('/api/skills/canvas/tasks',input)).data.id,created.data.id)
      for(let i=0;i<(['background','erase','upscale','separate'].includes(operation)?600:50);i++){last=await call('/api/skills/images/tasks/'+created.data.id);if(['complete','paused'].includes(last.data.status))break;await new Promise(resolve=>setTimeout(resolve,100))}
      if(['background','erase','upscale','separate'].includes(operation)){assert.equal(last.data.status,'paused',JSON.stringify(last.data));assert.match(last.data.message,operation==='separate'?/对象清单无效/:/运行环境未安装/);assert.equal(submitted,before);continue}
      assert.equal(last.data.status,'complete',JSON.stringify(last.data));assert.equal(submitted,before+1);assert.equal(requests.at(-1).params.count,1)
      assert.equal(last.data.images.length,operation==='separate'?2:1)
      if(operation==='erase')assert.equal(requests.at(-1).params.image_paths.length,2)
      if(operation==='separate')assert.match(last.data.images[0].review.layer,/背景/)
      assert.equal((await call('/api/skills/canvas/tasks',{...input,parameters:{prompt:'another'}})).code,400)
    }
    assert.equal((await call('/api/skills/canvas/tasks',{requestId:randomUUID(),operation:'erase',base:png,parameters:{maskStrokes:[]}})).code,400)
    const deletion=await fetch(endpoint+'/api/skills/tasks/'+light.data.id,{method:'DELETE'})
    assert.equal(deletion.status,200)
    assert.equal((await deletion.json()).deleted,true)
    const deleted=await call('/api/skills/images/tasks/'+light.data.id)
    assert.equal(deleted.data.status,'paused')
    assert.deepEqual(deleted.data.images,[])
    assert.equal((await fetch(endpoint+'/api/skills/tasks/'+light.data.id,{method:'DELETE'})).status,200)
    const repeated=await call('/api/skills/light/run',lightBody)
    assert.deepEqual(repeated.data.images,[],'删除后重试相同请求不能复活结果')
  } finally {
    vite.kill(); await new Promise(resolve => { if (vite.exitCode !== null) resolve(); else vite.once('exit', resolve) })
    await new Promise(resolve => mock.close(resolve))
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()))
    assert.ok(path.basename(directory).startsWith('canvas-skill-test-'))
    await rm(directory, { recursive: true, force: true })
  }
})
