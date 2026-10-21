/* Uses the same color engine as the interactive workbench. */
importScripts('./color.js');
self.onmessage=async({data})=>{
  let base,reference;
  try {
    async function decode(src){const response=await fetch(src);if(!response.ok)throw Error('读取图片失败');const image=await createImageBitmap(await response.blob());if(image.width*image.height>50000000){image.close();throw Error('图片超过 5000 万像素')}return image}
    base=await decode(data.base);reference=await decode(data.reference);
    function sample(image){const scale=Math.min(1,1200/Math.max(image.width,image.height)),c=new OffscreenCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale))),ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);return SceneColor.stats(ctx.getImageData(0,0,c.width,c.height).data,new Uint8Array(c.width*c.height))}
    let parameters=data.parameters;
    if(!parameters){const a=sample(base),b=sample(reference);parameters={strength:70,naturalness:70,fidelity:70,warmth:Math.round(SceneColor.clamp(b.b-a.b,-18,18)),tint:Math.round(SceneColor.clamp((b.a-a.a)*.7,-8,8)),light:Math.round(SceneColor.clamp(b.l-a.l,-15,15)),saturation:0,contrast:0}}
    if(data.sample){self.postMessage({parameters});return}
    const canvas=new OffscreenCanvas(base.width,base.height),ctx=canvas.getContext('2d');ctx.drawImage(base,0,0);
    for(let y=0;y<canvas.height;y+=64){const h=Math.min(64,canvas.height-y),pixels=ctx.getImageData(0,y,canvas.width,h),out=ctx.createImageData(canvas.width,h);SceneColor.transform(pixels.data,out.data,parameters);ctx.putImageData(out,0,y);self.postMessage({progress:`正在调色 ${Math.round((y+h)/canvas.height*100)}%`})}
    const blob=await canvas.convertToBlob({type:'image/png'});self.postMessage({blob,parameters});
  }catch(error){self.postMessage({error:error.message||'调色失败'})}finally{base?.close();reference?.close()}
};
