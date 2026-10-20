import test from 'node:test'
import assert from 'node:assert/strict'
import {cleanAsset,assetAnalysisPrompt,analysisCandidates,localEditPlan} from '../server/canvas-assets.mjs'
import {objectLocatePrompt} from '../server/object-selection.mjs'
import {personSheetPrompt,personViews} from '../server/person-assets.mjs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {homedir} from 'node:os'
test('person extraction keeps a separate reusable category and requires an appearance description',()=>{
  const image='data:image/png;base64,AAAA'
  const result=analysisCandidates({subjectObjects:[{name:'人物 A',promptZh:'短发，米白上衣，深色长裤',parts:[]}]},'person',image,'人物')
  assert.equal(cleanAsset(result.candidates[0]).kind,'person')
  assert.match(assetAnalysisPrompt('person','人物'),/不识别真实身份/)
  assert.ok(objectLocatePrompt('person',[.5,.5],'人物'))
  assert.throws(()=>localEditPlan({kind:'person',asset:result.candidates[0],target:'人物',points:[[0,0],[1,0],[1,1]],supplement:''}))
})
test('person sheet preserves role order and view records through storage validation',()=>{
  const image='data:image/png;base64,AAAA'
  const views=personViews.map(label=>({label,image}))
  const asset=cleanAsset({kind:'person',image,name:'人物',prompt:'短发',views})
  assert.deepEqual(asset.views,views)
  assert.equal(asset.image,views[0].image)
  assert.equal(cleanAsset({...asset,views:views.slice(0,2)}).views.length,2)
  assert.throws(()=>cleanAsset({...asset,views:views.slice(0,3)}))
  assert.match(personSheetPrompt('外观描述'),/#FFFFFF/)
  assert.match(personSheetPrompt('外观描述'),/正面站立全身/)
  assert.match(personSheetPrompt('外观描述'),/嘴唇和下半脸特写/)
})
test('person sheet crops nine distinct panels in the prescribed order',()=>{
  const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
  const code=`import io,base64,json,subprocess,sys
from PIL import Image
im=Image.new('RGB',(768,768));colors=['red','green','blue','yellow','white','black','gray','pink','orange'];boxes=[(c*256,r*256,(c+1)*256,(r+1)*256) for r in range(3) for c in range(3)]
for c,b in zip(colors,boxes):im.paste(c,b)
buf=io.BytesIO();im.save(buf,format='PNG')
r=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps({'action':'person_views','base':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()}),text=True,capture_output=True,check=True)
views=json.loads(r.stdout)['views']
assert len(views)==9
for i,v in enumerate(views):
 p=Image.open(io.BytesIO(base64.b64decode(v.split(',')[1])));assert p.size==(256,256);assert p.getpixel((128,128))==Image.new('RGB',(1,1),colors[i]).getpixel((0,0))
`
  const result=spawnSync(python,['-c',code],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
})
