import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';

export function parseJson(text){
 const clean=String(text??'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
 try{return JSON.parse(clean);}catch{const a=clean.indexOf('{'),b=clean.lastIndexOf('}');return JSON.parse(clean.slice(a,b+1));}
}
export async function complete(config,system,input,{fetchImpl=fetch,root=process.cwd()}={}){
 const user=JSON.stringify(input);
 if(config.llm_driver==='codex'){
  const home=resolve(root,'.codex-home');await mkdir(home,{recursive:true});
  const outRoot=resolve(root,'out/tmp');await mkdir(outRoot,{recursive:true});const tmp=await mkdtemp(join(outRoot,'codex-'));
  const out=join(tmp,'result.json');
  const toml=JSON.stringify;
  await writeFile(join(home,'config.toml'),`model = ${toml(config.llm_model)}\nmodel_provider = "competition"\n[model_providers.competition]\nname = "competition"\nbase_url = ${toml(config.llm_base_url)}\nenv_key = "LLM_API_KEY"\nwire_api = "responses"\n`);
  try{
   await new Promise((ok,no)=>{
    const child=spawn(config.codex_bin||'codex',['exec','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--output-last-message',out,'-'],{cwd:root,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,CODEX_HOME:home,LLM_API_KEY:config.llm_api_key},stdio:['pipe','ignore','pipe']});
    const timer=setTimeout(()=>{child.kill();no(new Error('CODEX_TIMEOUT'));},Number(config.timeout_ms)||60000);
    child.on('error',()=>{clearTimeout(timer);no(new Error('CODEX_UNAVAILABLE'));});child.on('close',code=>{clearTimeout(timer);code===0?ok():no(new Error('CODEX_FAILED'));});child.stderr.resume();child.stdin.end(`${system}\n用户数据(JSON):${user}`);
   });return parseJson(await readFile(out,'utf8'));
  }finally{await rm(tmp,{recursive:true,force:true});}
 }
 const endpoints=[{base:config.llm_base_url,key:config.llm_api_key,model:config.llm_model},...(config.fallback_model?[{base:config.fallback_base_url||config.llm_base_url,key:config.fallback_api_key||config.llm_api_key,model:config.fallback_model}]:[])];
 let last='LLM_UNAVAILABLE';
 for(const endpoint of endpoints){
  const responses=config.llm_wire_api==='responses';
  for(let attempt=0;attempt<2;attempt++){
   try{
    const body=responses?{model:endpoint.model,instructions:system+'\n只输出JSON对象。',input:user,store:false,max_output_tokens:5000}:{model:endpoint.model,messages:[{role:'system',content:system+'\n只输出JSON对象。'},{role:'user',content:user}],max_tokens:5000};
    const r=await fetchImpl(endpoint.base.replace(/\/$/,'')+(responses?'/responses':'/chat/completions'),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${endpoint.key}`},body:JSON.stringify(body),signal:AbortSignal.timeout(Number(config.timeout_ms)||45000)});
    if(!r.ok){last=`LLM_HTTP_${r.status}`;if(r.status<500&&r.status!==429)break;continue;}
    const j=await r.json();const text=responses?(j.output_text||j.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')):j.choices?.[0]?.message?.content;
    return parseJson(text);
   }catch{last='LLM_NETWORK_OR_JSON';}
  }
 }
 throw new Error(last);
}
