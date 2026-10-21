from PIL import Image,ImageDraw
import numpy as np,io,base64,json
from pathlib import Path
rng=np.random.default_rng(42)
items=[]
y,x=np.mgrid[:1024,:1024]
for i in range(300):
 a=np.stack([(x*.12+y*.06+i*13)%220+15,(y*.15+i*7)%200+25,((x+y)*.08+i*17)%180+35],axis=2)
 a=np.clip(a+rng.normal(0,12,a.shape),0,255).astype('uint8')
 im=Image.fromarray(a);d=ImageDraw.Draw(im);d.rectangle((80,100,500,600),outline='white',width=12);d.ellipse((400,300,950,850),outline='black',width=9);d.text((100,120),'Canvas performance %03d'%i,fill='white',stroke_width=2)
 def enc(img):
  b=io.BytesIO();img.save(b,format='JPEG',quality=72);return 'data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode()
 items.append({'src':enc(im),'previewSrc':enc(im.resize((512,512)))})
Path('artifacts/perf-images.json').write_text(json.dumps(items))
print('300 distinct 1024px JPEG originals and 512px previews ready')
