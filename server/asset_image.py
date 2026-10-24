import sys, json, base64, io
from PIL import Image, ImageDraw, ImageOps, ImageFilter, ImageChops, ImageStat
Image.MAX_IMAGE_PIXELS = 40_000_000

def load(value):
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(value.split(',',1)[1]))))
    image.load()
    return image.convert('RGB')

def encoded(image):
    buf=io.BytesIO(); image.save(buf,format='PNG')
    return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()

body=json.load(sys.stdin)
base=load(body['base']); w,h=base.size
if w*h>40_000_000: raise ValueError('image too large')
if body['action'] in ('native_separation_background','native_separation_layer'):
    source=Image.open(io.BytesIO(base64.b64decode(body['result'].split(',',1)[1])))
    source_format=source.format
    source=ImageOps.exif_transpose(source)
    if body['action']=='native_separation_background':
        if abs(source.width/source.height-w/h)/(w/h)>.015: raise ValueError('Background aspect changed')
        resized=source.size!=(w,h)
        output=source.convert('RGB').resize((w,h),Image.Resampling.LANCZOS) if resized else source.convert('RGB')
    else:
        if source_format!='PNG' or 'A' not in source.getbands(): raise ValueError('Layer is not transparent PNG')
        bounds=body.get('normalized')
        if not isinstance(bounds,list) or len(bounds)!=4 or not all(isinstance(v,(int,float)) and 0<=v<=1000 for v in bounds) or bounds[2]<=bounds[0] or bounds[3]<=bounds[1]: raise ValueError('Invalid layer coordinates')
        left=max(0,min(w-1,round(bounds[0]*w/1000)));top=max(0,min(h-1,round(bounds[1]*h/1000)))
        right=max(left+1,min(w,round(bounds[2]*w/1000)));bottom=max(top+1,min(h,round(bounds[3]*h/1000)))
        target=(right-left,bottom-top)
        if abs(source.width/source.height-target[0]/target[1])/(target[0]/target[1])>.15: raise ValueError('Layer aspect does not match its coordinates')
        layer=source.convert('RGBA')
        if layer.getchannel('A').getextrema()[1]<16: raise ValueError('Layer has no visible alpha')
        resized=layer.size!=target
        if resized: layer=layer.resize(target,Image.Resampling.LANCZOS)
        output=Image.new('RGBA',(w,h),(0,0,0,0));output.alpha_composite(layer,(left,top))
        if output.getchannel('A').getpixel((min(w-1,right),min(h-1,bottom)))!=0 and right<w and bottom<h: raise ValueError('Layer escaped its coordinates')
    json.dump({'image':encoded(output),'width':w,'height':h,'resized':resized},sys.stdout);sys.exit(0)
if body['action']=='separation_output':
    result=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(body['result'].split(',',1)[1])))).convert('RGBA')
    if abs(result.width/result.height-w/h)/(w/h)>.015: raise ValueError('Layer aspect changed')
    result=result.resize((w,h),Image.Resampling.LANCZOS)
    if body.get('transparent'):
        a=result.getchannel('A'); hist=a.histogram(); total=w*h
        if sum(hist[:16])/total<.01 or sum(hist[128:])/total<.0001: raise ValueError('No usable alpha')
        box=a.point(lambda v:255 if v>32 else 0).getbbox(); expected=body['bbox']
        cx=(box[0]+box[2])/2/w; cy=(box[1]+box[3])/2/h
        if abs(cx-expected['x']-expected['width']/2)>.15 or abs(cy-expected['y']-expected['height']/2)>.15: raise ValueError('Layer position changed')
    json.dump({'image':encoded(result),'width':w,'height':h},sys.stdout);sys.exit(0)
if body['action']=='inspect':
    json.dump({'width':w,'height':h},sys.stdout)
    sys.exit(0)
