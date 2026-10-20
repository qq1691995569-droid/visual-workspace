import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir,homedir} from 'node:os'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {canvasSkill,eraseSelection} from '../server/canvas-skill.mjs'
test('独立技能读取，修改后立即生效且保留原快照',async()=>{
 for(const operation of ['edit','redraw','expand','erase','background','separate','upscale','white-background']){const s=await canvasSkill(operation);assert.equal(s.operation,operation);assert.equal(s.hash.length,64)}
 const root=await mkdtemp(path.join(tmpdir(),'canvas-rules-'))
 try{
  await mkdir(path.join(root,'canvas-redraw'))
  const file=path.join(root,'canvas-redraw/SKILL.md'),text=await readFile(new URL('../server/skills/canvas-redraw/SKILL.md',import.meta.url),'utf8')
  await writeFile(file,text)
  const url=pathToFileURL(root+path.sep),before=await canvasSkill('redraw',url)
  await writeFile(file,text.replace('version: 1','version: 2')+'\n只调整光线。')
  const after=await canvasSkill('redraw',url)
  assert.equal(before.version,1);assert.equal(after.version,2);assert.notEqual(before.hash,after.hash);assert.match(after.prompt,/只调整光线/)
  await assert.rejects(()=>canvasSkill('../redraw',url))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('消除拒绝空蒙版和异常坐标，支持单点',()=>{
 for(const value of [[],null,[[[NaN,1]]],[[[-1,100]]]])assert.throws(()=>eraseSelection(value))
 assert.deepEqual(eraseSelection([[[500,500]]]).strokes[0].points,[[.5,.5]])
})
test('像素合成：透明抠图、分层、消除保护及原尺寸增强',{timeout:30000},()=>{
 const python=process.env.CANVAS_PYTHON||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const code=`import io,json,base64,subprocess,sys
from PIL import Image,ImageDraw
def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def dec(src):return Image.open(io.BytesIO(base64.b64decode(src.split(',')[1])))
def run(body):
 p=subprocess.run([sys.executable,'server/asset_image.py'],input=json.dumps(body),text=True,capture_output=True,check=True);return json.loads(p.stdout)
base=Image.new('RGBA',(200,100),(80,20,140,128));src=enc(base)
mask=Image.new('RGB',(200,100),'black');ImageDraw.Draw(mask).rectangle((20,20,70,70),fill='white')
out=dec(run(dict(action='matte',base=src,result=enc(mask)))['image'])
assert out.getpixel((30,30))==base.getpixel((30,30));assert out.getpixel((0,0))[3]==0
whitebase=Image.new('RGB',(200,100),(243,241,240));ImageDraw.Draw(whitebase).rectangle((20,20,70,70),fill=(249,248,245))
noisy=Image.new('RGB',(200,100),(40,40,40));ImageDraw.Draw(noisy).rectangle((20,20,70,70),fill=(230,230,230))
white=dec(run(dict(action='white',base=enc(whitebase),result=enc(noisy)))['image'])
assert white.getpixel((0,0))==(255,255,255);assert white.getpixel((30,30))==whitebase.getpixel((30,30))
assert white.getpixel((100,90))==(255,255,255)
atlas=Image.new('RGB',(400,200),'black');atlas.paste(mask,(0,0));atlas.paste(Image.new('RGB',(200,100),'red'),(200,100))
layers=run(dict(action='layers',base=src,result=enc(atlas)))['layers'];assert len(layers)==2
assert dec(layers[1]['src']).getpixel((30,30))==base.getpixel((30,30))
assert dec(layers[0]['src']).getpixel((0,0))==base.convert('RGB').getpixel((0,0))
assert dec(layers[0]['src']).getpixel((30,30))==(255,0,0)
selection=dict(coordinateSpace='normalized-square',polygons=[],points=[],strokes=[dict(mode='add',width=.045,points=[[.5,.5]])])
out=dec(run(dict(action='composite',base=src,result=enc(Image.new('RGB',(200,100),'red')),**selection))['image'])
assert out.getpixel((100,50))==(255,0,0,255);assert out.getpixel((0,0))==base.getpixel((0,0));assert out.getpixel((100,55))==base.getpixel((100,55))
out=dec(run(dict(action='restore',base=src,result=enc(Image.new('RGB',(400,200),'red'))))['image']);assert out.size==(200,100);assert out.getpixel((0,0))[3]==128
`
 const result=spawnSync(python,['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)
})
