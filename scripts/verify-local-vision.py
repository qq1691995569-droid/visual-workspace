"""Run real local-engine smoke checks on a user-supplied sample (no remote calls)."""
from pathlib import Path
import sys,json,base64,io,subprocess,time,os
from PIL import Image,ImageDraw,ImageChops
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/vision-trial';out.mkdir(parents=True,exist_ok=True)
source=Image.open(sys.argv[1]).convert('RGBA');source.thumbnail((384,384));source.save(out/'source.png')
def enc(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
operations=sys.argv[2:] or ['background','erase','upscale']
report=[]
for op in operations:
 mask=Image.new('L',source.size,0);ImageDraw.Draw(mask).rectangle((source.width*.55,source.height*.78,source.width-1,source.height*.98),fill=255)
 body={'operation':op,'base':enc(source),'mask':enc(mask),'settings':{'scale':1}}
 request=out/(op+'-request.json');result=out/(op+'-result.json');request.write_text(json.dumps(body),encoding='utf-8')
 start=time.time();run=subprocess.run([sys.executable,str(root/'server/local-vision.py'),str(request),str(result)],cwd=root,env={**os.environ,'PYTHONUTF8':'1','OMP_NUM_THREADS':'4'},text=True,capture_output=True,encoding='utf-8')
 if run.returncode:print(run.stderr,flush=True);raise SystemExit(run.returncode)
 data=json.loads(result.read_text(encoding='utf-8'))['images'][0]['src'];image=Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGBA');image.save(out/(op+'.png'))
 assert image.size==source.size
 if op=='erase':
  diff=ImageChops.difference(source,image).convert('RGB');diff.paste((0,0,0),(0,0),mask);assert diff.getbbox() is None
 if op=='upscale':assert ImageChops.difference(source.getchannel('A'),image.getchannel('A')).getbbox() is None
 if op=='background':assert image.getchannel('A').getextrema()[0]<255 and image.getchannel('A').getextrema()[1]>0
 report.append({'operation':op,'seconds':round(time.time()-start,1),'size':image.size});print(report[-1],flush=True)
(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
