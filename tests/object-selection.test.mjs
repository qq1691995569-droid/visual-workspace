import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {objectLocatePrompt,locatedObject,validMark} from '../server/object-selection.mjs'
import {selectionStrokes,localEditPlan} from '../server/canvas-assets.mjs'
test('点选识别校验对象范围，不把空结果或越界范围当作识别成功',()=>{
 const result={schemaVersion:1,found:true,name:'沙发织物',points:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],confidence:'medium',notes:'遮挡待复核'}
 assert.equal(locatedObject(result,[.5,.5]).requiresReview,true)
 assert.throws(()=>locatedObject({...result,found:false},[.5,.5]),/未能可靠/)
 assert.throws(()=>locatedObject(result,[.99,.99]),/没有覆盖/)
 assert.throws(()=>locatedObject({...result,points:[[0,0],[1,0],[1,1],[0,1]]},[.5,.5]),/几乎整张/)
 assert.throws(()=>validMark([NaN,.5]),/点击标记/)
 assert.match(objectLocatePrompt('material',[.5,.5],'沙发'),/材质表面/)
 assert.match(objectLocatePrompt('model',[.5,.5]),/单个对象可见外轮廓/)
 assert.throws(()=>selectionStrokes([{mode:'subtract',width:20,points:[[.5,.5]]}]),/修边笔画/)
 assert.throws(()=>localEditPlan({points:result.points,asset:{kind:'material',image:'data:image/png;base64,AAAA',name:'布',prompt:'细纹'},selectionReviewed:false}),/确认/)
})
test('加选和减选笔画进入实际蒙版，减选区域与选区外像素都保持原图',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const r=spawnSync(python,['-c',`import io,json,base64,subprocess,sys
from PIL import Image
def encode(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
base=Image.new('RGB',(32,24),(12,34,56));result=Image.new('RGB',(32,24),(220,30,40))
data={'action':'composite','base':encode(base),'result':encode(result),'points':[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],'strokes':[{'mode':'subtract','width':.12,'points':[[.5,.5]]},{'mode':'add','width':.1,'points':[[.1,.1]]}]}
r=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(data),text=True,capture_output=True,check=True)
out=Image.open(io.BytesIO(base64.b64decode(json.loads(r.stdout)['image'].split(',')[1])))
assert out.getpixel((16,12))==(12,34,56)
assert out.getpixel((3,2))==(220,30,40)
assert out.getpixel((0,23))==(12,34,56)
assert out.getpixel((10,10))==(220,30,40)
print('brush mask verified')`],{encoding:'utf8'})
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/verified/)
})

test('多对象材质按编号绑定，拒绝未确认范围与对象资产混入',()=>{
 const asset={kind:'material',name:'织物',image:'data:image/png;base64,AAAA',prompt:'低光泽细纹'}
 const regions=[1,2,3,4].map((n)=>({target:'对象'+n,points:[[.1,.1],[.2,.1],[.2,.2],[.1,.2]],selectionReviewed:true,asset:{...asset,name:'材质'+n}}))
 const plan=localEditPlan({kind:'material',regions,supplement:'保留原色'})
 assert.equal(plan.referenceRoles.length,3)
 assert.deepEqual(plan.regions.map(r=>[r.id,r.guidance,r.asset.name]),[[1,'prompt','材质1'],[2,'prompt','材质2'],[3,'prompt','材质3'],[4,'prompt','材质4']])
 assert.throws(()=>localEditPlan({kind:'material',regions:[{...regions[0],selectionReviewed:false}],supplement:''}),/确认/)
 assert.throws(()=>localEditPlan({kind:'material',regions:[{...regions[0],asset:{...asset,kind:'model'}}],supplement:''}),/材质资产/)
})

