import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {apiRoutingStore} from '../server/api-routing.mjs'
import {adminManagement} from '../server/config-admin.mjs'

const ready={openlux:async()=>true,dreo:async()=>true}

test('one admin route manages feature bindings independently and never returns credentials',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'canvas-api-routing-'))
 try{
  const routes=apiRoutingStore(directory,{readiness:ready,definitions:[
   {id:'separate',name:'多图层',description:'原生拆层',compatible:['openlux','dreo']},
   {id:'future',name:'后续功能',description:'示例',compatible:['dreo','openlux']},
  ]})
  const manage=adminManagement({getKey:async()=> 'test-admin-key',routes})
  const request=(method,key='test-admin-key')=>({method,url:'/api/skills/config-admin/api-routing',headers:{authorization:`Bearer ${key}`}})
  const initial=await manage(request('GET'),null)
  assert.equal(initial.features.find(feature=>feature.id==='separate').provider,'openlux')
  assert.equal(initial.features.find(feature=>feature.id==='future').provider,'dreo')
  assert.equal(JSON.stringify(initial).includes('test-admin-key'),false)
  await assert.rejects(manage(request('POST','wrong'),null,{feature:'separate',provider:'dreo'}),{status:403})
  await manage(request('POST'),null,{feature:'separate',provider:'dreo'})
  assert.deepEqual(await routes.resolve('separate'),{provider:'dreo',configured:true})
  assert.deepEqual(await routes.resolve('future'),{provider:'dreo',configured:true})
  await manage(request('POST'),null,{feature:'future',provider:'openlux'})
  assert.equal((await routes.resolve('separate')).provider,'dreo')
  assert.equal((await routes.resolve('future')).provider,'openlux')
  assert.deepEqual(JSON.parse(await readFile(path.join(directory,'api-routing.json'),'utf8')),{schema:1,bindings:{separate:'dreo',future:'openlux'}})
  await Promise.all([routes.set('separate','openlux'),routes.set('future','dreo')])
  assert.deepEqual(JSON.parse(await readFile(path.join(directory,'api-routing.json'),'utf8')),{schema:1,bindings:{separate:'openlux',future:'dreo'}})
  await assert.rejects(manage(request('POST'),null,{feature:'unknown',provider:'dreo'}),{status:400})
 }finally{await rm(directory,{recursive:true,force:true})}
})

test('legacy separation choice migrates and incompatible or unconfigured adapters are rejected',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'canvas-api-routing-'))
 try{
  await writeFile(path.join(directory,'separation-provider.json'),JSON.stringify({schema:1,provider:'dreo'}))
  const routes=apiRoutingStore(directory,{readiness:{openlux:async()=>true,dreo:async()=>false}})
  assert.equal((await routes.resolve('separate')).provider,'dreo')
  assert.equal((await routes.resolve('separate')).configured,false)
  assert.deepEqual(await routes.resolve('interactive-edit'),{provider:'openlux',configured:true})
  await assert.rejects(routes.set('separate','dreo'),{status:400})
  await assert.rejects(routes.set('generate','openlux'),{status:400})
  await routes.set('separate','openlux')
  assert.equal((await routes.resolve('separate')).provider,'openlux')
  assert.equal((await routes.get()).features.find(feature=>feature.id==='generate').editable,false)
 }finally{await rm(directory,{recursive:true,force:true})}
})
