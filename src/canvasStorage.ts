import { get, getMany, setMany, set, keys, delMany } from 'idb-keyval'
import { projectCatalog } from './projectCatalog'

let lastSource='',lastCover=Promise.resolve('')
function thumbnail(src:string){
 if(src===lastSource)return lastCover
 lastSource=src
 lastCover=(async()=>{const image=new Image();image.src=src;try{await image.decode();const canvas=document.createElement('canvas');const scale=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d')!;ctx.fillStyle='#eef2f7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.75)}catch{return ''}finally{image.removeAttribute('src')}})()
 return lastCover
}
export const canvasProjects=projectCatalog({get,getMany,setMany,delMany,keys:async()=>(await keys()).filter((k):k is string=>typeof k==='string')},thumbnail)
const storage = canvasProjects
export const readCanvasProject = storage.read
export const writeCanvasProject = storage.write
export const backupCanvasProject = (project: unknown) => set('visual-canvas-before-new', project)
export const readCanvasBackup = () => get('visual-canvas-before-new')
