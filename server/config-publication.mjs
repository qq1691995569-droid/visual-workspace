import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
const exec=promisify(execFile)
export const repository='https://github.com/qq1691995569-droid/visual-workspace.git'
export const publicationPath='published/canvas-functions.json'
export const publicationUrl='https://raw.githubusercontent.com/qq1691995569-droid/visual-workspace/main/'+publicationPath
export async function fetchPublished(){
 const response=await fetch(publicationUrl,{signal:AbortSignal.timeout(4000),redirect:'error'})
 if(!response.ok)throw Error('暂时无法获取发布配置')
 const text=await response.text();if(text.length>500000)throw Error('配置文件过大')
 return JSON.parse(text)
}
export async function publishConfig(config,{remote=repository}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'canvas-config-'))
 const git=(args)=>exec('git',args,{cwd:dir,timeout:60000,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})
 try{
  await git(['init','--quiet']);await git(['remote','add','origin',remote]);await git(['fetch','--depth=1','origin','main']);await git(['checkout','-B','config-publish','FETCH_HEAD'])
  const file=path.join(dir,publicationPath)
  try{const prior=JSON.parse(await readFile(file,'utf8'));if(prior.revision>=config.revision)throw Object.assign(Error('远端配置已更新，请刷新后台后重新发布'),{status:409})}catch(e){if(e.code!=='ENOENT')throw e}
  await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(config,null,2)+'\n')
  await git(['add','--',publicationPath])
  await git(['-c','user.name=Canvas Config Publisher','-c','user.email=qq1691995569-droid@users.noreply.github.com','commit','-m',`Publish canvas function configuration v${config.revision}`])
  await git(['push','origin','HEAD:main'])
 }catch(e){if(e.status)throw e;throw Error('发布到 GitHub 失败：请检查本机 Git 登录、网络及仓库写权限；草稿已保留')}
 finally{await rm(dir,{recursive:true,force:true}).catch(()=>{})}
}