if body['action'] in ('expand_prepare','expand_composite'):
    import math
    f=body['frame']
    if not all(isinstance(f.get(k),(int,float)) and math.isfinite(f[k]) for k in ('x','y','width','height')): raise ValueError('invalid frame')
    if f['x']>0 or f['y']>0 or f['width']<1 or f['height']<1 or f['width']>4 or f['height']>4 or f['x']+f['width']<1 or f['y']+f['height']<1: raise ValueError('invalid expansion')
    left=round(-f['x']*w); top=round(-f['y']*h)
    width=max(left+w,round(f['width']*w)); height=max(top+h,round(f['height']*h))
    a,b=map(int,body['ratio'].split(':'))
    guide_w=max(width,math.ceil(height*a/b)); guide_h=max(height,math.ceil(width*b/a))
    if guide_w*guide_h>40_000_000: raise ValueError('expanded image too large')
    if body['action']=='expand_prepare':
        guide=Image.new('RGB',(guide_w,guide_h),(222,235,255)); guide.paste(base,(left,top))
        json.dump({'image':encoded(guide),'width':width,'height':height,'guideWidth':guide_w,'guideHeight':guide_h,'originalRect':{'x':left,'y':top,'width':w,'height':h}},sys.stdout)
    else:
        generated=load(body['result']).resize((guide_w,guide_h),Image.Resampling.LANCZOS).crop((0,0,width,height)).convert('RGBA')
        original=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(body['base'].split(',',1)[1])))).convert('RGBA')
        # Refuse a regenerated/reframed centre before restoring original pixels.
        # A hard paste over a shifted scene creates duplicate objects and rectangular seams.
        expected=base.resize((128,128),Image.Resampling.LANCZOS)
        actual=generated.crop((left,top,left+w,top+h)).convert('RGB').resize((128,128),Image.Resampling.LANCZOS)
        difference=ImageChops.difference(expected,actual)
        mean=sum(ImageStat.Stat(difference).mean)/3
        changed=sum(max(pixel)>35 for pixel in difference.getdata())/(128*128)
        if mean>12 or changed>.15:
            raise ValueError('Expansion alignment check failed: original region was moved or repainted; refusing a pasted seam')
        # Blend only the original's perimeter on sides that were expanded.
        # Smoothstep removes the hard RGB jump without blurring image detail;
        # the protected centre and original alpha channel remain exact.
        band=max(1,min(160,round(min(w,h)*.08)))
        def ramp(distance):
            t=min(1,max(0,distance/band))
            return round(255*t*t*(3-2*t))
        horizontal=Image.new('L',(w,1))
        horizontal.putdata([ramp(min(x if left>0 else band,
            w-1-x if left+w<width else band)) for x in range(w)])
        vertical=Image.new('L',(1,h))
        vertical.putdata([ramp(min(y if top>0 else band,
            h-1-y if top+h<height else band)) for y in range(h)])
        mask=ImageChops.darker(horizontal.resize((w,h)),vertical.resize((w,h)))
        patch=Image.composite(original,generated.crop((left,top,left+w,top+h)),mask)
        patch.putalpha(original.getchannel('A'))
        generated.paste(patch,(left,top))
        json.dump({'image':encoded(generated),'width':width,'height':height},sys.stdout)
    sys.exit(0)
if body['action'] in ('matte','white','layers','restore'):
    result=load(body['result'])
    original=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(body['base'].split(',',1)[1])))).convert('RGBA')
    if body['action']=='restore':
        result=result.resize((w,h),Image.Resampling.LANCZOS).convert('RGBA');result.putalpha(original.getchannel('A'))
        json.dump({'image':encoded(result)},sys.stdout);sys.exit(0)
    def alpha(image):
        r,g,b=image.split()
        if max(ImageChops.difference(r,g).resize((1,1)).getpixel((0,0)),ImageChops.difference(g,b).resize((1,1)).getpixel((0,0)))>18: raise ValueError('model did not return a grayscale matte')
        return image.convert('L').resize((w,h),Image.Resampling.LANCZOS).point(lambda v: 0 if v<12 else 255 if v>243 else v)
    if body['action'] in ('matte','white'):
        mask=alpha(result)
        lo,hi=mask.getextrema()
        if hi<32 or lo>223: raise ValueError('matte contains no usable foreground/background separation')
        if body['action']=='white':
            # Only the narrow silhouette boundary keeps soft alpha. A gray/noisy
            # background in the generated matte must not tint the white plate.
            binary=mask.point(lambda v:255 if v>=128 else 0)
            boundary=ImageChops.subtract(binary.filter(ImageFilter.MaxFilter(5)),binary.filter(ImageFilter.MinFilter(5)))
            mask=Image.composite(mask,binary,boundary)
        original.putalpha(ImageChops.multiply(mask,original.getchannel('A')))
        if body['action']=='white':
            clean=Image.new('RGBA',(w,h),(255,255,255,255));clean.alpha_composite(original);original=clean.convert('RGB')
        json.dump({'image':encoded(original)},sys.stdout);sys.exit(0)
    rw,rh=result.size
    if rw<128 or rh<128: raise ValueError('layer atlas too small')
    boxes=[(0,0,rw//2,rh//2),(rw//2,0,rw,rh//2),(0,rh//2,rw//2,rh),(rw//2,rh//2,rw,rh)]
    remaining=Image.new('L',(w,h),255);layers=[]
    for label,box in zip(['人物','产品与物件','家具'],boxes[:3]):
        mask=ImageChops.darker(alpha(result.crop(box)),remaining)
        if mask.getextrema()[1]<32: continue
        remaining=ImageChops.subtract(remaining,mask)
        layer=original.copy();layer.putalpha(ImageChops.multiply(mask,original.getchannel('A')))
        layers.append({'label':label,'src':encoded(layer)})
    if not layers: raise ValueError('no usable layers')
    background=result.crop(boxes[3]).resize((w,h),Image.Resampling.LANCZOS)
    # Preserve visible background exactly; fill only the removed foreground.
    background=Image.composite(base,background,remaining)
    layers.insert(0,{'label':'背景（遮挡区域 AI 补全）','src':encoded(background)})
    json.dump({'layers':layers},sys.stdout);sys.exit(0)
if body['action']=='person_views':
    if w<256 or h<256: raise ValueError('person sheet too small')
    boxes=[(col*w//3,row*h//3,(col+1)*w//3,(row+1)*h//3) for row in range(3) for col in range(3)]
    json.dump({'views':[encoded(base.crop(box)) for box in boxes]},sys.stdout)
    sys.exit(0)
def make_mask(region):
    if region.get('coordinateSpace')=='normalized-square':
        square=Image.new('L',(1000,1000),0);draw=ImageDraw.Draw(square)
        for stroke in region['strokes']:
            line=[(round(x*999),round(y*999)) for x,y in stroke['points']]
            size=max(1,round(stroke['width']*1000));radius=size/2
            if len(line)>1: draw.line(line,fill=255,width=size,joint='curve')
            for x,y in line: draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=255)
        mask=square.resize((w,h),Image.Resampling.NEAREST)
        if not mask.getbbox(): raise ValueError('empty selection')
        return mask
    mask=Image.new('L',base.size,0)
    def pixels(points):
        return [(max(0,min(w-1,round(x*(w-1)))),max(0,min(h-1,round(y*(h-1))))) for x,y in points]
    for polygon in region.get('polygons') or ([region['points']] if region.get('points') else []):
        ImageDraw.Draw(mask).polygon(pixels(polygon),fill=255)
    for polygon in region.get('exclusions') or []:
        ImageDraw.Draw(mask).polygon(pixels(polygon),fill=0)
    draw=ImageDraw.Draw(mask)
    for stroke in region.get('strokes') or []:
        line=[(round(x*(w-1)),round(y*(h-1))) for x,y in stroke['points']]
        width=max(1,round(stroke['width']*w)); radius=width/2
        color=255 if stroke['mode']=='add' else 0
        if len(line)>1: draw.line(line,fill=color,width=width,joint='curve')
        for x,y in line: draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=color)
    if not mask.getbbox(): raise ValueError('empty selection')
    return mask

regions=body.get('regions')
if regions:
    from PIL import ImageChops, ImageFont
    masks=[make_mask(region) for region in regions]
    mask=Image.new('L',base.size,0)
    for current in masks:
        overlap=ImageChops.darker(mask,current).histogram()[255]
        area=current.histogram()[255]
        if overlap>max(4,area*.05): raise ValueError('selected objects overlap; refine their boundaries')
        mask=ImageChops.lighter(mask,current)
else: mask=make_mask(body)
if body['action']=='composite':
    result=load(body['result']).resize(base.size,Image.Resampling.LANCZOS).convert('RGBA')
    original=ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(body['base'].split(',',1)[1])))).convert('RGBA')
    source_mode=Image.open(io.BytesIO(base64.b64decode(body['base'].split(',',1)[1])))
    if 'A' not in source_mode.getbands() and 'transparency' not in source_mode.info:
        original=original.convert('RGB');result=result.convert('RGB')
    output={'image':encoded(Image.composite(result,original,mask)),'width':w,'height':h}
