import {projectAssetStore} from './projectAssetStore'
type IO={get:(key:string)=>Promise<unknown>;getMany:(keys:string[])=>Promise<unknown[]>;setMany:(entries:[string,unknown][])=>Promise<void>;keys:()=>Promise<string[]>}
export type ProjectSummary={id:string;name:string;updatedAt:number;createdAt:number;count:number;cover?:string;coverVersion?:number;deletedAt?:number}
type Doc={name:string;nodes:{data:{src?:string;previewSrc?:string;kind?:string}}[];[key:string]:unknown}
const activeKey='canvas-project-active',prefix='canvas-project-meta:'
export function projectCatalog(io:IO,cover:(src:string)=>Promise<string>=async()=> '') {
 let active:string|undefined,initializing:Promise<string>|undefined
 const stores=new Map<string,ReturnType<typeof projectAssetStore>>()
 const metadata=new Map<string,ProjectSummary>()
 function store(id:string){if(!stores.has(id))stores.set(id,projectAssetStore({...io,setMany:entries=>io.setMany([...entries,...(metadata.has(id)?[[prefix+id,metadata.get(id)!] as [string,unknown]]:[])])},'canvas-project-doc:'+id));return stores.get(id)!}
 async function save(id:string,doc:Doc){
  const prior=await io.get(prefix+id) as ProjectSummary|undefined
  if(prior?.deletedAt)throw Error('项目已在回收站，不能保存')
  const image=doc.nodes.find(n=>n.data.src)?.data
  const meta:ProjectSummary={id,name:doc.name||'未命名画布',createdAt:prior?.createdAt||Date.now(),updatedAt:Date.now(),coverVersion:2,count:doc.nodes.filter(n=>n.data.kind==='image').length,cover:image?await cover(image.previewSrc||image.src!):undefined}
  // Document/assets and its summary must commit together.
  metadata.set(id,meta)
  try{await store(id).write(doc)}finally{metadata.delete(id)}
 }
 async function ensure(){
  if(active)return active
  if(!initializing)initializing=(async()=>{
   const existing=await io.get(activeKey)
   if(typeof existing==='string'&&await io.get('canvas-project-doc:'+existing)){active=existing;return existing}
   const legacy=await projectAssetStore(io).read() as Doc|undefined
   const id=crypto.randomUUID()
   await save(id,legacy||{format:'visproj',schemaVersion:1,name:'未命名画布',nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}})
   await io.setMany([[activeKey,id]]);active=id;return id
  })().catch(error=>{initializing=undefined;throw error})
  return initializing
 }
 return {
  active:ensure,
  read:async()=>store(await ensure()).read(),
  write:async(doc:unknown)=>save(await ensure(),doc as Doc),
  list:async()=>{
   await ensure()
   const keys=(await io.keys()).filter(k=>k.startsWith(prefix))
   const items=await io.getMany(keys) as ProjectSummary[]
   for(let i=0;i<items.length;i++){
    const meta=items[i]
    if(meta.coverVersion===2)continue
    const doc=await store(meta.id).read() as Doc|undefined
    const image=doc?.nodes.find(n=>n.data.src)?.data
    const nextCover=image?await cover(image.previewSrc||image.src!):undefined
    if(image&&!nextCover)continue
    const latest=await io.get(prefix+meta.id) as ProjectSummary|undefined
    // Preserve changes made while the thumbnail was decoding.
    if(!latest||latest.updatedAt!==meta.updatedAt||latest.coverVersion===2){if(latest)items[i]=latest;continue}
    items[i]={...latest,cover:nextCover,coverVersion:2}
    await io.setMany([[prefix+meta.id,items[i]]])
   }
   return items
  },
  create:async(doc?:unknown)=>{const id=crypto.randomUUID();await save(id,(doc||{format:'visproj',schemaVersion:1,name:'未命名画布',nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}) as Doc);return id},
  open:async(id:string)=>{const meta=await io.get(prefix+id) as ProjectSummary;if(!meta||meta.deletedAt)throw Error('项目不存在或已删除');await io.setMany([[activeKey,id]]);active=id},
  rename:async(id:string,name:string)=>{if(!name.trim())throw Error('请输入项目名称');const doc=await store(id).read() as Doc;await save(id,{...doc,name:name.trim().slice(0,100)})},
  duplicate:async(id:string)=>{const doc=await store(id).read() as Doc;const next=crypto.randomUUID();await save(next,{...doc,name:doc.name+' · 副本'});return next},
  trash:async(id:string,deleted:boolean)=>{if(deleted&&id===await ensure())throw Error('请先打开其他画布，再删除当前项目');const meta=await io.get(prefix+id) as ProjectSummary;if(!meta)throw Error('项目不存在');await io.setMany([[prefix+id,{...meta,deletedAt:deleted?Date.now():undefined}]])}
 }
}
