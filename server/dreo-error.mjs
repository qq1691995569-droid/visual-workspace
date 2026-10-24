import {safeTaskMessage} from './task-monitor.mjs'

const safeValue=value=>safeTaskMessage(value).replace(/\b[A-Za-z0-9_-]{32,}\b/g,'[标识已隐藏]').slice(0,180)
const safeField=value=>typeof value==='number'&&Number.isInteger(value)?String(value):typeof value==='string'&&/^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/.test(value)?value:''

// Only retain validation locations, types and short messages. Responses can echo
// image URLs, storage keys or request input, so never persist the raw body.
export function dreoValidationSummary(body){
  let parsed
  try{parsed=JSON.parse(body)}catch{return ''}
  const details=Array.isArray(parsed?.detail)?parsed.detail:[]
  const issues=details.slice(0,5).map(item=>{
    if(!item||typeof item!=='object')return ''
    const location=Array.isArray(item.loc)?item.loc.map(safeField).filter(Boolean).join('.'):''
    const message=typeof item.msg==='string'?safeValue(item.msg):''
    const type=safeField(item.type)
    return [location&&`字段 ${location}`,message,type&&`(${type})`].filter(Boolean).join(' ')
  }).filter(Boolean)
  if(issues.length)return issues.join('；').slice(0,600)
  const message=typeof parsed?.error==='string'?parsed.error:typeof parsed?.message==='string'?parsed.message:''
  return message?safeValue(message):''
}
