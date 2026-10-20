export function previewBounds(width:number,height:number,imageWidth:number,imageHeight:number,zoom:number){
 const fit=Math.min(width/Math.max(1,imageWidth),height/Math.max(1,imageHeight))
 return {width:imageWidth*fit,height:imageHeight*fit,x:Math.max(0,(imageWidth*fit*zoom-width)/2),y:Math.max(0,(imageHeight*fit*zoom-height)/2)}
}
export function clampPreview(point:{x:number;y:number},bounds:{x:number;y:number}){return {x:Math.max(-bounds.x,Math.min(bounds.x,point.x)),y:Math.max(-bounds.y,Math.min(bounds.y,point.y))}}
export function zoomPreview(point:{x:number;y:number},pan:{x:number;y:number},ratio:number){return {x:point.x-(point.x-pan.x)*ratio,y:point.y-(point.y-pan.y)*ratio}}
