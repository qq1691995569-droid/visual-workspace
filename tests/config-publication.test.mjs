import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {publishConfig,publicationPath} from '../server/config-publication.mjs'
const exec=promisify(execFile)
test('publishes only config to isolated Git remote and refuses stale revision',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'publish-test-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const remote=path.join(root,'remote.git'),work=path.join(root,'seed');await mkdir(work)
 const git=(args,cwd=work)=>exec('git',args,{cwd,windowsHide:true})
 await git(['init','--bare',remote]);await git(['init','-b','main']);await writeFile(path.join(work,'README.md'),'unchanged')
 await git(['add','.']);await git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','seed']);await git(['remote','add','origin',remote]);await git(['push','origin','main'])
 await publishConfig({schema:1,revision:1,features:[]},{remote})
 const data=await git(['--git-dir='+remote,'show','main:'+publicationPath]);assert.equal(JSON.parse(data.stdout).revision,1)
 assert.equal((await git(['--git-dir='+remote,'show','main:README.md'])).stdout,'unchanged')
 const names=(await git(['--git-dir='+remote,'diff-tree','--no-commit-id','--name-only','-r','main'])).stdout.trim();assert.equal(names,publicationPath)
 await assert.rejects(publishConfig({revision:1},{remote}),e=>e.status===409)
})
