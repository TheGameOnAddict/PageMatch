import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),base='/PageMatch/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.gz':'application/gzip'};
createServer(async(req,res)=>{
 try{
  if(req.url==='/'){res.writeHead(302,{Location:base});res.end();return;}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(base))throw Error('Not found');
  const file=resolve(root,path.slice(base.length)||'index.html');
  if(!file.startsWith(root+sep))throw Error('Not found');
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('PageMatch preview: http://127.0.0.1:4173/PageMatch/'));