test('多对象联合蒙版保留选区外像素，参考板保留各编号材质且阻止重叠',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const r=spawnSync(python,['-c',`import io,json,base64,subprocess,sys
from PIL import Image
def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def dec(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1])))
base=Image.new('RGB',(100,100),(12,34,56))
regions=[{'points':[[.1,.1],[.3,.1],[.3,.3],[.1,.3]],'asset':{'image':enc(Image.new('RGB',(480,530),'red'))}},{'points':[[.6,.6],[.8,.6],[.8,.8],[.6,.8]],'asset':{'image':enc(Image.new('RGB',(480,530),'blue'))}}]
def run(data,check=True): return subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(data),text=True,capture_output=True,check=check)
p=json.loads(run({'action':'prepare','base':enc(base),'regions':regions}).stdout)
a=dec(p['atlas']);assert a.getpixel((256,300))==(255,0,0);assert a.getpixel((768,300))==(0,0,255)
regions[0]['useImageReference']=False
mixed=dec(json.loads(run({'action':'prepare','base':enc(base),'regions':regions}).stdout)['atlas'])
assert mixed.getpixel((256,300))==(255,255,255);assert mixed.getpixel((768,300))==(0,0,255)
out=dec(json.loads(run({'action':'composite','base':enc(base),'regions':regions,'result':enc(Image.new('RGB',(100,100),'white'))}).stdout)['image'])
assert out.getpixel((20,20))==(255,255,255);assert out.getpixel((70,70))==(255,255,255)
assert out.getpixel((50,50))==(12,34,56);assert out.getpixel((99,0))==(12,34,56)
assert run({'action':'prepare','base':enc(base),'regions':[regions[0],regions[0]]},False).returncode!=0
regions[0]['polygons']=[regions[0]['points'],[[.6,.1],[.9,.1],[.9,.4],[.6,.4]]]
regions[0]['exclusions']=[[[.7,.2],[.8,.2],[.8,.3],[.7,.3]]]
parts=json.loads(run({'action':'prepare','base':enc(base),'regions':[regions[0]]}).stdout)
mask=dec(parts['mask']);outline=dec(parts['outline'])
assert mask.getpixel((20,20))==255 and mask.getpixel((65,15))==255
assert mask.getpixel((75,25))==0 and mask.getpixel((50,20))==0
assert outline.getpixel((59,20))==255 and outline.getpixel((10,20))==255
print('multi verified')`],{encoding:'utf8'})
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/multi verified/)
})

test('模型替换复用多对象编号，允许改所选造型并隔离材质资产',()=>{
 const asset={kind:'model',name:'圆润扶手椅',image:'data:image/png;base64,AAAA',prompt:'圆润椅背，木质椅腿，完整对象造型'}
 const regions=[1,2,3,4].map(n=>({target:'家具'+n,points:[[.1,.1],[.2,.1],[.2,.2],[.1,.2]],selectionReviewed:true,asset:{...asset,name:'模型'+n}}))
 const plan=localEditPlan({kind:'model',regions,supplement:'保持原落地位置'})
 assert.equal(plan.operation,'localized_multi_object_replacement')
 assert.deepEqual(plan.regions.map(r=>[r.id,r.referenceCell,r.asset.name]),[[1,1,'模型1'],[2,2,'模型2'],[3,3,'模型3'],[4,4,'模型4']])
 assert.match(plan.locks.objectGeometry,/仅替换对应编号对象造型/)
 assert.match(plan.locks.objectGeometry,/其他对象不变/)
 assert.equal(plan.locks.camera,true)
 assert.equal(plan.referenceRoles.length,4)
 assert.throws(()=>localEditPlan({kind:'model',regions:[{...regions[0],asset:{...asset,kind:'material'}}],supplement:''}),/模型资产/)
 assert.throws(()=>localEditPlan({kind:'model',regions:[{...regions[0],selectionReviewed:false}],supplement:''}),/确认/)
})

test('一次点选返回同一沙发的多个可见区域，并排除人物遮挡',()=>{
 const left=[[.1,.2],[.4,.2],[.4,.8],[.1,.8]],right=[[.6,.2],[.9,.2],[.9,.8],[.6,.8]],hole=[[.2,.3],[.3,.3],[.3,.5],[.2,.5]]
 const result={schemaVersion:1,found:true,name:'整张沙发软包',points:left,polygons:[left,right],exclusions:[hole],confidence:'medium'}
 const found=locatedObject(result,[.15,.6]);assert.equal(found.polygons.length,2);assert.deepEqual(found.exclusions,[hole])
 assert.throws(()=>locatedObject(result,[.25,.4]),/没有覆盖/)
 assert.throws(()=>locatedObject({...result,polygons:[]},[.15,.6]),/可见区域/)
 assert.match(objectLocatePrompt('material',[.15,.6]),/同一张沙发所有可见/)
 const plan=localEditPlan({kind:'material',spatialGuidance:'object-outline',regions:[{...found,target:found.name,selectionReviewed:true,mark:[.15,.6],asset:{kind:'material',name:'布',image:'data:image/png;base64,AAAA',prompt:'细纹'}}],supplement:''})
 assert.equal(plan.regions.length,1);assert.equal(plan.regions[0].visiblePolygons.length,2);assert.deepEqual(plan.regions[0].excludedPolygons,[hole])
})
