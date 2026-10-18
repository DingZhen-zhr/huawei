import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';

const norm=s=>String(s||'').toLowerCase().replace(/huawei|华为|[\s_\-（）()]/g,'');
export function modelMatch(title,product){
 const t=norm(title),p=norm(product);if(!p||!t.includes(p))return false;
 const tail=t.slice(t.indexOf(p)+p.length);return !/^[a-z0-9]/i.test(tail);
}
export async function retrieve(product,config,{root=process.cwd(),fetchImpl=fetch,apiCall}={}){
 let base=root;while(!existsSync(resolve(base,'ima-skills-1.1.10/ima-skill/ima_api.cjs'))&&dirname(base)!==base)base=dirname(base);
 const script=resolve(base,'ima-skills-1.1.10/ima-skill/ima_api.cjs');
 const cache=resolve(root,'.cache');await mkdir(cache,{recursive:true});const stamp=resolve(cache,'last_update_check');
 // The official skill update check is isolated to the project directory.
 await writeFile(stamp,new Date().toISOString().slice(0,10));
 const call=apiCall|| (async(method,body)=>{
  if(!existsSync(script))throw new Error('IMA_SKILL_MISSING');
  const {imaApi}=createRequire(import.meta.url)(script);
  const answer=await Promise.race([imaApi(`openapi/wiki/v1/${method}`,body,{clientId:config.ima_client_id,apiKey:config.ima_api_key,baseUrl:'https://ima.qq.com',lastCheckFile:stamp}),new Promise((_,no)=>{const t=setTimeout(()=>no(new Error('IMA_TIMEOUT')),20000);t.unref();})]);
  const j=typeof answer==='string'?JSON.parse(answer):answer;if(j.code!==0)throw new Error(`IMA_API_${j.code}`);return j.data||{};
 });
 const trace=[];const request=async(method,body)=>{trace.push(method);return call(method,body);};
 const kb=await request('search_knowledge_base',{query:'任德耀新建华为PC知识库',cursor:'',limit:20});
 const found=(kb.info_list||[]).find(k=>(k.kb_name||k.name)==='任德耀新建华为PC知识库');
 const id=found?.kb_id||found?.id;if(!id)throw new Error('IMA_KB_NOT_VISIBLE');
 const list=async(folder)=>{let cursor='',all=[];for(let page=0;page<4;page++){const d=await request('get_knowledge_list',{knowledge_base_id:id,cursor,limit:50,...(folder?{folder_id:folder}:{})});all.push(...(d.knowledge_list||[]));if(d.is_end||!d.next_cursor)break;cursor=d.next_cursor;}return all;};
 const rootItems=await list();let hits=[];
 try{const searched=await request('search_knowledge',{knowledge_base_id:id,query:product,cursor:''});hits=(searched.info_list||[]).filter(h=>modelMatch(h.title||h.name,product)).map(h=>({...h,_model:product}));}catch{}
 if(!hits.length){
  const queue=rootItems.filter(x=>x.folder_id&&/P1|产品参数/.test(x.name||x.title)).map(x=>({id:x.folder_id,matched:false}));
  for(let n=0;queue.length&&n<18;n++){
   const folder=queue.shift(),items=await list(folder.id);
   for(const item of items){const title=item.name||item.title||'',matched=folder.matched||modelMatch(title,product);
    if(item.folder_id&&(matched||/产品|参数|MateBook|笔记本/i.test(title)))queue.push({id:item.folder_id,matched});
    if(item.media_id&&matched)hits.push({...item,_model:product});
   }
  }
 }
 const evidence=[],images=[];let count=0;
 for(const h of hits.slice(0,8)){
  if(!h.media_id)continue;const d=await request('get_media_info',{media_id:h.media_id});const title=h.title||h.name||'知识库资料';
  if(!d.url_info?.url)continue;
  if(d.media_type===9){images.push({name:title,source:title,position:'正文后',caption:'知识库中对应型号图片',url:d.url_info.url,model:product});continue;}
  const u=new URL(d.url_info.url);if(u.protocol!=='https:')continue;
  const r=await fetchImpl(u,{headers:d.url_info.headers||{},signal:AbortSignal.timeout(15000)});if(!r.ok)continue;
  const type=r.headers.get('content-type')||'';if(!/text|json|markdown|html/.test(type)&&!/\.md(?:\?|$)/i.test(u.href))continue;
  const raw=(await r.text()).slice(0,150000);
  // Do not infer facts from markup, code, URLs, or unreviewed unrelated products.
  const lines=raw.replace(/<[^>]+>/g,' ').split(/\r?\n/).map(l=>l.replace(/^\s*[#>*|\-]+\s*/,'').trim()).filter(l=>l.length>6&&l.length<450&&!/https?:|!\[|script|style|待审核|机密/i.test(l));
  for(let i=0;i<lines.length&&count<45;i++){
   const l=lines[i];if(!/[\d]|支持|屏幕|续航|协同|重量|接口|电池|处理器|内存|存储|限制/.test(l))continue;
   if(/MateBook/i.test(l)&&!modelMatch(l,product))continue;
   evidence.push({id:`F${++count}`,model:product,fact:l,title,source:title,_media_id:h.media_id});
  }
 }
 return {evidence,images,trace};
}
