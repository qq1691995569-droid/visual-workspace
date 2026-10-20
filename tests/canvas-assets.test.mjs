import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { assetStore, selectionPoints, localEditPlan, analysisCandidates, assetAnalysisPrompt } from '../server/canvas-assets.mjs'
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const asset={kind:'material',name:'米白圈绒',image,prompt:'米白色细密圈绒，低光泽',tags:['沙发'],notes:'基材未知'}
test('资产持久化、去重与损坏文件容错，不把反推候选自动保存',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'canvas-assets-'))
 try {const store=assetStore(dir);assert.deepEqual(await store.list(),[]);const first=await store.save(asset);assert.equal(first.duplicate,false);assert.equal((await store.save(asset)).duplicate,true);const rows=await assetStore(dir).list();assert.equal(rows.length,1);assert.equal(rows[0].prompt,asset.prompt);assert.equal(rows[0].confidence,'unknown');await assert.rejects(store.save({...asset,prompt:''}),/提示词/)}
 finally {assert.equal(path.dirname(dir),tmpdir());await rm(dir,{recursive:true,force:true})}
})
test('局部编辑合同锁定未选像素和机位，材质保形，对象才允许改造型',()=>{
 const edit={kind:'material',target:'沙发表面',asset,points:[[.1,.1],[.8,.1],[.8,.8],[.1,.8]],supplement:'使用灰色，细纹保持'}
 const plan=localEditPlan(edit);assert.match(plan.defaultPreservation.objectGeometry,/保留原形状/);assert.equal(plan.supplement,edit.supplement);assert.match(plan.instructionPriority[0],/用户补充/)
 const model=localEditPlan({...edit,kind:'model',asset:{...asset,kind:'model'}});assert.match(model.locks.objectGeometry,/仅替换指定对象/)
 assert.throws(()=>selectionPoints([[0,0],[.5,.5],[1,1]]),/选区过小/);assert.throws(()=>selectionPoints([[-1,0],[1,0],[1,1]]),/有效/);assert.throws(()=>localEditPlan({...edit,kind:'model'}),/参数/)
})
test('画布独立反推合同保留不确定项；无有效材质结果时拒绝虚假候选',()=>{
 const input={subjectObjects:[{name:'沙发',promptZh:'沙发造型',parts:[{partZh:'沙发表面',promptZh:asset.prompt,substrateZh:'未知',confidence:'low',evidenceZh:'光照偏色待核对'}]}],warnings:['颜色待核对']}
 const result=analysisCandidates(input,'material',image,'沙发');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].confidence,'low');assert.match(result.candidates[0].notes,/未知/);assert.match(result.candidates[0].notes,/光照偏色/)
 assert.equal(analysisCandidates(input,'model',image,'沙发').candidates[0].prompt,'沙发造型');assert.throws(()=>analysisCandidates({},'material',image,'地毯'),/完整/)
})
test('独立资产分析区分表面材质与对象造型，名称按数据传递',()=>{
 const material=assetAnalysisPrompt('material','地毯')
 assert.match(material,/不写物体造型/);assert.match(material,/内部基材写未知/)
 assert.match(assetAnalysisPrompt('model','沙发'),/二维模型／对象外观/)
 assert.match(assetAnalysisPrompt('model','沙发'),/不声称已经抠图/)
 assert.throws(()=>assetAnalysisPrompt('other','沙发'),/有效/)
})
test('蒙版外逐像素保留原图，结果不同尺寸时仍保持原图尺寸',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const result=spawnSync(python,['-c',`import io,json,base64,subprocess,sys
from PIL import Image
def encode(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
base=Image.new('RGB',(32,24),(12,34,56));result=Image.new('RGB',(64,48),(220,30,40))
data={'action':'composite','base':encode(base),'result':encode(result),'points':[[.25,.25],[.75,.25],[.75,.75],[.25,.75]]}
r=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(data),text=True,capture_output=True,check=True)
out=Image.open(io.BytesIO(base64.b64decode(json.loads(r.stdout)['image'].split(',')[1])))
assert out.size==(32,24)
for y in range(24):
 for x in range(32):
  if x<8 or x>23 or y<6 or y>17: assert out.getpixel((x,y))==base.getpixel((x,y)),(x,y)
assert out.getpixel((16,12))==(220,30,40)
print('outside pixels unchanged')`],{encoding:'utf8'})
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/unchanged/)
})

test('删除资产按编号隔离、持久生效，拒绝路径注入，保存与删除串行',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'canvas-assets-delete-'))
 try {
  const store=assetStore(dir), first=await store.save(asset), second=await store.save({...asset,prompt:'另一种纹理'})
  const snapshot=structuredClone(first.asset), revision=await store.revision()
  assert.equal(await store.revision(),revision)
  await assert.rejects(store.remove('../outside'),/编号无效/)
  await Promise.all([store.save(asset),store.remove(first.asset.id)])
  assert.deepEqual((await assetStore(dir).list()).map(a=>a.id),[second.asset.id])
  assert.equal(snapshot.image,image)
  assert.notEqual(await store.revision(),revision)
  await store.remove(first.asset.id)
  assert.equal((await store.save(asset)).duplicate,false)
 } finally {assert.equal(path.dirname(dir),tmpdir());await rm(dir,{recursive:true,force:true})}
})

test('轮廓定位图只有选中目标白线，内部和外部保持黑色，填充蒙版独立保留',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const result=spawnSync(python,['-c',`import io,json,base64,subprocess,sys
from PIL import Image
b=io.BytesIO();Image.new('RGB',(100,100),'red').save(b,format='PNG')
data={'action':'prepare','base':'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode(),'points':[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]}
r=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(data),text=True,capture_output=True,check=True)
out=json.loads(r.stdout)
def load(key):return Image.open(io.BytesIO(base64.b64decode(out[key].split(',')[1]))).convert('L')
outline=load('outline');mask=load('mask')
assert outline.size==(100,100)
assert outline.getpixel((20,50))==255
assert outline.getpixel((50,50))==0
assert outline.getpixel((5,5))==0
assert mask.getpixel((50,50))==255
assert set(outline.getdata())=={0,255}
print('outline verified')`],{encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
