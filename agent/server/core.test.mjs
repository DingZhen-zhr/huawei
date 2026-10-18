import test from 'node:test';
import assert from 'node:assert/strict';
import {runTask} from '../harness/pipeline.mjs';
import {createServer} from './index.mjs';
import http from 'node:http';
import {complete} from '../harness/tools/llm.mjs';
import {retrieve,modelMatch} from '../harness/tools/ima.mjs';

const task={product:'HUAWEI MateBook Pro S',audience:'大学新生',scene:'开学季',platform:'小红书',description:'每天背电脑赶早八，宿舍插座紧张'};
test('missing information asks before retrieval',async()=>{
 const r=await runTask({description:'想买轻薄本'},{});
 assert.equal(r.status,'needs_input'); assert.ok(r.questions.length>=4);assert.equal(r.article.paragraphs.length,0);
});
test('live cannot silently substitute demonstration when credentials absent',async()=>{
 const r=await runTask({...task,mode:'live'},{});
 assert.equal(r.status,'needs_configuration');assert.equal(r.evidence.length,0);
});
test('demonstration is isolated, contains six sections and no invented price or ima images',async()=>{
 const r=await runTask({...task,mode:'demo'},{});
 assert.equal(r.mode,'demo');assert.equal(r.source,'demo_fixture');assert.match(r.copy_text,/演示/);
 assert.ok(r.insight.basis);assert.ok(r.plan.demo_script.length);assert.ok(r.plan.next_actions.length);
 assert.equal(r.plan.quote.total,null);assert.equal(r.article.images.length,0);
});
test('HTTP settings never echo submitted secrets; events replay complete task',async()=>{
 const server=createServer({});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const c=await fetch(base+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({llm_api_key:'unit-secret',llm_base_url:'http://127.0.0.1:9/v1',llm_model:'unit'})});
  assert.doesNotMatch(await c.text(),/unit-secret/);
  const t=await (await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...task,mode:'demo'})})).json();
  const events=await (await fetch(base+`/api/tasks/${t.task_id}/events`)).text();
  assert.match(events,/event: result/);assert.match(events,/demo_fixture/);
  const exported=await fetch(base+`/api/tasks/${t.task_id}/export`);assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition'),/attachment/);assert.match(await exported.text(),/演示模式/);
 }finally{await new Promise(r=>server.close(r));}
});
test('independent backup service is used after primary rejects request',async()=>{
 const primary=http.createServer((q,s)=>{s.writeHead(503);s.end('{}');});
 const backup=http.createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({choices:[{message:{content:'{"backup":true}'}}]}));});
 await Promise.all([primary,backup].map(s=>new Promise(r=>s.listen(0,'127.0.0.1',r))));
 try{const answer=await complete({llm_base_url:`http://127.0.0.1:${primary.address().port}/v1`,llm_api_key:'test',llm_model:'primary',fallback_base_url:`http://127.0.0.1:${backup.address().port}/v1`,fallback_model:'secondary'},'return JSON',{});assert.equal(answer.backup,true);}
 finally{await Promise.all([primary,backup].map(s=>new Promise(r=>s.close(r))));}
});
test('empty search walks P1 exact-model folder before reading original',async()=>{
 const calls=[];
 const apiCall=async(method,body)=>{calls.push(method);if(method==='search_knowledge_base')return{info_list:[{kb_name:'任德耀新建华为PC知识库',kb_id:'internal-id'}]};if(method==='search_knowledge')return{info_list:[]};if(method==='get_media_info')return{media_type:7,url_info:{url:'https://ima.example.test/article.md'}};return{is_end:true,knowledge_list:body.folder_id==='p1'?[{folder_id:'model',name:task.product}]:body.folder_id==='model'?[{media_id:'m1',title:'article.md'}]:[{folder_id:'p1',name:'P1-产品参数库'}]};};
 const data=await retrieve(task.product,{}, {apiCall,fetchImpl:async()=>new Response('屏幕尺寸：14英寸\n内存：16GB',{headers:{'content-type':'text/markdown'}})});
 assert.ok(calls.includes('get_media_info'));assert.ok(data.evidence.length);assert.equal(modelMatch('HUAWEI MateBook Pro S', 'HUAWEI MateBook Pro'),false);
});
test('live numerical hallucination is removed and no false price is exported',async()=>{
 const config={ima_client_id:'a',ima_api_key:'b',llm_base_url:'https://unused.test/v1',llm_model:'unit',llm_api_key:'c'};
 const r=await runTask({...task,mode:'live'},config,{retrieveImpl:async()=>({evidence:[{id:'F1',model:task.product,fact:'内存：16GB',title:'产品事实',source:'产品事实'}],images:[],trace:['search_knowledge_base']}),completeImpl:async(c,s,i)=>i.segments?{unsupported_indices:[],conflicts:[]}:{title:'购机参考',lead:'先了解使用需求',segments:[{text:'内存64GB',fact_ids:['F1']},{text:'内存：16GB',fact_ids:['F1']}],cta:'欢迎到店',tags:[]}});
 assert.deepEqual(r.article.paragraphs,['内存：16GB']);assert.equal(r.plan.quote.total,null);assert.match(r.verification.pending.join(' '),/移除/);
});
test('four web platform ids produce substantially different demonstration structure',async()=>{
 const results=[];for(const platform of ['wechat_mp','xiaohongshu','moments','poster'])results.push(await runTask({...task,platform,scene:'back_to_school',mode:'demo'},{}));
 assert.equal(results.every(r=>r.status==='complete'),true);
 assert.notDeepEqual(results[0].article.paragraphs,results[2].article.paragraphs);
 assert.notEqual(results[1].article.title,results[0].article.title);
 assert.equal(results[2].article.paragraphs.length,1);
 assert.equal(results[3].article.paragraphs.length,3);
});
test('ambiguous model question is bound to product field so form can resume',async()=>{
 const r=await runTask({...task,product:'MateBook',mode:'demo'},{});
 assert.equal(r.status,'needs_input');assert.ok(r.questions.some(q=>q.field==='product'));
 const resumed=await runTask({...task,product:'HUAWEI MateBook Pro S',mode:'demo'},{});assert.equal(resumed.status,'complete');
});
test('revision is applied without publishing editing instructions as customer copy',async()=>{
 const original=await runTask({...task,mode:'demo'},{});
 const revised=await runTask({...task,mode:'demo',description:task.description+'\n修改要求：删去第二段'},{});
 assert.equal(revised.article.paragraphs.length,original.article.paragraphs.length-1);
 assert.doesNotMatch([revised.article.lead,...revised.article.paragraphs].join(' '),/修改要求|删去第二段/);
});
