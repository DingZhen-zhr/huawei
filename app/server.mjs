import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export function createHandler({env=process.env, upstream=fetch, root=appRoot}={}) {
 let active = 0;
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 return async (req,res,next) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  try {
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/healthz') return json(res,200,{status:'ok'});
   if(url.pathname==='/api/runtime') return json(res,200,{modelConfigured:Boolean(env.DEEPSEEK_API_KEY),knowledgeConfigured:Boolean(env.KB_ROOT)});
   if(url.pathname==='/api/prompt'||url.pathname==='/@fs/system-prompt') {
    if(req.method!=='GET') return json(res,405,{error:'method_not_allowed'});
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end(await readFile(path.resolve(root,'../系统提示词骨架.md')));
   }
   if(url.pathname==='/api/knowledge') {
    if(req.method!=='GET') return json(res,405,{error:'method_not_allowed'});
    if(!env.KB_ROOT) return json(res,404,{error:'knowledge_not_configured'});
    const base=await realpath(env.KB_ROOT),relative=url.searchParams.get('path')||'';
    if(!relative||path.isAbsolute(relative)||relative.split('/').includes('..')||relative.includes('\\')||!['.md','.csv'].includes(path.extname(relative))) return json(res,403,{error:'forbidden'});
    const target=await realpath(path.resolve(base,relative));
    if(!target.startsWith(base+path.sep)) return json(res,403,{error:'forbidden'});
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    return res.end(await readFile(target));
   }
   if(url.pathname==='/api/deepseek/chat/completions') {
    if(req.method!=='POST') return json(res,405,{error:'method_not_allowed'});
    if(req.headers.origin && ![ `https://${req.headers.host}`, `http://${req.headers.host}` ].includes(req.headers.origin)) return json(res,403,{error:'origin_not_allowed'});
    const key=env.DEEPSEEK_API_KEY || req.headers['x-model-key'];
    if(typeof key!=='string'||!key.trim()) return json(res,503,{error:'model_not_configured'});
    if(active>=4) return json(res,429,{error:'busy'});
    let bytes=0,chunks=[];
    for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)return json(res,413,{error:'body_too_large'});chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString());
    if(!Array.isArray(body.messages)||body.messages.length>30) return json(res,400,{error:'invalid_messages'});
    body.model='deepseek-chat';body.max_tokens=Math.min(4000,Math.max(1,Number(body.max_tokens)||1500));body.stream=false;
    active++;
    try {
     const response=await upstream('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
     if(!response.ok) return json(res,response.status===429?429:502,{error:'model_request_failed'});
     const data=await response.json(),content=data?.choices?.[0]?.message?.content;
     if(typeof content!=='string'||!content.trim())return json(res,502,{error:'empty_model_response'});
     return json(res,200,{choices:[{message:{content}}]});
    } catch {return json(res,502,{error:'model_request_failed'});} finally {active--;}
   }
   if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/@fs/'))return json(res,404,{error:'not_found'});
   if(next) return next();
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'method_not_allowed'});
   const dist=path.resolve(root,'dist'),target=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!target.startsWith(dist+path.sep))return json(res,403,{error:'forbidden'});
   if(!(await stat(target)).isFile())return json(res,404,{error:'not_found'});
   const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
  } catch(error) {if(!res.headersSent)json(res,error?.code==='ENOENT'?404:400,{error:'request_failed'});else res.end();}
 };
}
export function createServer(options){return http.createServer(createHandler(options));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT)||7860;
 createServer().listen(port,'0.0.0.0',()=>console.log(`Workbench listening on ${port}`));
}
