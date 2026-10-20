import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
test('项目迁移、独立保存、复制、回收站和重启恢复',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'canvas-catalog-'))
 try{
  for(const file of ['projectAssetStore','projectCatalog']){
   const source=(await readFile(`src/${file}.ts`,'utf8')).replace("'./projectAssetStore'","'./projectAssetStore.mjs'")
   await writeFile(path.join(dir,file+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
  }
  const {projectCatalog}=await import(pathToFileURL(path.join(dir,'projectCatalog.mjs')).href)
  const db=new Map(),clone=v=>v===undefined?v:structuredClone(v)
  let fail=false
  const io={get:async k=>clone(db.get(k)),getMany:async keys=>keys.map(k=>clone(db.get(k))),keys:async()=>[...db.keys()],setMany:async entries=>{if(fail)throw Error('disk full');entries.forEach(([k,v])=>db.set(k,clone(v)))}}
  const doc={format:'visproj',schemaVersion:1,name:'旧画布',nodes:[{data:{kind:'image',src:'data:image/png;base64,test'}}],edges:[],viewport:{x:20,y:30,zoom:.5},draft:{prompt:'原提示词'}}
  db.set('visual-canvas-project',doc)
  const catalog=projectCatalog(io,async()=> 'thumb')
  assert.deepEqual(await catalog.read(),doc)
  const old=await catalog.active();assert.equal((await catalog.list()).length,1)
  const metaKey='canvas-project-meta:'+old
  const beforeCover=structuredClone(db.get(metaKey))
  db.set(metaKey,{...beforeCover,cover:'old-padded-thumbnail',coverVersion:undefined})
  const migrated=(await catalog.list()).find(p=>p.id===old)
  assert.equal(migrated.cover,'thumb')
  assert.equal(migrated.coverVersion,2)
  assert.equal(migrated.updatedAt,beforeCover.updatedAt,'封面更新不改变项目排序')
  assert.deepEqual(await catalog.read(),doc,'封面更新不修改画布内容')
  const assetCount=()=>[...db.keys()].filter(k=>k.startsWith('canvas-image:')).length
  const count=assetCount();await catalog.write({...doc,name:'保存后的画布'});assert.equal(assetCount(),count,'重复保存不重复写入大图')
  const second=await catalog.create();await catalog.open(second);assert.deepEqual((await catalog.read()).nodes,[])
  await catalog.write({...doc,name:'第二张画布'})
  await catalog.open(old);assert.equal((await catalog.read()).name,'保存后的画布')
  const copied=await catalog.duplicate(old);await catalog.rename(copied,'副本')
  await catalog.trash(copied,true);await assert.rejects(()=>catalog.open(copied),/删除/)
  await catalog.trash(copied,false);await catalog.open(copied);assert.equal((await catalog.read()).name,'副本')
  assert.equal((await catalog.read()).nodes[0].data.src,doc.nodes[0].data.src)
  const reopened=projectCatalog(io);assert.equal(await reopened.active(),copied);assert.equal((await reopened.read()).name,'副本')
  await assert.rejects(()=>catalog.trash(copied,true),/当前项目/)
  fail=true;await assert.rejects(()=>catalog.rename(old,'写入失败'));fail=false
  assert.equal((await catalog.list()).find(p=>p.id===old).name,'保存后的画布')
  assert.deepEqual(db.get('visual-canvas-project'),doc,'保留迁移前的原记录')
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('canvas-catalog-'));await rm(dir,{recursive:true,force:true})}
})
