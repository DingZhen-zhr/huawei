const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const content = require('../src/lib/content.ts');
const task = {modelId:'matebook-pro', scenario:'内容创作', platform:'小红书', goal:'私信咨询', withPrice:false};
test('工作台正文由场景叙事驱动，不再输出整份硬参数模板', () => {
 const article = content.generateArticle(task);
 assert.doesNotMatch(article.body, /核对过的硬事实|我的场景是|1\. 重量/);
 assert.match(article.body, /选片|改稿|素材/);
});
test('创意工作流模块已可运行', () => assert.ok(fs.existsSync(require('node:path').join(__dirname,'../src/lib/creative.ts'))));
const creative = require('../src/lib/creative.ts');
test('96 combinations preserve platform and scenario distinctions with a single bundle', () => {
 for (const modelId of Object.keys(content.MODELS)) for (const scenario of Object.keys(content.SCENARIOS)) {
  const bodies = [];
  for (const platform of Object.keys(content.PLATFORMS)) {
   const t = {...task,modelId,scenario,platform};
   const b = creative.createRuleBundle(t, ['图：来自索引']);
   assert.equal(b.mode,'preview');
   assert.equal(creative.validateArticle(b.article,b,t).length,0, JSON.stringify({t, issues:creative.validateArticle(b.article,b,t)}));
   assert.equal(content.runPipeline(t,[],b).length,9);
   assert.match(content.runPipeline(t,[],b).find(s=>s.id==='verify').summary,/待人工/);
   assert.ok(content.buildExport(t,[],b).includes(b.article.body));
   assert.ok(content.buildPublishText(t,[],b).includes(b.article.body.replace(/\*\*/g,'')));
   assert.match(b.notices.join(''),/未调用大模型/);
   bodies.push(b.article.body);
  }
  assert.equal(new Set(bodies).size,4);
 }
});
test('模型真实经历策划、初稿、编辑，低分定向重写；导出不再生成', async () => {
 const b = creative.createRuleBundle(task); const calls=[];
 const bundle = await creative.prepareArticle(task,[], async (step) => {
  calls.push(step);
  if(step==='策划')return JSON.stringify({candidates:b.candidates,beats:b.beats});
  if(step==='编辑')return JSON.stringify({scores:[4,3,4,4,4],notes:reviewNotes(),rewrite:true});
  return JSON.stringify({...b.article,title:step==='重写'?'把改稿的下一步留给作品':b.article.title});
 });
 assert.deepEqual(calls,['策划','初稿','编辑','重写']);
 assert.equal(bundle.mode,'model');
 assert.match(content.buildExport(task,[],bundle),/把改稿的下一步留给作品/);
 assert.match(content.buildPublishText(task,[],bundle),/把改稿的下一步留给作品/);
 assert.equal(calls.length,4);
});
test('模型失败、不合法JSON、虚构数字或亲测都不得冒充成稿', async () => {
 const b=creative.createRuleBundle(task);
 for (const mode of ['network','json','fabricated']) {
  const result=await creative.prepareArticle(task,[],async step=>{
   if(mode==='network')throw Error('SENSITIVE-KEY');
   if(mode==='json')return '<html>error</html>';
   if(step==='策划')return JSON.stringify({candidates:b.candidates,beats:b.beats});
   if(step==='编辑')return JSON.stringify({scores:[5,5,5,5,5],notes:reviewNotes(),rewrite:false});
   return JSON.stringify({...b.article,body:b.article.body+' 亲测续航999小时'});
  });
  assert.equal(result.mode,'preview');
  assert.doesNotMatch(JSON.stringify(result),/SENSITIVE-KEY/);
  assert.doesNotMatch(result.article.body,/999|亲测/);
  assert.match(result.notices.join(''),/规则创意预览/);
 }
});
test('用户简报改变角度选择且不能用错任务bundle',()=>{
 const b=creative.createRuleBundle({...task,brief:'担心预算怎么选'});
 assert.match(b.candidates[0].angle,/选择张力/);
 assert.throws(()=>content.generateArticle({...task,scenario:'开学季'},b),/不一致/);
});
test('Home rendering JSX stays byte-for-byte unchanged from rollback baseline',()=>{
 const cp=require('node:child_process');
 const old=cp.execFileSync('git',['show','55243b3:app/src/pages/Home.tsx'],{encoding:'utf8'});
 const now=fs.readFileSync(require('node:path').join(__dirname,'../src/pages/Home.tsx'),'utf8');
 const rendered=s=>s.slice(s.indexOf('  return (\n'));
 assert.equal(rendered(now.replace(/\r\n/g,'\n')),rendered(old.replace(/\r\n/g,'\n')));
});
test('原价格开关保留历史快照限定，关闭不生成金额',()=>{
 for(const modelId of Object.keys(content.MODELS)) {
  const t={...task,modelId,platform:'门店海报',withPrice:true};
  const on=creative.createRuleBundle(t);const off=creative.createRuleBundle({...t,withPrice:false});
  assert.match(on.article.body,/¥/);assert.match(on.article.body,/2026-10-17/);assert.match(on.article.body,/历史快照.*未实时核验/);
  assert.doesNotMatch(off.article.body,/¥/);
  assert.deepEqual(creative.validateArticle(on.article,on,t),[]);
 }
});
const dimensions=['吸引力','艺术节制','线性递进','表现动作节奏','平台与唯一CTA'];
const reviewNotes=()=>dimensions.map(dimension=>({dimension,quote:'选片窗口开着',action:'保留具体动作作为开头，后文继续回到创作任务'}));
test('公众号和朋友圈内容创作场景仍支持原价格开关且来源回到P1/08',()=>{
 for(const platform of ['公众号','门店朋友圈']) {
  const t={...task,platform,withPrice:true};const b=creative.createRuleBundle(t);
  assert.match(b.article.body,/¥/);
  assert.match(b.facts.find(f=>f.id==='price').source,/P1\/08/);
 }
});
test('编辑空依据或伪造引用即使全5分也不能成为模型成稿',async()=>{
 const b=creative.createRuleBundle(task);
 for (const notes of [[],reviewNotes().map(n=>({...n,quote:'这句不在真实初稿里'}))]) {
  const steps=[];
  const result=await creative.prepareArticle(task,[],async step=>{
   steps.push(step);
   if(step==='策划')return JSON.stringify({candidates:b.candidates,beats:b.beats});
   if(step==='编辑')return JSON.stringify({scores:[5,5,5,5,5],notes,rewrite:false});
   return JSON.stringify(b.article);
  });
  assert.equal(result.mode,'preview');
  assert.deepEqual(steps,['策划','初稿','编辑']);
 }
});