else:
    box=mask.getbbox()
    if not box: raise ValueError('empty selection')
    crop=base.crop(box); crop.thumbnail((1600,1600))
    # Outline guidance is separate from the filled mask used by legacy compositing.
    # Draw each region independently so touching targets do not lose their boundary.
    outline=Image.new('L',base.size,0)
    thickness=max(2,min(9,round(min(w,h)*.002)))
    for current in (masks if regions else [mask]):
        inner=current.filter(ImageFilter.MinFilter(thickness*2+1))
        outline=ImageChops.lighter(outline,ImageChops.subtract(current,inner))
    output={'crop':encoded(crop),'mask':encoded(mask),'outline':encoded(outline),'width':w,'height':h}
    if regions:
        colors=['#8b5cf6','#06b6d4','#f59e0b','#ec4899']
        region_map=base.copy()
        atlas=Image.new('RGB',(1024,600*((len(regions)+1)//2)),'white')
        font=ImageFont.load_default(size=32)
        for index,(region,current) in enumerate(zip(regions,masks)):
            overlay=Image.new('RGB',base.size,colors[index])
            region_map=Image.composite(Image.blend(base,overlay,.5),region_map,current)
            box=current.getbbox();cx=(box[0]+box[2])//2;cy=(box[1]+box[3])//2
            # Place the label at a guaranteed foreground pixel near the center.
            if current.getpixel((cx,cy))==0:
                for yy in range(box[1],box[3]):
                    hit=False
                    for xx in range(box[0],box[2]):
                        if current.getpixel((xx,yy)):cx,cy=xx,yy;hit=True;break
                    if hit:break
            d=ImageDraw.Draw(region_map);r=max(14,round(w*.012));d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=colors[index],outline='white',width=max(2,r//8));d.text((cx,cy),str(index+1),fill='white',anchor='mm',font=font)
            x=(index%2)*512;y=(index//2)*600
            if region.get('useImageReference', True):
                ref=load(region['asset']['image']);ref.thumbnail((480,530))
                atlas.paste(ref,(x+(512-ref.width)//2,y+56+(530-ref.height)//2))
            ImageDraw.Draw(atlas).text((x+22,y+14),str(index+1),fill=colors[index],font=font)
        region_map.thumbnail((1800,1800))
        output['regionMap']=encoded(region_map);output['atlas']=encoded(atlas)

json.dump(output,sys.stdout)
