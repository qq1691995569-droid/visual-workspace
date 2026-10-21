import {buildFigmaClipboard,type ClipboardImage} from './figmaClipboard'
self.onmessage=async(event:MessageEvent<ClipboardImage[]>)=>{
  try{self.postMessage({html:await buildFigmaClipboard(event.data)})}
  catch(error){self.postMessage({error:error instanceof Error?error.message:'多图复制失败'})}
}
