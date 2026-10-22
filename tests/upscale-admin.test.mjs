import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {upscaleAdmin} from '../server/upscale-admin.mjs'
import {sharingAdmin,tokenHash} from '../server/upscale-sharing.mjs'
import {shareHandler} from '../server/upscale-share-service.mjs'
const workflow={id:'test',name:'Test',enabled:true,is_default:true,version:2,template_uuid:'a'.repeat(32),workflow_uuid:'b'.repeat(32),load_image_node_id:'1',generate_params_template:{'1':{class_type:'LoadImage',inputs:{image:''}}},editable_params:[],cross_field_rules:[]}
async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'upscale-admin-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(path.join(dir,'liblib.json'),JSON.stringify({accessKey:'private-access',secretKey:'private-secret',workflows:[workflow]}));return dir}
test('draft isolation, publish, conflict, rollback and credentials preserved',async t=>{
 const dir=await fixture(t),store=upscaleAdmin(dir),s=await store.get()
 assert.doesNotMatch(JSON.stringify(s),/private-access|private-secret/)
 const draft=await store.mutate('draft',{expected:s.revision,draftRevision:0,workflows:[{...workflow,name:'Changed'}]})
 assert.equal(JSON.parse(await readFile(path.join(dir,'liblib.json'))).workflows[0].name,'Test')
 await assert.rejects(store.mutate('publish',{expected:s.revision,draftRevision:0}),/其他页面/)
 const published=await store.mutate('publish',{expected:draft.revision,draftRevision:draft.draftRevision})
 assert.equal(published.active[0].name,'Changed');assert.equal(published.active[0].version,3)
 assert.equal(JSON.parse(await readFile(path.join(dir,'liblib.json'))).secretKey,'private-secret')
 const restored=await store.mutate('restore',{expected:published.revision,draftRevision:0,revision:published.history[0].revision})
 assert.equal(restored.workflows[0].name,'Test');assert.equal(restored.active[0].name,'Changed')
 const restart=await upscaleAdmin(dir).get();assert.equal(restart.hasDraft,true)
 await assert.rejects(store.mutate('draft',{expected:restart.revision,draftRevision:restart.draftRevision,workflows:[{...workflow,load_image_node_id:'99'}]}),/图片节点/)
})
test('shared gateway authenticates, isolates tasks and blocks management; credentials revoke immediately',async t=>{
 const dir=await fixture(t)
 await writeFile(path.join(dir,'upscale-sharing.json'),JSON.stringify({origin:'https://10.0.0.1:5443',clients:[{id:'alice',name:'Alice',enabled:true,tokenHash:tokenHash('alice-key')},{id:'bob',name:'Bob',enabled:true,tokenHash:tokenHash('bob-key')}]}))
 let forwarded=0
 const handler=shareHandler({directory:dir,fetcher:async()=>{forwarded++;return new Response(JSON.stringify({status:'running'}))}})
 async function call(token,url,method='GET',body){const req={method,url,headers:{authorization:'Bearer '+token,'content-type':'application/json'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}};const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value)}};await handler(req,res);return res}
 assert.equal((await call('wrong','/api/skills/upscale/workflows')).statusCode,401)
 assert.equal((await call('alice-key','/api/skills/config-admin')).statusCode,404)
 const id='11111111-1111-4111-8111-111111111111'
 assert.equal((await call('alice-key','/api/skills/upscale/tasks','POST',{requestId:id})).statusCode,200)
 assert.equal((await call('bob-key','/api/skills/images/tasks/'+id)).statusCode,404)
 assert.equal((await call('bob-key','/api/skills/upscale/tasks','POST',{requestId:id})).statusCode,404)
 assert.equal((await call('alice-key','/api/skills/images/tasks/'+id)).statusCode,200)
 await sharingAdmin(dir).mutate('revoke',{id:'alice'})
 assert.equal((await call('alice-key','/api/skills/images/tasks/'+id)).statusCode,401)
 assert.equal(forwarded,2)
})
