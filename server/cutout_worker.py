"""Local rembg worker. Model/session reused; input images never leave this process."""
import sys,os,json,io,base64,time
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.canvas-runtime/packages'))
os.environ.setdefault('U2NET_HOME',str(root/'.canvas-runtime/models'))
os.environ.setdefault('OMP_NUM_THREADS','2')
from PIL import Image,ImageOps,ImageChops
from rembg import new_session,remove
Image.MAX_IMAGE_PIXELS=40_000_000
sessions={}
def process(body):
    model=body.get('model','u2netp')
    if model not in ('u2netp','u2net','isnet-general-use'):raise ValueError('Unsupported model')
    # Installation is explicit; inference must never silently download a model.
    if not (Path(os.environ['U2NET_HOME'])/(model+'.onnx')).is_file():raise ValueError('Model is not installed')
    if model not in sessions:sessions[model]=new_session(model,providers=['CPUExecutionProvider'])
    image=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(body['base'].split(',',1)[1])))).convert('RGBA')
    if image.width*image.height>40_000_000:raise ValueError('Image too large')
    start=time.perf_counter()
    mask=remove(image.convert('RGB'),session=sessions[model],only_mask=True).convert('L')
    if mask.getextrema()[1]<16:raise ValueError('No foreground found')
    image.putalpha(ImageChops.multiply(image.getchannel('A'),mask))
    output=io.BytesIO();image.save(output,format='PNG')
    return {'image':'data:image/png;base64,'+base64.b64encode(output.getvalue()).decode(),'width':image.width,'height':image.height,'elapsedMs':round((time.perf_counter()-start)*1000)}
for line in sys.stdin:
    try:print(json.dumps(process(json.loads(line))),flush=True)
    except Exception as error:print(json.dumps({'error':str(error)}),flush=True)
