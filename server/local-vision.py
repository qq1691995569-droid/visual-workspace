"""Dedicated local image engines. No network/model download during inference."""
import sys,json,io,base64,os
from pathlib import Path
from PIL import Image,ImageOps,ImageChops
ROOT=Path(__file__).resolve().parents[1]
MODELS=Path(os.environ.get('CANVAS_RUNTIME_DIR',str(ROOT/'.canvas-runtime')))/'models'
Image.MAX_IMAGE_PIXELS=40_000_000

def emit(message):print(json.dumps({'message':message},ensure_ascii=True),flush=True)
def decode(src):
 im=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(src.split(',',1)[1]))));im.load()
 if im.width*im.height>40_000_000:raise ValueError('Image too large')
 return im.convert('RGBA')
def encode(im):
 out=io.BytesIO();im.save(out,format='PNG');return 'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()
def tensor(im,device):
 import numpy as np,torch
 return torch.from_numpy(np.asarray(im,dtype='float32').copy()/255).permute(2,0,1).unsqueeze(0).to(device)
def image(t):
 import numpy as np
 return Image.fromarray((t[0].detach().float().cpu().permute(1,2,0).numpy().clip(0,1)*255).round().astype(np.uint8))
def process(body):
 base=decode(body['base']);op=body['operation'];settings=body['settings']
 if op=='background':
  os.environ['U2NET_HOME']=str(MODELS)
  # CPU ONNX avoids CUDA/cuDNN runtime mismatches; model quality is identical.
  from rembg import new_session,remove
  if not (MODELS/'birefnet-general.onnx').is_file():raise ValueError('BiRefNet model is not installed')
  emit('BiRefNet · 正在精细分离前景')
  session=new_session('birefnet-general',providers=['CPUExecutionProvider'])
  mask=remove(base.convert('RGB'),session=session,only_mask=True).convert('L')
  if mask.getextrema()[1]<16:raise ValueError('No usable foreground')
  base.putalpha(ImageChops.multiply(base.getchannel('A'),mask));return [{'src':encode(base),'review':{'protection':'BiRefNet；保留原始颜色与尺寸，复杂前景需复核'}}]
 import torch
 torch.set_num_threads(4)
 device='cuda' if torch.cuda.is_available() else 'cpu'
 if op=='erase':
  import numpy as np
  emit('LaMa · 正在修复涂抹区域')
  mask=decode(body['mask']).convert('L');w,h=base.size
  if mask.size!=base.size or not mask.getbbox():raise ValueError('Invalid erase mask')
  # Limit inference size; only selected source pixels are composited back.
  work=base.convert('RGB');work.thumbnail((1536,1536));mw,mh=work.size
  m=mask.resize(work.size,Image.Resampling.NEAREST)
  t=tensor(work,device);mt=torch.from_numpy((np.asarray(m)>0).astype('float32')).unsqueeze(0).unsqueeze(0).to(device)
  pad=(0,(-mw)%8,0,(-mh)%8)
  t=torch.nn.functional.pad(t,pad,mode='replicate');mt=torch.nn.functional.pad(mt,pad)
  with (MODELS/'big-lama.pt').open('rb') as checkpoint:
   model=torch.jit.load(checkpoint,map_location=device).eval()
  with torch.inference_mode():out=image(model(t,mt))
  out=out.crop((0,0,mw,mh)).resize((w,h),Image.Resampling.LANCZOS).convert('RGBA');out.putalpha(base.getchannel('A'))
  out=Image.composite(out,base,mask)
  return [{'src':encode(out),'review':{'protection':'LaMa 局部修复；蒙版外原始像素不变'}}]
 if op=='upscale':
  from spandrel import ModelLoader
  emit('Real-ESRGAN · 正在分块增强')
  scale=int(settings.get('scale',1));w,h=base.size
  if scale not in (1,2) or w*h*4>40_000_000:raise ValueError('Upscale image exceeds size limit')
  model=ModelLoader(device=device).load_from_file(str(MODELS/'RealESRGAN_x2plus.pth')).eval()
  out=Image.new('RGB',(w*2,h*2));rgb=base.convert('RGB');tile=256;pad=24
  total=((w+tile-1)//tile)*((h+tile-1)//tile);count=0
  with torch.inference_mode():
   for y in range(0,h,tile):
    for x in range(0,w,tile):
     right=min(w,x+tile);bottom=min(h,y+tile);box=(max(0,x-pad),max(0,y-pad),min(w,right+pad),min(h,bottom+pad))
     processed=image(model(tensor(rgb.crop(box),device)))
     out.paste(processed.crop(((x-box[0])*2,(y-box[1])*2,(right-box[0])*2,(bottom-box[1])*2)),(x*2,y*2))
     count+=1;emit('Real-ESRGAN · 分块 '+str(count)+'/'+str(total))
  out=out.resize((w*scale,h*scale),Image.Resampling.LANCZOS).convert('RGBA');out.putalpha(base.getchannel('A').resize(out.size,Image.Resampling.LANCZOS))
  return [{'src':encode(out),'review':{'protection':'Real-ESRGAN；未启用人脸重绘，文字细节需复核'}}]
 raise ValueError('Unsupported local operation')
if __name__=='__main__':
 try:
  body=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
  result=process(body)
  Path(sys.argv[2]).write_text(json.dumps({'images':result}),encoding='utf-8')
 except Exception as e:
  import traceback
  traceback.print_exc(file=sys.stderr);sys.exit(1)
