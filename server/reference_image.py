"""Resize only the upload copy. Original canvas bytes are never modified."""
import sys, json, base64, io, math
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 120_000_000
body = json.load(sys.stdin)
value = body['image']
if not value.startswith('data:image/') or ';base64,' not in value:
    raise ValueError('Expected image data URL')
raw = base64.b64decode(value.split(',', 1)[1], validate=True)
image = Image.open(io.BytesIO(raw))
if image.width * image.height > 120_000_000:
    raise ValueError('Image exceeds local decoding budget')
image = ImageOps.exif_transpose(image)
w, h = image.size
limits = body['limits']
scale = min(1, limits['max_edge']/max(w,h), math.sqrt(limits['max_pixels']/(w*h)))
size = (max(1, math.floor(w*scale)), max(1, math.floor(h*scale)))
changed = size != (w,h) or len(raw) > limits['max_bytes']
if changed:
    alpha = image.mode in ('RGBA','LA') or 'transparency' in image.info
    image = image.convert('RGBA' if alpha else 'RGB')
    image = image.resize(size, Image.Resampling.LANCZOS)
    while True:
        output = io.BytesIO()
        image.save(output, format='PNG')
        data = output.getvalue()
        if len(data) <= limits['max_bytes']:
            break
        factor = min(.9, math.sqrt(limits['max_bytes']/len(data))*.95)
        smaller = (max(1, math.floor(image.width*factor)), max(1, math.floor(image.height*factor)))
        if smaller == image.size:
            raise ValueError('Unable to satisfy upload byte limit')
        image = image.resize(smaller, Image.Resampling.LANCZOS)
    value = 'data:image/png;base64,' + base64.b64encode(data).decode()
json.dump({'image':value,'originalWidth':w,'originalHeight':h,'width':image.width,'height':image.height,'resized':changed},sys.stdout)
