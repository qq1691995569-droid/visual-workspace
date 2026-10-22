import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {configStore,defaults,validateConfig,configContext,configuredText,featureForRoute,publicFeatures} from '../server/function-config.mjs'
import {sameKey,manageConfig,adminManagement} from '../server/config-admin.mjs'
async function fixture(t,options){const dir=await mkdtemp(path.join(tmpdir(),'config-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return {dir,store:configStore(dir,options)}}
test('draft isolation, immutable publish, conflict, rollback and restart',async t=>{
 const sent=[];const {dir,store}=await fixture(t,{publishRemote:async c=>sent.push(c)})
 const initial=await store.read(),draft=structuredClone(initial.draft);draft.features[0].persona='测试人设'
 await store.saveDraft({expected:0,config:draft});assert.equal((await store.active()).features[0].persona,'')
 await assert.rejects(store.saveDraft({expected:0,config:draft}),/修改/)
 await store.publish({expected:1});assert.equal(sent.length,1);assert.equal((await store.active()).revision,1)
 await store.publish({expected:2,rollback:0});assert.equal((await store.active()).revision,2);assert.equal((await store.active()).features[0].persona,'')
 const restarted=await configStore(dir).read();assert.equal(restarted.versions[1].features[0].persona,'测试人设');assert.equal(restarted.audit.length,2)
})
test('failed publication does not activate draft',async t=>{
 const {store}=await fixture(t,{publishRemote:async()=>{throw Error('offline')}})
 const d=await defaults();d.features[0].enabled=false;await store.saveDraft({expected:0,config:d})
 await assert.rejects(store.publish({expected:1}),/offline/);assert.equal((await store.active()).revision,0)
})
test('remote config is validated, cached and survives offline restart',async t=>{
 const remote=await defaults();remote.revision=5;remote.features[0].enabled=false
 const {dir,store}=await fixture(t,{fetchRemote:async()=>remote});assert.equal((await store.active()).revision,5)
 const offline=configStore(dir,{fetchRemote:async()=>{throw Error('offline')}});assert.equal((await offline.active()).revision,5)
})
test('execution metadata, unknown features and variables cannot be injected',async()=>{
 const d=await defaults();const bad=structuredClone(d);bad.features.find(f=>f.id==='edit').text=bad.features.find(f=>f.id==='edit').text.replace('processor: image','processor: shell');assert.throws(()=>validateConfig(bad))
 d.features[0].text='{{unknown}}';assert.throws(()=>validateConfig(d));d.features[0].id='shell';assert.throws(()=>validateConfig(d))
})
test('concurrent tasks retain their own configuration context',async()=>{
 const a=await defaults(),b=await defaults();a.features[0].text='A';b.features[0].text='B'
 const result=await Promise.all([a,b].map(c=>configContext.run(c,async()=>{await new Promise(r=>setTimeout(r,5));return configuredText('style','fallback')})))
 assert.deepEqual(result,['A','B']);assert.equal(configuredText('style','fallback'),'fallback');assert.equal(featureForRoute('/api/skills/assets/edit/tasks',{edit:{kind:'model'}}),'model')
})
test('admin rejects unauthenticated requests; key comparison is exact',async()=>{
 await assert.rejects(manageConfig({headers:{},method:'GET',url:'/api/skills/config-admin'},null,{}),e=>e.status===401)
 assert.equal(sameKey('test','test'),true);assert.equal(sameKey('wrong','test'),false);assert.equal(sameKey(undefined,'test'),false)
})
test('admin accepts valid key, rejects wrong/revoked key and fails closed',async t=>{
 const {store}=await fixture(t);let key='test-admin-key'
 const manage=adminManagement({store,getKey:async()=>key})
 const req={method:'GET',url:'/api/skills/config-admin',headers:{authorization:'Bearer test-admin-key'}}
 assert.equal((await manage(req,null,{})).active.revision,0)
 key='rotated-key';await assert.rejects(manage(req,null,{}),e=>e.status===403)
 const unavailable=adminManagement({store,getKey:async()=>{throw Error('unavailable')}})
 await assert.rejects(unavailable(req,null,{}),/unavailable/)
})
test('system switches survive publish, remote synchronization and rollback',async t=>{
 const {dir,store}=await fixture(t)
 const draft=await defaults();draft.switches={'platform-upscale':false,extract:false,model:false,'tone-skill':false}
 await store.saveDraft({expected:0,config:draft})
 assert.equal(publicFeatures(await store.active()).find(f=>f.id==='model').enabled,true)
 await store.publish({expected:1})
 const published=await store.active()
 for(const id of ['platform-upscale','extract','model','tone-skill'])assert.equal(publicFeatures(published).find(f=>f.id===id).enabled,false)
 assert.equal(publicFeatures((await configStore(dir).read()).active).find(f=>f.id==='model').enabled,false)
 await store.publish({expected:2,rollback:0});assert.equal(publicFeatures(await store.active()).find(f=>f.id==='model').enabled,true)
 assert.equal(featureForRoute('/api/skills/upscale/tasks',{}),'platform-upscale')
 assert.equal(featureForRoute('/api/skills/assets/extract/tasks',{}),'extract')
 assert.equal(featureForRoute('/api/skills/images/tasks',{}),'generate')
 assert.equal(featureForRoute('/api/skills/upscale/recover',{}),undefined)
})
test('old configuration stays compatible, malformed switches are rejected',async()=>{
 const old=await defaults();assert.ok(publicFeatures(validateConfig(old)).every(f=>f.enabled))
 old.switches={model:'false'};assert.throws(()=>validateConfig(old),/开关/)
})
