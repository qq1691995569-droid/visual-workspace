import {test} from 'node:test'
import assert from 'node:assert/strict'
import {managementGate,isManagementPath} from '../server/admin-access.mjs'
import {adminManagement} from '../server/config-admin.mjs'
test('management is closed by default, including direct page and API access',async()=>{
 const before=process.env.CANVAS_ADMIN_ENABLED
 try{
  delete process.env.CANVAS_ADMIN_ENABLED
  for(const url of ['/admin','/admin/','/admin?test=1','/api/skills/config-admin','/api/skills/config-admin/tasks','/api/skills/admin/jobs']){
   let next=false,body;const res={statusCode:200,setHeader(){},end(value){body=value}}
   managementGate({url},res,()=>{next=true})
   assert.equal(res.statusCode,404);assert.equal(next,false);assert.equal(body,'Not found')
  }
  assert.equal(isManagementPath('/api/skills/functions'),false)
  let allowed=false;managementGate({url:'/'},{},()=>{allowed=true});assert.equal(allowed,true)
  process.env.CANVAS_ADMIN_ENABLED='1'
  let enabled=false;managementGate({url:'/admin'},{},()=>{enabled=true});assert.equal(enabled,true)
  const manage=adminManagement({getKey:async()=>'test-key'})
  await assert.rejects(manage({headers:{},method:'GET',url:'/api/skills/config-admin'},null,{}),e=>e.status===401)
  await assert.rejects(manage({headers:{authorization:'Bearer wrong'},method:'GET',url:'/api/skills/config-admin'},null,{}),e=>e.status===403)
 }finally{if(before===undefined)delete process.env.CANVAS_ADMIN_ENABLED;else process.env.CANVAS_ADMIN_ENABLED=before}
})
