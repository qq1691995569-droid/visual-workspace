from pathlib import Path
import urllib.request,hashlib,concurrent.futures,json
root=Path(__file__).resolve().parents[1]
models=root/'.canvas-runtime/models'
comfy=root/'.canvas-runtime/ComfyUI/models'
items=[
(models/'birefnet-general.onnx','https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx','7a35a0141cbbc80de11d9c9a28f52697'),
(models/'big-lama.pt','https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt','e3aa4aaa15225a33ec84f9f4bc47e500'),
(models/'RealESRGAN_x2plus.pth','https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',None),
(comfy/'diffusion_models/qwen_image_layered_fp8mixed.safetensors','https://huggingface.co/Comfy-Org/Qwen-Image-Layered_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_layered_fp8mixed.safetensors',None),
(comfy/'text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors','https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors',None),
(comfy/'vae/qwen_image_layered_vae.safetensors','https://huggingface.co/Comfy-Org/Qwen-Image-Layered_ComfyUI/resolve/main/split_files/vae/qwen_image_layered_vae.safetensors',None)]
def download(item):
 p,url,md5=item;p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():
  if md5:
   with p.open('rb') as f:
    if hashlib.file_digest(f,'md5').hexdigest()!=md5:raise RuntimeError('Existing model checksum mismatch: '+p.name)
  return str(p.name)+' exists'
 temp=p.with_suffix(p.suffix+'.part')
 offset=temp.stat().st_size if temp.exists() else 0
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':'bytes=0-0'}),timeout=45) as response:
  direct=response.geturl();content_range=response.headers.get('Content-Range')
  if not content_range:raise RuntimeError('Server does not support resumable download: '+p.name)
  length=int(content_range.rsplit('/',1)[1])
 def chunk(bounds):
  start,end=bounds
  for attempt in range(4):
   try:
    with urllib.request.urlopen(urllib.request.Request(direct,headers={'Range':f'bytes={start}-{end}'}),timeout=45) as response:
     if response.status!=206 or not response.headers.get('Content-Range','').startswith(f'bytes {start}-'):raise RuntimeError('Invalid range response')
     data=response.read()
     if len(data)!=end-start+1:raise RuntimeError('Incomplete chunk')
    return data
   except Exception:
    if attempt==3:raise
 chunk_size=1024*1024
 workers=16
 with temp.open('ab') as out,concurrent.futures.ThreadPoolExecutor(max_workers=workers) as parts:
  size=offset
  while size<length:
   ranges=[(start,min(length-1,start+chunk_size-1)) for start in range(size,min(length,size+workers*chunk_size),chunk_size)]
   for data in parts.map(chunk,ranges):out.write(data);out.flush();size+=len(data)
   print(p.name+' '+str(round(size/length*100,1))+'%',flush=True)
 if size!=length:raise RuntimeError('incomplete '+p.name)
 if md5:
  with temp.open('rb') as f:
   if hashlib.file_digest(f,'md5').hexdigest()!=md5:raise RuntimeError('checksum '+p.name)
 temp.replace(p)
 return p.name+' ready '+str(size)
if __name__=='__main__':
 errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for f in concurrent.futures.as_completed([pool.submit(download,item) for item in items]):
   try:print(f.result(),flush=True)
   except Exception as e:errors.append(str(e));print(type(e).__name__,str(e),flush=True)
 if errors:raise SystemExit(1)
