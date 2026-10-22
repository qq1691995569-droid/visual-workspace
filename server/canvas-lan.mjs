// Serve built canvas only; keep the development server and management APIs local.
import https from 'node:https'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const directory=path.join(root,'.canvas-data')
const config=JSON.parse(await readFile(path.join(directory,'upscale-sharing.json'),'utf8'))
const origin=`https://${config.bindHost}:5444`
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'}
const server=https.createServer({key:await readFile(path.join(directory,'upscale-share-key.pem')),cert:await readFile(path.join(directory,'upscale-share-cert.pem')),minVersion:'TLSv1.2'},async(req,res)=>{
 try{
  const url=new URL(req.url,origin),pathname=decodeURIComponent(url.pathname)
  if(req.headers.host!==new URL(origin).host || req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end();return}
  if(pathname.startsWith('/admin')||pathname.startsWith('/api/skills/config-admin')||pathname.startsWith('/api/skills/admin')){res.writeHead(404);res.end();return}
  res.setHeader('X-Content-Type-Options','nosniff')
  if(pathname.startsWith('/api/skills/')){
   if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return}
   let size=0;const chunks=[]
   for await(const chunk of req){size+=chunk.length;if(size>100*1024*1024){res.writeHead(413);res.end();return}chunks.push(chunk)}
   const upstream=await fetch('http://127.0.0.1:5173'+url.pathname+url.search,{method:req.method,headers:{'Content-Type':'application/json'},...(chunks.length?{body:Buffer.concat(chunks)}:{}),redirect:'error',signal:AbortSignal.timeout(120000)})
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'})
   res.end(Buffer.from(await upstream.arrayBuffer()));return
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
  const relative=pathname==='/'?'index.html':pathname.slice(1)
  const file=path.resolve(root,'dist',relative)
  if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(404);res.end();return}
  const bytes=await readFile(file)
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'})
  res.end(req.method==='HEAD'?undefined:bytes)
 }catch(error){res.writeHead(error.code==='ENOENT'?404:502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'页面或主机服务暂不可用，请联系管理员'}))}
})
server.listen(5444,config.bindHost,()=>console.log('局域网画板：'+origin))
