import {readFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import path from 'node:path'
import {atomicJsonWriter} from './atomic-json.mjs'
import {openLuxConfig} from './openlux-native.mjs'

export const apiRouteDefinitions=[
 {id:'separate',name:'多图层',description:'原生图层拆分',compatible:['openlux','dreo']},
 {id:'interactive-edit',name:'框选编辑',description:'Seedream 5.0 Pro 坐标交互编辑',compatible:['openlux','dreo']},
 {id:'generate',name:'常规生图与旧版编辑',description:'现有 DREO 图像生成与未框选编辑流程',compatible:['dreo']},
]
const connectionNames={openlux:'OpenLux · Seedream 5.0 Pro',dreo:'DREO · Seedream 5.0 Pro'}

async function availableOpenLux(){try{return !!(await openLuxConfig())}catch{return false}}
async function availableDreo(){
 try{
  const file=process.env.CANVAS_DREO_CONFIG||path.join(homedir(),'.dreo-visual-lab','credentials.json')
  const config=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))
  return typeof config.origin==='string'&&!!config.origin&&typeof config.token==='string'&&!!config.token
 }catch{return false}
}

export function apiRoutingStore(directory,{definitions=apiRouteDefinitions,readiness={openlux:availableOpenLux,dreo:availableDreo}}={}){
 const file=path.join(directory,'api-routing.json')
 const legacy=path.join(directory,'separation-provider.json')
 const write=atomicJsonWriter()
 const known=new Map(definitions.map(route=>[route.id,route]))
 let updates=Promise.resolve()
 async function bindings(){
  try{
   const data=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))
   if(data.schema!==1||!data.bindings||typeof data.bindings!=='object'||Array.isArray(data.bindings))throw Error('API 路由配置无效')
   for(const [feature,provider] of Object.entries(data.bindings)){
    const route=known.get(feature)
    if(!route||!route.compatible.includes(provider))throw Error('API 路由配置无效')
   }
   return data.bindings
  }catch(error){if(error.code!=='ENOENT')throw error}
  try{
   const data=JSON.parse((await readFile(legacy,'utf8')).replace(/^\uFEFF/,''))
   if(data.schema!==1||!known.get('separate')?.compatible.includes(data.provider))throw Error('旧版多图层接口配置无效')
   return {separate:data.provider}
  }catch(error){if(error.code==='ENOENT')return {};throw error}
 }
 async function configured(){
  return Object.fromEntries(await Promise.all(Object.entries(readiness).map(async([id,check])=>[id,!!(await check())])))
 }
 function selected(route,saved,ready){return saved[route.id]||(['separate','interactive-edit'].includes(route.id)?ready.openlux?'openlux':ready.dreo?'dreo':route.compatible[0]:route.compatible[0])}
 async function get(){
  const [saved,ready]=await Promise.all([bindings(),configured()])
  return {
   connections:Object.keys(readiness).map(id=>({id,name:connectionNames[id]||id,configured:ready[id]})),
   features:definitions.map(route=>({id:route.id,name:route.name,description:route.description,compatible:route.compatible,provider:selected(route,saved,ready),editable:route.compatible.length>1,explicit:Object.hasOwn(saved,route.id)})),
  }
 }
 async function resolve(feature){
  const route=known.get(feature)
  if(!route)throw Error('未知的 API 功能')
  const [saved,ready]=await Promise.all([bindings(),configured()])
  const provider=selected(route,saved,ready)
  return {provider,configured:ready[provider]}
 }
 function set(feature,provider){
  const operation=updates.then(async()=>{
   const route=known.get(feature)
   if(!route||route.compatible.length<2||!route.compatible.includes(provider))throw Object.assign(Error('该功能不支持所选接口'),{status:400})
   if(!await readiness[provider]?.())throw Object.assign(Error('所选接口尚未配置'),{status:400})
   const current=await bindings()
   await write(file,{schema:1,bindings:{...current,[feature]:provider}})
   return get()
  })
  updates=operation.catch(()=>{})
  return operation
 }
 return {get,resolve,set}
}
