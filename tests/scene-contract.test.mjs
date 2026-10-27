import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePlan, generationRequest, runOptions, MODEL } from '../server/scene-contract.mjs'
const rules = { id: 'scene-style', version: 1, rules: ['固定机位', '产品完全保护'] }
const sample = () => ({ schemaVersion: 1, palette: '奶油白与木色', materials: { 墙面: '浅米色灰泥', 产品: '完全保护' }, texture: '细腻低反射', atmosphere: '保留原光影', note: 'normal', areaPalette: { '米白(70%)': '墙面' }, mappingVersion: 'mi', targetSurfaces: [{ id: 't1', target: '墙面', source: '主参考1·墙面', match: 'compatible_material', color: '米白', material: '灰泥', texture: '细纹', reason: '兼容墙面用途', uncertain: false, preserve: false }, { id: 'p1', target: '产品', match: 'preserve', reason: '产品完全保护', uncertain: false, preserve: true }] })
test('风格技能仅发送两张结构图，固定模型/分辨率/数量并使用 JSON prompt', () => {
  const plan = validatePlan(sample(), '产品和人物')
  const req = generationRequest(plan, ['gray-key', 'line-key'], '3:4', rules)
  assert.deepEqual(req.params.image_paths, ['gray-key', 'line-key'])
  assert.equal(req.params.route_override.model, MODEL)
  assert.equal(req.params.count, 4); assert.equal(req.params.resolution, '2K')
  assert.equal(JSON.parse(req.params.prompt).lighting, 'preserve')
  assert.equal(JSON.parse(req.params.prompt).protection, '产品和人物')
  assert.throws(() => generationRequest(plan, ['gray','line','reference'], '3:4', rules))
  assert.throws(() => generationRequest(plan, ['gray','gray'], '3:4', rules))
  assert.throws(() => generationRequest(plan, ['gray','line'], '7:8', rules))
})
test('缺少保护项、非法匹配、重复 ID 和非 JSON 结构方案均被拒绝', () => {
  const plan = sample(); plan.targetSurfaces.pop(); assert.throws(() => validatePlan(plan, '产品'))
  const bad = sample(); bad.targetSurfaces[0].match = 'palette_fallback'; assert.throws(() => validatePlan(bad, '产品'))
  const duplicate = sample(); duplicate.targetSurfaces[1].id = 't1'; assert.throws(() => validatePlan(duplicate, '产品'))
  const mismatch = sample(); mismatch.targetSurfaces[1].preserve = false; assert.throws(() => validatePlan(mismatch, '产品'))
  assert.throws(() => validatePlan('换成温暖风格', '产品'))
})
test('补充说明覆盖产品和光影默认，最终请求不重新拼入冲突的默认规则', () => {
  const raw = sample(); raw.targetSurfaces.pop()
  raw.execution = { geometry: 'preserve', product: 'user_override', lighting: 'user_override' }
  raw.resolvedInstructions = ['产品改为蓝色', '使用暖光', '机位不变']
  raw.adjustments = [{ builtin: '产品与光影不变', user: '产品蓝色和暖光', resolution: '覆盖产品色与光影，机位仍保持' }]
  const plan = validatePlan(raw, '其他物体保留', '产品改蓝并换暖光')
  const request = generationRequest(plan, ['gray', 'line'], '16:9', rules, { provider: 'seedream', model: MODEL, resolution: '1K', count: 2 })
  const prompt = JSON.parse(request.params.prompt)
  assert.equal(prompt.product, 'user_override'); assert.equal(prompt.lighting, 'user_override')
  assert.deepEqual(prompt.constraints, raw.resolvedInstructions)
  assert.equal(request.params.count, 2); assert.equal(request.params.resolution, '1K')
  delete raw.resolvedInstructions
  assert.throws(() => validatePlan(raw, '产品', '改蓝'), /冲突解析/)
})
test('生图参数按模型能力校验，不静默降级画质或修改张数', () => {
  const routes = [{ model: MODEL, provider: 'seedream', max_reference_images: 5, supported_resolutions: ['1K','2K'], supported_aspects: ['3:4','1:1'], max_images_per_call: 4 }]
  assert.equal(runOptions({ ratio: 'auto', count: 2 }, routes, '3:4').ratio, '3:4')
  assert.throws(() => runOptions({ resolution: '4K' }, routes, '3:4'))
  assert.throws(() => runOptions({ count: 5 }, routes, '3:4'))
  assert.throws(() => runOptions({ model: 'unknown' }, routes, '3:4'))
})


test('无产品纯场景可迁移所有表面，存在性判断传入最终生图请求',()=>{
 const raw=sample();raw.targetSurfaces.pop();delete raw.materials.产品
 raw.productAssessment={status:'absent',evidence:'底图只有墙面和家具，未见家电或指定商品',surfaceIds:[]}
 const plan=validatePlan(raw,'保留实际存在的人物动物')
 assert.equal(plan.targetSurfaces.some(s=>s.preserve),false)
 assert.deepEqual(JSON.parse(generationRequest(plan,['gray','line'],'1:1',rules).params.prompt).productAssessment,raw.productAssessment)
})
test('有产品不能用无关墙面保留项替代真实产品保护',()=>{
 const raw=sample();raw.productAssessment={status:'present',evidence:'右侧可见空气净化器',surfaceIds:['p1']}
 assert.equal(validatePlan(raw,'产品').productAssessment.status,'present')
 raw.targetSurfaces[1]={...raw.targetSurfaces[0],id:'p1',target:'空气净化器'}
 raw.targetSurfaces[0]={id:'t1',target:'墙面',match:'preserve',preserve:true,uncertain:false,reason:'无对应材质'}
 assert.throws(()=>validatePlan(raw,'产品'),/实际产品保护/)
})
test('缺失、矛盾和不确定产品识别不能静默当成无产品',()=>{
 const raw=sample();raw.targetSurfaces.pop()
 for(const assessment of [undefined,{status:'absent',evidence:'',surfaceIds:[]},{status:'absent',evidence:'无人房间',surfaceIds:['t1']},{status:'uncertain',evidence:'角落看不清',surfaceIds:[]},{status:'present',evidence:'右侧产品',surfaceIds:['missing']}]){
  raw.productAssessment=assessment;assert.throws(()=>validatePlan(raw,'产品'))
 }
 const uncertain=sample();uncertain.productAssessment={status:'uncertain',evidence:'疑似设备，需要保守保护',surfaceIds:['p1']}
 assert.equal(validatePlan(uncertain,'产品').productAssessment.status,'uncertain')
})
test('有产品且用户明确授权改色，仍允许有界覆盖',()=>{
 const raw=sample();raw.productAssessment={status:'present',evidence:'右侧产品',surfaceIds:['p1']}
 raw.targetSurfaces[1]={...raw.targetSurfaces[0],id:'p1',target:'产品机身',color:'蓝色'}
 raw.execution={geometry:'preserve',product:'user_override',lighting:'preserve'}
 raw.resolvedInstructions=['仅产品机身改蓝，其余保持'];raw.adjustments=[]
 assert.equal(validatePlan(raw,'其余保护','产品机身改蓝').execution.product,'user_override')
})
