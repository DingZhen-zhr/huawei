import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runTask} from '../harness/pipeline.mjs';

export function envConfig(env=process.env){return {llm_base_url:env.LLM_BASE_URL||'',llm_api_key:env.LLM_API_KEY||'',llm_model:env.LLM_MODEL||'',llm_wire_api:env.LLM_WIRE_API||'chat',llm_driver:env.LLM_MODE==='codex'?'codex':'http',codex_bin:env.CODEX_BIN||'codex',fallback_base_url:env.LLM_FALLBACK_BASE_URL||'',fallback_model:env.LLM_FALLBACK_MODEL||'',fallback_api_key:env.LLM_FALLBACK_API_KEY||'',ima_client_id:env.IMA_OPENAPI_CLIENTID||'',ima_api_key:env.IMA_OPENAPI_APIKEY||'',timeout_ms:env.LLM_TIMEOUT_MS||45000};}
export function createServer(initial=envConfig(),{root=resolve(fileURLToPath(new URL('..',import.meta.url)))}={}){
 const config={...initial},runs=new Map();
 const publicConfig=()=>({llm:{configured:Boolean(config.llm_base_url&&config.llm_model&&config.llm_api_key),base_url:config.llm_base_url||'',model:config.llm_model||'',wire_api:config.llm_wire_api||'chat',driver:config.llm_driver||'http',fallback_configured:Boolean(config.fallback_model)},ima:{configured:Boolean(config.ima_client_id&&config.ima_api_key),kb_name:'任德耀新建华为PC知识库'},demo_available:true});
 const redact=value=>{let text=JSON.stringify(value);for(const key of ['llm_api_key','ima_client_id','ima_api_key','fallback_api_key'])if(config[key])text=text.split(config[key]).join('[已隐藏]');return text;};
 const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(redact(value));};
 const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>40000)throw new Error('BODY_TOO_LARGE');}return JSON.parse(text||'{}');};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
  try{
   const url=new URL(req.url,'http://localhost');
   // Settings are available only to the local same-origin UI.
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){return json(res,403,{message:'仅允许本地同源页面访问'});}
   if(['/api/config','/api/status'].includes(url.pathname)&&req.method==='GET')return json(res,200,publicConfig());
   if(url.pathname==='/api/config'&&req.method==='POST'){
    const update=await body(req);const allowed=['llm_base_url','llm_model','llm_api_key','llm_wire_api','llm_driver','fallback_base_url','fallback_model','fallback_api_key','ima_client_id','ima_api_key'];
    for(const key of allowed)if(typeof update[key]==='string'&&update[key].trim()){
     if(key.endsWith('base_url')){const u=new URL(update[key]);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('INVALID_BASE_URL');}
     config[key]=update[key].trim();
    }
    return json(res,200,publicConfig());
   }
   if(url.pathname==='/api/generate'&&req.method==='POST'){const input=await body(req);return json(res,200,await runTask(input,{...config},{root}));}
   if(url.pathname==='/api/tasks'&&req.method==='POST'){
    const input=await body(req);if(runs.size>=100){const oldest=runs.keys().next().value;if(runs.get(oldest)?.done)runs.delete(oldest);else return json(res,429,{message:'任务较多，请稍后重试'});}
    const id=randomUUID(),run={events:[],clients:new Set(),done:false};runs.set(id,run);
    const send=(event,data)=>{const s=`event: ${event}\ndata: ${redact(data)}\n\n`;run.events.push(s);for(const c of run.clients)c.write(s);};
    json(res,202,{task_id:id});
    runTask(input,{...config},{root,emit:data=>send('progress',data)}).then(result=>{run.result=result;send('result',result);}).catch(()=>send('error',{message:'任务未完成，请检查配置或重试；未输出未核实成稿'})).finally(()=>{run.done=true;for(const c of run.clients)c.end();run.clients.clear();});return;
   }
   const exporting=url.pathname.match(/^\/api\/tasks\/([\w-]+)\/export$/);
   if(exporting&&req.method==='GET'){
    const run=runs.get(exporting[1]);if(!run)return json(res,404,{message:'任务不存在，请重新生成'});
    if(!run.done||run.result?.status!=='complete')return json(res,409,{message:'任务尚未形成可导出的成稿，请先处理待确认事项'});
    res.writeHead(200,{'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="marketing-plan.txt"; filename*=UTF-8''${encodeURIComponent('门店营销方案.txt')}`,'cache-control':'no-store'});
    return res.end(JSON.parse(redact(run.result.copy_text)));
   }
   const match=url.pathname.match(/^\/api\/tasks\/([\w-]+)\/events$/);
   if(match&&req.method==='GET'){
    const run=runs.get(match[1]);if(!run)return json(res,404,{message:'任务不存在'});
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'});res.flushHeaders();for(const event of run.events)res.write(event);
    if(run.done)res.end();else{run.clients.add(res);const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{run.clients.delete(res);clearInterval(heartbeat);});}return;
   }
   if(url.pathname.startsWith('/api/'))return json(res,404,{message:'接口不存在'});
   if(req.method!=='GET')return json(res,405,{message:'不支持此操作'});
   const web=resolve(root,'web'),path=resolve(web,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!path.startsWith(web+sep))return json(res,403,{message:'禁止访问'});
   if(!(await stat(path)).isFile())throw new Error('NOT_FOUND');const bytes=await readFile(path);
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
   res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch{if(!res.headersSent)json(res,400,{message:'请求无法处理，请检查输入或配置格式'});else res.end();}
 });return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||3000;createServer().listen(port,'127.0.0.1',()=>console.log(`门店增长智能体：http://127.0.0.1:${port}`));
}
