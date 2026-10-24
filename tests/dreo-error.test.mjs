import test from 'node:test'
import assert from 'node:assert/strict'
import {dreoValidationSummary} from '../server/dreo-error.mjs'

test('422 摘录字段校验错误，不保存回显的输入和密钥',()=>{
 const body=JSON.stringify({detail:[{loc:['body','params','size'],msg:'Extra inputs are not permitted',type:'extra_forbidden',input:'private-storage-key'},{loc:['body','params','image_paths',0],msg:'Bearer secretsecretsecretsecretsecretsecretsecretsecret',type:'value_error'}]})
 const summary=dreoValidationSummary(body)
 assert.match(summary,/字段 body.params.size Extra inputs are not permitted \(extra_forbidden\)/)
 assert.doesNotMatch(summary,/private-storage-key|secretsecret/)
})

test('422 摘录普通错误，忽略不可解析正文',()=>{
 assert.equal(dreoValidationSummary('{"error":"unsupported request"}'),'unsupported request')
 assert.equal(dreoValidationSummary('<html>validation failed</html>'),'')
})
