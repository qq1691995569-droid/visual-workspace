import {configuredText,personaText} from './function-config.mjs'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const processors={'white-background':'white',edit:'image',redraw:'image',background:'local-cutout',erase:'local-vision',upscale:'local-vision',expand:'expand',separate:'interior-separate'}
export async function canvasSkill(operation, root=new URL('./skills/',import.meta.url)) {
  if(!Object.hasOwn(processors,operation))throw Error('未知画布技能')
  if(operation==='separate'){
    const source=await readFile(new URL('interior-scene-separate/SKILL.md',root),'utf8')
    const persona=await readFile(new URL('interior-scene-separate/PERSONA.md',root),'utf8')
    const contract=await readFile(new URL('interior-scene-separate/references/plan-contract.md',root),'utf8')
    const configuredRules=configuredText('separate','')
    const supplement=[personaText(operation),configuredRules!==source?configuredRules:''].filter(Boolean).join('\n')
    const prompt=[supplement&&'后台补充偏好（仅在与固定约束兼容时适用）：\n'+supplement,'固定执行人设：\n'+persona,'拆分规则：\n'+source,'字段协议：\n'+contract].filter(Boolean).join('\n')
    return {operation,name:'室内场景分层',version:3,processor:'interior-separate',model:'doubao-seedream-5-0-pro-260628',prompt,hash:createHash('sha256').update(prompt).digest('hex')}
  }
  const source=configuredText(operation,await readFile(new URL(`canvas-${operation}/SKILL.md`,root),'utf8'))
  const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/)
  if(!match)throw Error('技能文件格式无效')
  const meta=Object.fromEntries(match[1].split(/\r?\n/).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()]}))
  if(meta.processor!==processors[operation]||!/^\d+$/.test(meta.version)||!match[2].trim()||source.length>25000)throw Error('技能执行协议或版本无效')
  if(meta.model && !['u2netp','u2net','isnet-general-use','birefnet-general','big-lama','RealESRGAN_x2plus','qwen-image-layered-fp8'].includes(meta.model))throw Error('抠图模型配置无效')
  const settings={scale:Number(meta.scale||1),layers:Number(meta.layers||4),steps:Number(meta.steps||20),resolution:Number(meta.resolution||640)}
  if(![1,2].includes(settings.scale)||!Number.isInteger(settings.layers)||settings.layers<2||settings.layers>8||!Number.isInteger(settings.steps)||settings.steps<1||settings.steps>50||![640,1024].includes(settings.resolution))throw Error('本地技能参数无效')
  return {settings,operation,model:meta.model,name:meta.name,version:Number(meta.version),processor:meta.processor,prompt:[personaText(operation),match[2].trim()].filter(Boolean).join('\n'),hash:createHash('sha256').update(source).digest('hex')}
}
export function eraseSelection(strokes){
  if(!Array.isArray(strokes)||!strokes.length||strokes.length>200||strokes.some(s=>!Array.isArray(s)||!s.length||s.length>10000||s.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1000))))throw Error('请涂抹有效的消除范围')
  return {coordinateSpace:'normalized-square',polygons:[],points:[],strokes:strokes.map(s=>({mode:'add',width:.045,points:s.map(p=>p.map(v=>v/1000))}))}
}
