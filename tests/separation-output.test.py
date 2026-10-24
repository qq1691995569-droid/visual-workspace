import base64,io,json,subprocess,sys,unittest
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent.parent
def data(image):
 b=io.BytesIO();image.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
class Outputs(unittest.TestCase):
 def run_output(self,image):
  body={'action':'separation_output','base':data(Image.new('RGB',(100,100),'gray')),'result':data(image),'transparent':True,'bbox':{'x':.2,'y':.2,'width':.4,'height':.4}}
  return subprocess.run([sys.executable,str(root/'server/asset_image.py')],input=json.dumps(body),text=True,capture_output=True)
 def test_opaque_white_is_rejected(self):
  self.assertNotEqual(self.run_output(Image.new('RGBA',(100,100),'white')).returncode,0)
 def test_real_alpha_keeps_full_frame(self):
  image=Image.new('RGBA',(100,100));image.paste((100,80,60,255),(20,20,60,60));p=self.run_output(image);self.assertEqual(p.returncode,0,p.stderr);result=json.loads(p.stdout);self.assertEqual((result['width'],result['height']),(100,100))
 def test_native_cropped_layer_is_padded_to_original_coordinates(self):
  layer=Image.new('RGBA',(30,40),(100,80,60,255))
  body={'action':'native_separation_layer','base':data(Image.new('RGB',(100,100),'gray')),'result':data(layer),'normalized':[100,200,400,600]}
  p=subprocess.run([sys.executable,str(root/'server/asset_image.py')],input=json.dumps(body),text=True,capture_output=True)
  self.assertEqual(p.returncode,0,p.stderr)
  image=Image.open(io.BytesIO(base64.b64decode(json.loads(p.stdout)['image'].split(',')[1])))
  self.assertEqual(image.size,(100,100));self.assertEqual(image.getpixel((20,30)),(100,80,60,255));self.assertEqual(image.getpixel((0,0))[3],0)
 def test_native_layer_rejects_opaque_file_without_alpha(self):
  body={'action':'native_separation_layer','base':data(Image.new('RGB',(100,100),'gray')),'result':data(Image.new('RGB',(30,40),'white')),'normalized':[100,200,400,600]}
  p=subprocess.run([sys.executable,str(root/'server/asset_image.py')],input=json.dumps(body),text=True,capture_output=True)
  self.assertNotEqual(p.returncode,0)
if __name__=='__main__':unittest.main()
