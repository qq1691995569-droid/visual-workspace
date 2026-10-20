"""Scene style v1: exact PIL/numpy gray + structural contour recipe."""
import sys, json, base64, io
import numpy as np
from PIL import Image, ImageFilter, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000
raw = json.load(sys.stdin)
image = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(raw['image'].split(',', 1)[1]))))
if image.width * image.height > 40_000_000:
    raise ValueError('Image exceeds 40 megapixels')
gray = image.convert('L')
edges = np.asarray(gray.filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.FIND_EDGES), dtype=np.float32)
lo, hi = float(edges.min()), float(edges.max())
normalized = (edges - lo) * 255 / (hi - lo) if hi > lo else np.zeros_like(edges)
line = Image.fromarray(np.where(normalized >= 55, 0, 255).astype('uint8'))
line = ImageOps.invert(ImageOps.invert(line).filter(ImageFilter.MaxFilter(3)))
def encode(img):
    output = io.BytesIO()
    img.save(output, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()
print(json.dumps({'gray': encode(gray), 'line': encode(line), 'width': gray.width, 'height': gray.height}))
