import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {homedir} from 'node:os'
import path from 'node:path'
import {expansionPlan} from '../server/quick-edit.mjs'
test('扩图只接受包含原图的有效外扩范围',()=>{
  assert.deepEqual(expansionPlan({x:-.2,y:-.1,width:1.4,height:1.3}),{x:-.2,y:-.1,width:1.4,height:1.3})
  for(const frame of [{x:0,y:0,width:1,height:1},{x:.1,y:0,width:2,height:2},{x:-2,y:0,width:2,height:1},{x:0,y:0,width:NaN,height:2}])assert.throws(()=>expansionPlan(frame))
})
test('自由扩图尺寸准确且原图 RGBA 像素完全保留',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const code=`import io,json,base64,subprocess,sys
from PIL import Image

def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def run(body):
 p=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(body),text=True,capture_output=True,check=True);return json.loads(p.stdout)
base=Image.new('RGBA',(100,80),(80,20,140,128))
f={'x':-.2,'y':-.25,'width':1.5,'height':1.5}
args={'base':enc(base),'frame':f,'ratio':'4:3'}
p=run(dict(args,action='expand_prepare'));assert (p['width'],p['height'])==(150,120)
guide=Image.new('RGB',(160,120),'red');guide.paste(base.convert('RGB'),(20,20))
r=run(dict(args,action='expand_composite',result=enc(guide)))
bad=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(dict(args,action='expand_composite',result=enc(Image.new('RGB',(200,200),'red')))),text=True,capture_output=True)
assert bad.returncode!=0 and 'alignment check failed' in bad.stderr
out=Image.open(io.BytesIO(base64.b64decode(r['image'].split(',')[1])))
assert out.size==(150,120)
assert out.crop((20,20,120,100)).tobytes()==base.tobytes()
assert out.getpixel((0,0))==(255,0,0,255)
`
 const result=spawnSync(python,['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)
})

test('扩图亮度差渐进融合，保护中心、透明度与未扩展边界',()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const code=`import io,json,base64,subprocess,sys
from PIL import Image

def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def composite(base,frame,result,ratio):
 body=dict(action='expand_composite',base=enc(base),frame=frame,result=enc(result),ratio=ratio)
 p=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(body),text=True,capture_output=True,check=True)
 return Image.open(io.BytesIO(base64.b64decode(json.loads(p.stdout)['image'].split(',')[1])))
base=Image.new('RGBA',(400,300),(180,170,160,128))
result=Image.new('RGB',(600,500),(190,180,170))
out=composite(base,dict(x=-.25,y=-1/3,width=1.5,height=5/3),result,'6:5')
# The old hard paste produced a 10-level jump. Every perimeter now meets
# the generated scene, while its interior transitions monotonically.
for a,b in [((99,250),(100,250)),((499,250),(500,250)),((300,99),(300,100)),((300,399),(300,400))]:
 assert abs(out.getpixel(a)[0]-out.getpixel(b)[0])<=1
values=[out.getpixel((100+x,250))[0] for x in range(25)]
assert values[0]==190 and values[-1]==180
assert all(0<=a-b<=1 for a,b in zip(values,values[1:]))
assert out.crop((124,124,476,376)).tobytes()==base.crop((24,24,376,276)).tobytes()
assert out.crop((100,100,500,400)).getchannel('A').getextrema()==(128,128)
assert out.getpixel((0,0))==(190,180,170,255)
# Right-only extension does not fade top, bottom or left source boundaries.
one=composite(base,dict(x=0,y=0,width=1.5,height=1),Image.new('RGB',(600,300),(190,180,170)),'2:1')
for point in [(0,150),(200,0),(200,299),(200,150)]:
 assert one.getpixel(point)==base.getpixel(point)
assert one.getpixel((399,150))==(190,180,170,128)
# Small images still retain a protected centre.
small=composite(Image.new('RGB',(10,10),(180,170,160)),dict(x=-.5,y=-.5,width=2,height=2),Image.new('RGB',(20,20),(190,180,170)),'1:1')
assert small.getpixel((10,10))==(180,170,160,255)
`
 const result=spawnSync(python,['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)
})
