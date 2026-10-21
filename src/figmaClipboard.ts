import {composeClipboardHtml,encodeFigmaData} from '@figit/fig-kiwi'

export type ClipboardImage = {src:string;label:string;x:number;y:number;width:number;height:number}
export async function buildFigmaClipboard(images:ClipboardImage[]) {
  if(!images.length || images.length>50)throw Error('一次最多复制 50 张图片到 Figma')
  const guid=(localID:number)=>({sessionID:0,localID})
  const transform=(x=0,y=0)=>({m00:1,m01:0,m02:x,m10:0,m11:1,m12:y})
  const left=Math.min(...images.map(i=>i.x)),top=Math.min(...images.map(i=>i.y))
  const nodes:Record<string,unknown>[]=[
    {guid:guid(0),phase:'CREATED',type:'DOCUMENT',name:'Document',visible:true,opacity:1,transform:transform()},
    {guid:guid(1),phase:'CREATED',type:'CANVAS',name:'Page',parentIndex:{guid:guid(0),position:'!'},visible:true,opacity:1,transform:transform()},
  ]
  const blobs:{bytes:Uint8Array}[]=[]
  let total=0
  for(const [i,image] of images.entries()){
    const response=await fetch(image.src)
    if(!response.ok)throw Error('无法读取图片')
    const blob=await response.blob()
    total+=blob.size
    if(total>100*1024*1024)throw Error('图片总量过大，请分批复制')
    const bitmap=await createImageBitmap(blob)
    const width=bitmap.width,height=bitmap.height
    bitmap.close()
    const bytes=new Uint8Array(await blob.arrayBuffer())
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',bytes))
    blobs.push({bytes})
    nodes.push({guid:guid(i+2),phase:'CREATED',type:'ROUNDED_RECTANGLE',name:image.label||`图片 ${i+1}`,
      parentIndex:{guid:guid(1),position:String.fromCharCode(33+i)},visible:true,opacity:1,
      size:{x:image.width||width,y:(image.width||width)*height/width},transform:transform(image.x-left,image.y-top),
      fillPaints:[{type:'IMAGE',opacity:1,visible:true,blendMode:'NORMAL',image:{hash,name:'image',dataBlob:i},
        imageScaleMode:'FIT',transform:transform(),originalImageWidth:width,originalImageHeight:height}]})
  }
  const pasteID=Math.floor(Math.random()*0x7fffffff)
  const {base64}=encodeFigmaData({type:'NODE_CHANGES',sessionID:0,ackID:0,pasteID,isCut:false,pasteEditorType:'DESIGN',nodeChanges:nodes,blobs})
  return composeClipboardHtml(base64,{dataType:'scene',fileKey:'visual-canvas',pasteID})
}
