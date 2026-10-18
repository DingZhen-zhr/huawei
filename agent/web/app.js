const $ = (id) => document.getElementById(id);
const stages = { task: '任务补全', insight: '客户洞察', strategy: '内容策略', retrieval: '资料检索', draft: '图文生成', verification: '事实核验', compliance: '合规检查', export: '方案导出' };
const labels = {strategy:'内容策略与规则依据',platform_plan:'平台编排方案',structure:'内容结构',image_count:'配图数量',min:'下限',max:'上限',target:'建议数量',tone:'表达语气',rule_basis:'规则依据',summary:'依据说明',rationale:'切入理由',rank:'优先顺序',label:'卖点',need_topics:'需要核实的事实主题',single_selling_point:'是否聚焦单一卖点',content_goal:'内容目标',detail_tags:'具体处境细节',claim_ref:'对应判断',basis:'判断依据',judgements:'逐项判断与依据',unknowns:'尚不明确的信息',type:'依据类型',protocol:'接口协议',host:'服务域名',verified_at:'核验日期',channel:'报价渠道',region:'适用地区',verification:'来源与型号核验',source_url:'原始资料链接',source_page_url:'原始资料链接',evidence_ids:'事实依据',basis_fact_ids:'判断依据',basis_type:'依据类型',input_quote:'客户原话',rule_id:'业务规则',sku:'商品配置',sku_text:'商品配置',unit_price:'单价',quantity:'数量',discount:'已核实减免',subtotal:'小计',situation:'客户处境',empathy:'共情细节',facts:'产品事实核验',images:'图片型号核验',compliance:'营销合规检查',fact_ids:'事实引用编号',recommendation:'建议',risk:'风险',finding:'检查发现',persona:'客户画像',audience:'目标人群',usage_scene:'使用场景',scene:'业务场景',purchase_stage:'购买阶段',core_situation:'核心处境',concerns:'客户顾虑',empathy_anchors:'共情锚点',evidence:'判断依据',basis:'判断依据',quote:'原始描述',problem:'用户问题',goal:'内容目标',platform:'发布平台',angle:'内容切入点',selling_points:'卖点顺序',platform_strategy:'平台策略',reason:'原因',text:'内容',claim:'事实声明',fact:'事实点',model:'产品型号',title:'资料标题',source:'来源',qualifier:'限制条件',status:'状态',verdict:'检查结论',message:'说明',passed:'是否通过',checks:'检查项',name:'名称',position:'插入位置',caption:'图片说明',pending:'待确认',action:'操作',talk:'演示话术',step:'步骤',formula:'报价算式',total:'合计',currency:'币种',items:'报价明细',notes:'说明',description:'说明',next_actions:'下一步动作',demo_script:'门店演示脚本',price_notes:'价格说明',grounding:'依据',judgement:'判断',anchor:'共情细节',input:'客户原话',policy:'规则依据',limitations:'限制条件',kind:'类别',code:'检查类型',note:'说明',target:'目标',duration:'时长',why:'判断理由'};
const values = {rule_default:'规则默认方案（需结合客户确认）',model:'模型生成',inquiry:'带来咨询',visit:'邀请到店',compare:'帮助比较',decide:'协助选择',refer:'转介绍',needs_model_choice:'请选择准确型号',need_model_choice:'请选择准确型号',need_info:'需要补充信息',input:'客户原话',user_input:'客户原话',scene_rule:'业务场景规则',inference:'推断（需确认）',fixture:'隔离测试样例',supported:'有依据',needs_confirmation:'需要确认',complete_with_pending:'含待确认项的核对草稿',"portability":"轻薄好携带","battery_charging":"续航与充电","display_comfort":"屏幕观感与护眼","color_creation":"色彩与创作显示","multi_device":"多设备协同","performance_memory":"处理器与内存存储","ports_expansion":"接口与扩展","privacy_security":"隐私与安全开关","pen_input":"手写与触控输入","big_canvas":"大屏与大画布","audio_meeting":"会议音视频","keyboard_typing":"键盘与输入手感","migration_ease":"换机迁移与易上手","long_use":"长期使用的配置余量","deployment_manage":"部署与管理友好","design_look":"外观与配色","accessory_bundle":"配件与包装清单",demo_fixture:"隔离演示示例",none:"尚无检索资料",CNY:'人民币',rule_based:'规则推导',not_verified:'未核验',not_available:'暂无依据',complete:'已完成',needs_input:'需要补充信息',needs_configuration:'需要配置连接',needs_manual:'需要人工确认',pending:'待确认',pass:'通过',passed:'通过',fail:'未通过',blocked:'已拦截',verified:'已核验',unverified:'未核实',awareness:'初步了解',consideration:'考虑购买',comparison:'对比选择',decision:'准备购买',post_purchase:'已购服务',back_to_school:'开学季',business_office:'职场办公',content_creation:'内容创作',home_upgrade:'家庭换新',enterprise_procurement:'企业采购',store_visit:'门店到访',new_launch:'新品首发',festival:'节日营销',xiaohongshu:'小红书',wechat_mp:'公众号',moments:'门店朋友圈',poster:'门店海报',live:'真实模式',demo:'演示模式',mirror:'本地镜像',mock:'模拟生成',true:'是',false:'否'};
let taskId = null, result = null, stream = null, activeInput = null, busy = false;
const factAnchors = new Map();
function node(tag, text, cls) { const e = document.createElement(tag); if(text !== undefined) e.textContent = text; if(cls) e.className = cls; return e; }
function showNotice(text, warning = false) { const e=$(warning?'blocked-banner':'notice'); e.textContent=text; e.hidden=!text; }
function resetProgress() { $('progress').replaceChildren(...Object.entries(stages).map(([key,title])=>{const e=node('div',title,'stage');e.id=`stage-${key}`;e.dataset.status='waiting';return e;})); }
function setBusy(value) { busy=value; $('btn-submit').disabled=value; $('btn-revise').disabled=value; $('btn-ask-submit').disabled=value; $('btn-submit').textContent=value?'正在生成方案…':'生成本次营销方案 →'; }
function display(value) { return values[String(value)] || String(value); }
function safeUrl(value) { try {if(typeof value!=='string'||! /^(https?:\/\/|\/)/i.test(value))return null;const u=new URL(value,location.origin);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;} }
function renderValue(container, value, depth=0) {
  if(value===null || value===undefined || value==='') return;
  if(typeof value!=='object') {container.append(node('p',display(value)));return;}
  if(Array.isArray(value)) {if(!value.length){container.append(node('p','暂无记录'));return;}value.forEach((item)=>{const e=node('div',undefined,'record');renderValue(e,item,depth+1);container.append(e);});return;}
  Object.entries(value).forEach(([key,v])=>{if(v==null || key.endsWith('_id') || key==='id' || key==='url')return;const e=node('div',undefined,'field');e.append(node(depth===0?'h4':'span',labels[key]||key,depth===0?'':'field-label'));if((key==='source'||key==='official_url')&&typeof v==='string'&&safeUrl(v)){const a=node('a',v,'source-link');a.href=safeUrl(v);a.target='_blank';a.rel='noopener noreferrer';e.append(a);}else if(['fact_ids','evidence_ids','basis_fact_ids'].includes(key)) references(e,v);else renderValue(e,v,depth+1);container.append(e);});
}
async function api(path,body) {const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw new Error('服务返回格式异常，请重试。');}if(!response.ok||data.ok===false)throw new Error(data.error?.message||data.message||'请求失败，请检查本机服务。');return data.data??data;}
async function loadConfig() {
  try {
    const c = await api('/api/config');
    $('kb-name').textContent = c.ima?.kb_name || '任德耀新建华为PC知识库';
    $('kb-state').textContent = c.ima?.configured ? '已配置凭证，连接结果以本次检索为准' : '未配置 ima 凭证';
    $('mirror-badge').textContent = '演示与真实模式独立';
    const protocol = {chat:'兼容聊天接口',responses:'Responses 接口',codex:'本地 Codex'}[c.llm?.driver === 'codex' ? 'codex' : c.llm?.protocol || c.llm?.wire_api] || '协议待确认';
    const host = c.llm?.host || c.llm?.base_host || '';
    $('llm-mode').textContent = c.llm?.configured ? `模型已配置 · ${protocol}${host ? ' · '+host : ''}` : '模型未配置';
    $('kb-last-api').textContent = c.ima?.last_api?.message || c.ima?.last_api?.summary || '';
    if(c.llm?.wire_api) $('c-protocol').value = c.llm.wire_api;
    if(c.llm?.driver) $('c-driver').value = c.llm.driver;
  } catch {
    $('kb-state').textContent = '本机服务暂不可用';
    $('llm-mode').textContent = '请确认服务已启动';
  }
}
function formInput() {return {product:$('f-product').value.trim(),audience:$('f-audience').value.trim(),scene:$('f-scene').value,platform:$('f-platform').value,description:$('f-description').value.trim(),constraints:$('f-constraints').value.split(/\n/).map(v=>v.trim()).filter(Boolean),quantity:$('f-quantity').value?Number($('f-quantity').value):null,budget:$('f-budget').value?{min:null,max:Number($('f-budget').value)}:null,mode:$('f-demo').checked?'demo':'live'};}
function updateProgress(event) {
  const key = event.stage === 'generate' ? 'draft' : event.stage;
  const target = $(`stage-${key}`);
  if (target) {
    const state = { complete:'done', success:'done', failed:'failed', retry:'retrying', fallback:'degraded' }[event.status] || event.status || 'running';
    target.dataset.status = state;
    target.title = event.message || '';
    const message = target.querySelector('.stage-message') || node('small', undefined, 'stage-message');
    message.textContent = event.message || '';
    const metrics = target.querySelector('.stage-metrics') || node('small', undefined, 'stage-metrics');
    const ms = event.elapsed_ms ?? event.duration_ms ?? event.ms;
    const attempts = event.attempts ?? event.attempt;
    const retries = event.retries ?? event.retry_count;
    const parts = [];
    if (Number.isFinite(ms) && ms >= 0) { target.dataset.ms = String(ms); }
    if (Number.isFinite(attempts) && attempts >= 0) { target.dataset.attempts = String(attempts); }
    if (Number.isFinite(retries) && retries >= 0) { target.dataset.retries = String(retries); }
    parts.push(target.dataset.ms !== undefined ? `耗时 ${(Number(target.dataset.ms)/1000).toFixed(1)} 秒` : '耗时待返回');
    if(target.dataset.attempts !== undefined) parts.push(`尝试 ${target.dataset.attempts} 次`);
    if(target.dataset.retries !== undefined) parts.push(`重试 ${target.dataset.retries} 次`);
    if(target.dataset.attempts === undefined && target.dataset.retries === undefined) parts.push('次数待返回');
    const provider = event.provider_role ?? event.provider;
    if (provider === 'fallback' || event.fallback === true) target.dataset.provider = '备用服务';
    else if(provider === 'primary') target.dataset.provider = '主服务';
    if(target.dataset.provider) parts.push(target.dataset.provider);
    if(event.degraded_reason || event.fallback_reason) { target.dataset.degradedReason = event.degraded_reason || event.fallback_reason; parts.push(`降级：${display(target.dataset.degradedReason)}`); }
    metrics.textContent = parts.join(' · ');
    target.append(message, metrics);
  }
  if(event.message) showNotice(event.message);
  if(event.summary || event.public_output) {
    $('stage-previews').hidden=false;
    let card=$(`stage-preview-${key}`);
    if(!card){card=node('section',undefined,'record');card.id=`stage-preview-${key}`;$('stage-preview-content').append(card);}
    card.replaceChildren(node('h4',stages[key]||'任务状态'));renderValue(card,event.summary||event.public_output);
  }
}
function renderQuestions(questions=[], candidates=[]) {
  const list=$('questions');list.replaceChildren();$('model-candidates').replaceChildren();
  for(const candidate of candidates){
    const card=node('div',undefined,'candidate-card');card.append(node('h4',candidate.model_name||candidate.name||candidate.model_id||'候选型号'));
    card.append(node('p',candidate.why||candidate.reason||'选择理由待返回'));references(card,candidate.fact_ids);
    const button=node('button','选择此型号并继续','secondary');button.type='button';
    button.addEventListener('click',()=>{$('f-product').value=candidate.model_name||candidate.name||candidate.model_id;submit(formInput());});card.append(button);$('model-candidates').append(card);
  }
  questions.forEach((q,index)=>{
    const item=typeof q==='string'?{question:q,id:`q${index}`}:q,id=item.id||item.field||`q${index}`;
    const label=node('label',item.question||item.text||item.message||'请补充信息');label.htmlFor=`q-${id}`;
    let input;
    if(item.type==='multi'){
      input=node('fieldset',undefined,'question-options');input.append(node('legend',item.question||'请选择可适用的选项'));
      for(const option of item.options||[]){const text=typeof option==='string'?option:option.label||option.name||option.value;const optionLabel=node('label',undefined,'checkbox');const box=node('input');box.type='checkbox';box.value=typeof option==='string'?option:option.value||text;optionLabel.append(box,node('span',text));input.append(optionLabel);}
      input.dataset.kind='multi';
    } else if(item.options?.length){input=node('select');input.append(new Option('请选择',''));for(const option of item.options){const text=typeof option==='string'?option:option.label||option.name||option.value;input.append(new Option(text,typeof option==='string'?option:option.value||text));}}
    else {input=node('input');input.type=item.type==='number'?'number':'text';}
    input.id=`q-${id}`;input.dataset.question=id;input.dataset.field=item.field||'';if(input.tagName!=='FIELDSET')input.required=true;
    if(item.type!=='multi')list.append(label);list.append(input);if(item.why)list.append(node('p',item.why,'form-hint'));
  });
  $('ask-form').hidden=!questions.length&&!candidates.length;
  $('btn-ask-submit').hidden=!questions.length;
}
function section(id,data){const content=$(id).querySelector('.section-content');content.replaceChildren();renderValue(content,data);}
function references(container, ids) {
  for(const id of Array.isArray(ids) ? ids : []) {
    const anchor = factAnchors.get(String(id));
    if(anchor) {
      const link=node('a', `依据 ${id}`, 'fact-ref'); link.href='#'+anchor;
      link.addEventListener('click',()=>{ $('sec-basis').open=true; setTimeout(()=>$(anchor)?.scrollIntoView({behavior:'smooth',block:'center'}),0); });
      container.append(link);
    } else container.append(node('span', `引用 ${id}（出处待确认）`, 'pending-ref'));
  }
}
function sourceLink(container, url, title='查看原始资料') {
  const safe = typeof url==='string' ? safeUrl(url) : null;
  if(safe){ const link=node('a',title,'source-link');link.href=safe;link.target='_blank';link.rel='noopener noreferrer';container.append(link); }
  else container.append(node('p','原始资料链接待确认','muted'));
}
function renderEvidence(evidence=[]) {
  const c=$('sec-basis').querySelector('.section-content');c.replaceChildren();factAnchors.clear();
  if(!evidence.length){c.append(node('p','暂无可核实的产品事实依据。此区域不会用演示输入冒充知识库资料。','muted'));return;}
  evidence.forEach((fact,index)=>{
    const id=String(fact.id||fact.fact_id||`entry-${index+1}`),anchor=`fact-source-${index+1}`;factAnchors.set(id,anchor);
    const card=node('article',undefined,'evidence-card');card.id=anchor;
    card.append(node('h4',`${id} · ${fact.model||fact.model_name||'产品型号待确认'}`));
    if(fact.demo===true||fact.origin==='fixture'||fact.source==='demo_fixture')card.append(node('p','隔离测试样例，非 ima 产品事实','sample-notice'));
    card.append(node('p',fact.fact||fact.text||'事实内容待确认'));
    renderValue(card,{title:fact.title||fact.doc_title||'资料标题待确认',source:fact.source||fact.origin||'来源待确认',qualifier:fact.qualifier||fact.limits});
    sourceLink(card,fact.source_url||fact.source_page_url||fact.url);
    c.append(card);
  });
}
function renderArticle(article={}) {
  const c=$('sec-article').querySelector('.section-content');c.replaceChildren();
  if(article.title)c.append(node('h3',article.title));
  if(article.lead)c.append(node('p',article.lead));
  for(const [index,p] of (article.paragraphs||article.segments||[]).entries()){
    const block=node('div',undefined,'article-segment');block.dataset.segment=String(index+1);
    if(typeof p==='string')block.append(node('p',p));
    else { if(p.heading)block.append(node('h4',p.heading));block.append(node('p',p.text||p.content||''));references(block,p.fact_ids||p.evidence_ids); }
    c.append(block);
  }
  if(article.cta)c.append(node('p',typeof article.cta==='string'?article.cta:article.cta.text));
  if(article.tags?.length)c.append(node('p',article.tags.join(' ')));
  if(article.poster)renderValue(c,article.poster);
  const images=article.images||[];
  if(!images.length)c.append(node('p','暂无已核验配图；图片名称、型号、来源和位置须确认后才能交付。','muted'));
  for(const image of images){
    const ref=node('div',undefined,'image-reference');ref.append(node('h4',image.name||'图片名称待确认'));
    if(image.demo===true||image.origin==='fixture')ref.append(node('p','隔离图片测试样例，非 ima 素材','sample-notice'));
    const preview=image.url||image.preview_url;
    if(preview&&safeUrl(preview)){
      const img=node('img');img.src=safeUrl(preview);img.alt=image.caption||image.name||'知识库配图';img.loading='lazy';
      img.addEventListener('error',()=>{img.remove();ref.prepend(node('p','图片暂无法预览，请核对原始资料。'));},{once:true});ref.append(img);
    }
    renderValue(ref,{model:image.model||image.model_name||'图片自身型号待确认',source:image.source||image.source_doc||'资料来源待确认',position:image.position||image.insert_position||'插入位置待确认',caption:image.caption||'图片说明待确认',verification:image.verification||image.check||'图片来源与型号核验结果待返回'});
    sourceLink(ref,image.source_url||image.source_page_url);
    c.append(ref);
  }
}
function renderPlan(plan={}) {
  const c=$('sec-plan').querySelector('.section-content');c.replaceChildren();const quote=plan.quote;
  c.append(node('h4','报价明细'));
  if(!quote){c.append(node('p','报价待确认：缺少可核实的 SKU、价格、渠道与日期。','muted'));}
  else {
    if(quote.demo===true||quote.origin==='fixture')c.append(node('p','虚构报价样例，仅供规则与算术测试，不是任何在售产品报价。','sample-notice'));
    c.append(node('p',`报价状态：${display(quote.status||'pending')}`));
    const rows=quote.items?.length?quote.items:[quote];
    const wrap=node('div',undefined,'table-scroll');const table=node('table',undefined,'quote-table');
    const head=node('tr');['型号 / SKU','含税单价','数量','已核实减免','小计'].forEach(x=>head.append(node('th',x)));const thead=node('thead');thead.append(head);table.append(thead);
    const tbody=node('tbody');const amount=v=>Number.isFinite(v)?`${v.toFixed(2)} ${quote.currency==='CNY'?'元':quote.currency||'币种待确认'}`:'待确认';
    for(const item of rows){const row=node('tr');const cells=[item.sku||item.sku_text||item.model||quote.sku||quote.sku_text||'SKU待确认',amount(item.unit_price),Number.isFinite(item.quantity)?String(item.quantity):'待确认',amount(item.discount??item.discount_amount),amount(item.subtotal)];cells.forEach(x=>row.append(node('td',x)));tbody.append(row);}
    table.append(tbody);wrap.append(table);c.append(wrap);
    renderValue(c,{formula:quote.formula||'已核验算式待返回',total:Number.isFinite(quote.total)?amount(quote.total):'待确认',verified_at:quote.verified_at||quote.date||'核验日期待确认',channel:quote.channel||'渠道待确认',region:quote.region||quote.region_text||'地区待确认',notes:quote.notes||quote.pending_notes});
    sourceLink(c,quote.source_url||quote.official_url,'查看报价原始依据');
  }
  renderValue(c,{demo_script:plan.demo_script,next_actions:plan.next_actions,price_notes:plan.price_notes});
}
function renderResult(data) {result=data;setBusy(false);if(stream){stream.close();stream=null;}$('empty-state').hidden=true;$('output').hidden=false;$('notice').hidden=true;$('blocked-banner').hidden=true;const demo=data.mode==='demo';$('mirror-badge').textContent=demo?'演示模式 · 非实时核验':'真实模式';$('mirror-badge').className='badge';const notices=[];if(demo)notices.push('当前为演示结果，资料与模型输出用于流程展示，不代表 ima 实时检索或正式验收。');if(data.source)notices.push(`资料来源：${typeof data.source==='string'?display(data.source):JSON.stringify(data.source)}`);if(data.status==='complete_with_pending')notices.push('当前为含待确认项的核对草稿，可导出供核对；发布前请逐项确认，不代表最终审核通过。');if(data.warnings?.length)notices.push(...data.warnings.map(w=>typeof w==='string'?w:w.message||w.reason||JSON.stringify(w)));if(notices.length)showNotice(notices.join('\n'));const blocked=['needs_input','needs_configuration','needs_manual','error','manual_required','needs_model_choice','need_info','need_model_choice'].includes(data.status);if(blocked)showNotice(`${display(data.status)}${data.message?'：'+data.message:''}`,true);renderEvidence(data.evidence||[]);renderQuestions(data.questions||[],data.model_candidates||data.task?.model_candidates||[]);section('sec-insight',data.insight);section('sec-scene',data.strategy?{...data.scene,strategy:data.strategy}:data.scene);renderArticle(data.article);section('sec-verify',data.verification);renderPlan(data.plan||{});const canExport=Boolean(data.copy_text)&&['complete','complete_with_pending'].includes(data.status);$('btn-copy').disabled=!canExport;$('btn-export').disabled=!canExport;$('download-text').hidden=!canExport||!taskId;$('download-text').href=taskId?`/api/tasks/${encodeURIComponent(taskId)}/export`:'#';$('text-preview').hidden=!canExport;$('copy-preview').value=canExport?data.copy_text:'';$('revise-form').hidden=blocked;$('r-platform').value=activeInput?.platform||'xiaohongshu';}
async function submit(input) {if(busy)return;$('btn-retry').hidden=true;$('stage-previews').hidden=true;$('stage-preview-content').replaceChildren();if(stream)stream.close();activeInput=input;result=null;taskId=null;resetProgress();setBusy(true);$('output').hidden=true;$('empty-state').hidden=false;$('btn-copy').disabled=true;$('btn-export').disabled=true;$('download-text').hidden=true;$('text-preview').hidden=true;$('ask-form').hidden=true;showNotice('正在创建任务…');showNotice('',true);try{const response=await api('/api/tasks',input);taskId=response.task_id||response.run_id;if(!taskId){renderResult(response);return;}stream=new EventSource(`/api/tasks/${encodeURIComponent(taskId)}/events`);stream.addEventListener('progress',e=>{try{updateProgress(JSON.parse(e.data));}catch{showNotice('收到进度更新。');}});stream.addEventListener('result',e=>{try{renderResult(JSON.parse(e.data));}catch{failure('结果显示异常，请重新生成。');}});stream.addEventListener('error',e=>{if(e.data){try{failure(JSON.parse(e.data).message||'生成失败，请重试。');}catch{failure('生成失败，请重试。');}}else failure('与服务的连接已断开，请重试；左侧任务已保留。');});}catch(error){failure(error.message);}}
function failure(message){setBusy(false);$('btn-retry').hidden=false;if(stream){stream.close();stream=null;}showNotice('',false);showNotice(message,true);}
$('task-form').addEventListener('submit',e=>{e.preventDefault();submit(formInput());});
$('ask-form').addEventListener('submit',e=>{
  e.preventDefault();const answers={},extra=[];
  for(const field of $('questions').querySelectorAll('[data-question]')){
    const value=field.dataset.kind==='multi'?[...field.querySelectorAll('input:checked')].map(x=>x.value):field.value;
    answers[field.dataset.question]=value;
    const name=field.dataset.field,target=$(`f-${name}`);
    if(['product','audience','scene','platform','quantity','budget'].includes(name)&&target)target.value=Array.isArray(value)?value.join('、'):value;
    else extra.push(`${field.previousElementSibling?.textContent||field.querySelector('legend')?.textContent||'补充信息'}：${Array.isArray(value)?value.join('、'):value}`);
  }
  if(extra.length)$('f-description').value+='\n'+extra.join('\n');
  submit({...formInput(),answers});
});
function sample(kind){$('f-product').value='HUAWEI MateBook Pro S';$('f-audience').value=kind==='student'?'大学新生与家长':'经常出差的职场人士';$('f-scene').value=kind==='student'?'back_to_school':'business_office';$('f-platform').value=kind==='student'?'xiaohongshu':'wechat_mp';$('f-description').value=kind==='student'?'刚入学，每天背电脑赶早八，担心太重和找不到插座，希望了解适合自己的配置，邀请周末到店体验。':'一周出差两三次，常在高铁上改文档、到客户现场开会，担心设备协同麻烦，希望到店看看实际演示。';showNotice('示例已填入，可调整后生成。');}
$('sample-student').addEventListener('click',()=>sample('student'));$('sample-business').addEventListener('click',()=>sample('business'));
$('btn-settings').addEventListener('click',()=>$('settings').showModal());$('btn-close-settings').addEventListener('click',()=>$('settings').close());
$('settings-form').addEventListener('submit',async e=>{e.preventDefault();const config={llm_driver:$('c-driver').value,llm_wire_api:$('c-protocol').value,llm_base_url:$('c-base').value.trim(),llm_model:$('c-model').value.trim(),llm_api_key:$('c-key').value,ima_client_id:$('c-client').value,ima_api_key:$('c-ima').value};Object.keys(config).forEach(k=>{if(!config[k])delete config[k];});$('btn-save-settings').disabled=true;try{await api('/api/config',config);$('c-key').value='';$('c-client').value='';$('c-ima').value='';$('config-message').textContent='配置已保存到本次服务会话，生成时会验证连接。';await loadConfig();}catch(error){$('config-message').textContent=error.message;}finally{$('btn-save-settings').disabled=false;}});
$('btn-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.copy_text);showNotice('全文已复制。');}catch{showNotice('浏览器未允许复制，请使用导出文本。',true);}});
$('btn-export').addEventListener('click',()=>{$('text-preview').hidden=false;$('copy-preview').focus();$('copy-preview').select();$('text-preview').scrollIntoView({behavior:'smooth',block:'center'});});
$('revise-form').addEventListener('submit',e=>{
  e.preventDefault();
  const kind=$('r-kind').value,input={...activeInput};
  const segment_ids=$('r-segments').value.split(/[，,、\s]+/).filter(Boolean);
  const revision_request={kind,segment_ids,platform:kind==='change_platform'?$('r-platform').value:undefined,focus_key:$('r-focus').value.trim()||undefined,note:$('r-note').value.trim()||undefined};
  if(kind==='delete_segment'&&!segment_ids.length&&!revision_request.note){showNotice('请填写要删除的正文段号。',true);$('r-segments').focus();return;}
  if(kind==='change_platform'){input.platform=$('r-platform').value;$('f-platform').value=input.platform;}
  submit({...input,revision_request,previous_task_id:taskId});
});
$('btn-retry').addEventListener('click',()=>submit(activeInput||formInput()));
async function loadOptions(){try{const options=await api('/api/options');if(options.models?.length){$('model-list').replaceChildren(...options.models.map(m=>{const o=node('option');o.value=m.model_name||m.name||m.model_id;return o;}));}}catch{/* 服务尚未提供选项时保留自由输入。 */}}
resetProgress();loadConfig();loadOptions();
