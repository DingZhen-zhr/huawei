import { useEffect, useMemo, useState } from 'react';
import { Store, Database, RefreshCw, ArrowRight, FileCheck2, Download, Copy, AlertTriangle, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Md from '@/components/Md';
import { PRODUCTS, SCENE_STRATEGIES, PLATFORM_RULES, missingFields, platformIssues, canExport, exportDocument } from '@/lib/workflow';
import type { ArticleTask, ArticleResult } from '@/lib/workflow';
import type { ServiceStatus } from '../../server/contracts';

const initial:ArticleTask={modelId:'matebook-pro',scenario:'内容创作',platform:'小红书',audience:'',customerQuote:'',identity:'',software:'',buyingStage:'比较选型',goal:'评论咨询',withPrice:false};
interface Version {id:number;task:ArticleTask;result:ArticleResult;change:string}
const stageNames=['① 场景解析','② 平台策略','③ 资料与图片检索','④ 事实点提取','⑤ 图文编排','⑥ 软文生成','⑦ 事实核验','⑧ 合规检查','⑨ 导出'];
const connectionLabel={unconfigured:'未连接',verified:'已验证',failed:'失败'};
export default function Home(){
 const [task,setTask]=useState<ArticleTask>(initial);
 const [status,setStatus]=useState<ServiceStatus|null>(null);
 const [probeError,setProbeError]=useState('');
 const [probing,setProbing]=useState(false);
 const [running,setRunning]=useState(false);
 const [versions,setVersions]=useState<Version[]>([]);
 const [revision,setRevision]=useState('');
 const [error,setError]=useState('');
 const [reviewed,setReviewed]=useState(false);
 const [imageState,setImageState]=useState<Record<string,boolean>>({});
 const [notice,setNotice]=useState('');
 const current=versions.at(-1);
 const stale=!!current&&JSON.stringify(current.task)!==JSON.stringify(task);
 const missing=missingFields(task);
 const probe=async()=>{setProbing(true);setProbeError('');try{const response=await fetch('/api/status');if(!response.ok)throw new Error();setStatus(await response.json());}catch{setStatus(null);setProbeError('连接状态读取失败；请检查本地服务后重试。');}finally{setProbing(false);}};
 useEffect(()=>{localStorage.removeItem('deepseek-key');void probe();},[]);
 const checks=useMemo(()=>{
  if(!current)return ['尚未生成稿件'];
  const r=current.result;
  const problems=[...r.issues,...platformIssues(current.task.platform,r.title??'',r.body??'',r.images?.length??0)];
  if(!r.ok||!r.body)problems.push('服务未取得可核验稿件');
  if(!r.facts?.length)problems.push('未取得指定ima事实原文');
  if(!r.claimChecks?.length)problems.push('缺少正文事实映射');
  const ids=new Set(r.facts?.map(f=>f.id)??[]);
  if(r.claimChecks?.some(c=>{if(!c||typeof c!=='object')return true;const check=c as {text?:unknown;factIds?:unknown;section?:string};return typeof check.text!=='string'||!Array.isArray(check.factIds)||(check.factIds.length===0&&check.section!=='cta')||check.factIds.some(id=>!ids.has(String(id)));}))problems.push('事实映射格式不完整或含未知来源');
  (r.images??[]).forEach(i=>{if(imageState[i.id]!==true)problems.push(`图片尚未加载或不可访问：${i.filename}`);});
  return [...new Set(problems)];
 },[current,imageState]);
 const formal=!!current&&canExport(checks,reviewed,stale)&&!running&&!revision.trim();
 const document=current?exportDocument(current.task,{...current.result,issues:[...current.result.issues,...checks],verification:formal?{status:'human-reviewed',issues:['负责人已确认逐句、图片及营销合规；发布前需复核动态信息。']}:current.result.verification,message:stale?'输入已变化，旧稿过期；请重生成':formal?'已完成人工逐项复核，发布前复核动态信息':current.result.message},current.id,formal):'';
 const edit=(key:keyof ArticleTask,value:string|boolean)=>{setTask(t=>({...t,[key]:value}));setReviewed(false);};
 const generate=async(next:ArticleTask=task,change='首次生成')=>{
  setReviewed(false);setError('');setNotice('');
  const questions=missingFields(next);if(questions.length){setError(`请先补充：${questions.join('；')}`);return;}
  setRunning(true);
  try{
   const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:next,...(change!=='首次生成'?{revision:change,previous:current?.result.body?{title:current.result.title,body:current.result.body}:undefined}:{})})});
   const result=await response.json() as ArticleResult;
   if(typeof result.ok!=='boolean'||!Array.isArray(result.issues))throw new Error('服务响应格式错误');
   if(result.body&&result.tags?.length)result.body+='\n\n'+result.tags.join(' ');
   setVersions(v=>[...v,{id:(v.at(-1)?.id??0)+1,task:{...next},result,change}]);setImageState({});if(result.ok)setRevision('');
   if(!result.ok)setError(result.message);
  }catch{setError('请求失败，上一稿保留。请检查服务后重试；未生成新稿。');}
  finally{setRunning(false);}
 };
 const transfer=()=>{const names=Object.keys(PLATFORM_RULES);const platform=names[(names.indexOf(task.platform)+1)%names.length];const next={...task,platform,goal:PLATFORM_RULES[platform].cta};setTask(next);void generate(next,`转为${platform}，按新平台重写并重验`);};
 const copy=async()=>{try{await navigator.clipboard.writeText(document);setNotice('已复制当前版本四分区全文');}catch{setNotice('浏览器未允许剪贴板，请下载当前稿件。');}};
 const download=()=>{if(!current)return;const url=URL.createObjectURL(new Blob([document],{type:'text/markdown;charset=utf-8'}));const a=window.document.createElement('a');a.href=url;a.download=`${formal?'待发布复核':'不可发布草稿'}-${current.task.modelId}-${current.task.scenario}-${current.task.platform}-v${current.id}.md`;a.click();URL.revokeObjectURL(url);};
 const fieldClass='w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:bg-slate-50';
 return <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
  <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-700 p-3 text-white"><Store size={22}/></div><div><h1 className="text-lg font-bold">AI+华为PC营销软文智能体</h1><p className="mt-1 text-xs text-slate-500">门店增长工作台 · 从客户任务到可追溯图文</p></div></div><Button variant="outline" onClick={()=>void probe()} disabled={probing||running}><RefreshCw size={14} className="mr-2"/>{probing?'正在探测连接':'重新检测连接'}</Button></div></header>
  <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
   <div className="mb-6 grid gap-3 md:grid-cols-2">{(['knowledgeBase','model'] as const).map(key=><div key={key} className="flex gap-3 rounded-xl border bg-white p-4"><Database className="mt-1 shrink-0 text-red-700" size={19}/><div><div className="flex flex-wrap items-center gap-2 text-sm font-semibold">{key==='knowledgeBase'?'指定 ima 网关适配':'生成模型'}<span className={`rounded-full px-2 py-0.5 text-xs ${status?.[key].status==='verified'?'bg-green-50 text-green-800':'bg-amber-50 text-amber-800'}`}>{status?connectionLabel[status[key].status]:probing?'连接中':'状态未知'}</span></div><p className="mt-1 text-xs text-slate-500">{key==='knowledgeBase'?'任德耀新建华为PC知识库 · ':''}{status?.[key].message??probeError??'等待真实探测'}</p>{status?.[key].checkedAt&&<p className="mt-1 text-xs text-slate-400">最近探测：{new Date(status[key].checkedAt!).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</p>}</div></div>)}</div>
   <div className="grid items-start gap-5 lg:grid-cols-[350px_minmax(0,1fr)]">
    <aside className="space-y-4"><section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">任务输入</h2><button className="text-xs text-slate-500" disabled={running} onClick={()=>{setTask({...initial});setReviewed(false);}}>重置输入</button></div>
     <div className="space-y-3"><label className="block text-xs text-slate-500">精确产品型号<select aria-label="精确产品型号" disabled={running} className={`${fieldClass} mt-1`} value={task.modelId} onChange={e=>edit('modelId',e.target.value)}>{Object.entries(PRODUCTS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     <div className="grid grid-cols-2 gap-3"><label className="block text-xs text-slate-500">业务场景<select aria-label="业务场景" disabled={running} className={`${fieldClass} mt-1`} value={task.scenario} onChange={e=>edit('scenario',e.target.value)}>{Object.keys(SCENE_STRATEGIES).map(s=><option key={s}>{s}</option>)}</select></label><label className="block text-xs text-slate-500">发布平台<select aria-label="发布平台" disabled={running} className={`${fieldClass} mt-1`} value={task.platform} onChange={e=>{setTask(t=>({...t,platform:e.target.value,goal:PLATFORM_RULES[e.target.value].cta}));setReviewed(false);}}>{Object.keys(PLATFORM_RULES).map(s=><option key={s}>{s}</option>)}</select></label></div>
     {([{key:'identity',label:'年份 / 系统 / 销售配置 / 屏幕版',placeholder:'例：2026 / HarmonyOS 版本 / 24GB+1TB / 柔光屏（待你确认）'},{key:'audience',label:'已确认目标人群',placeholder:'填写真实客户人群，不以场景假设代替'},{key:'customerQuote',label:'客户原话 / 具体任务',placeholder:SCENE_STRATEGIES[task.scenario].question},{key:'software',label:'必装软件 / 插件 / 外设与版本',placeholder:'填写待验证项；不确定请写明待确认'},{key:'buyingStage',label:'购买阶段',placeholder:'了解 / 比较选型 / 到店验证 / 采购验收'},{key:'goal',label:'唯一行动目标',placeholder:'仅保留一个动作'}] as const).map(f=><label key={f.key} className="block text-xs text-slate-500">{f.label}<input aria-label={f.label} disabled={running} className={`${fieldClass} mt-1`} value={task[f.key]} placeholder={f.placeholder} onChange={e=>edit(f.key,e.target.value)}/></label>)}
     <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={running} checked={task.withPrice} onChange={e=>edit('withPrice',e.target.checked)}/>申请引用有依据价格（需同SKU当前复核）</label>
     <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">{PLATFORM_RULES[task.platform].structure}<br/>配图：{PLATFORM_RULES[task.platform].min}–{PLATFORM_RULES[task.platform].max}张；仅使用指定ima真实来源。</div>
     {missing.length>0&&<div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">待补充：{missing.join('；')}。补齐后才会请求资料与模型。</div>}
     <Button className="w-full bg-red-700 hover:bg-red-800" disabled={running} onClick={()=>void generate()}><ArrowRight size={16} className="mr-2"/>{running?'正在检索与生成，等待真实响应…':'检索资料并生成'}</Button><Button variant="outline" className="w-full" disabled={running} onClick={transfer}>换平台重生成</Button>
     </div></section>
     <details className="rounded-xl border bg-white p-4 text-xs text-slate-500"><summary className="cursor-pointer font-semibold text-slate-700">接入与使用说明</summary><p className="mt-3 leading-relaxed">当前使用待部署的自定义只读ima网关协议适配，尚未完成原生ima API联调。管理员按服务端契约配置真实网关和模型环境变量。模型响应、资料身份和图片均需核验；未接入时保留阻断记录。浏览器不保存密钥或客户任务。</p><p className="mt-2">本地v7为离线参考，未接入当前正式生成。所有演示步骤均为待验证计划。</p></details>
    </aside>
    <div className="min-w-0 space-y-4">
     <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-medium tracking-widest text-red-700">四分区交付</div><h2 className="mt-1 text-xl font-semibold">把任务写清楚，让每句都有依据</h2></div><span className="rounded-full border bg-white px-3 py-1 text-xs text-slate-500">{running?'检索 / 生成中':stale?'旧稿已过期':current?`${current.result.ok?'待人工复核':'已阻断'} · v${current.id}`:'等待任务'}</span></div>
     {(error||stale)&&<div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle size={18} className="shrink-0"/><div>{error}{stale&&<p>输入已变化，旧稿核验失效。请重新生成；草稿导出保留原任务快照。</p>}{error&&<button className="mt-2 block underline" disabled={running} onClick={()=>void generate()}>重试当前任务</button>}</div></div>}
     <section className="rounded-2xl border bg-white p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><span className="text-red-700">一</span> 场景判断</h3><p className="text-sm leading-7">{(current?.task??task).audience||'等待确认目标人群'} · {(current?.task??task).scenario} · {(current?.task??task).buyingStage}</p><p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">客户原话：{(current?.task??task).customerQuote||'请记录真实客户任务，作为内容切入依据。'}</p><p className="mt-3 text-sm">唯一目标：{(current?.task??task).goal}；策略：{SCENE_STRATEGIES[(current?.task??task).scenario].focus}</p></section>
     <section className="rounded-2xl border bg-white p-5"><h3 className="mb-3 font-semibold"><span className="mr-2 text-red-700">二</span>知识库依据</h3><p className="mb-3 break-words text-xs text-slate-500">身份快照：{current?.task.identity||'完整型号 / 年份 / 系统版本 / 销售配置 / 屏幕版，待确认'}</p>{current?.result.facts?.length?current.result.facts.map(f=><details key={f.id} className="mb-2 rounded-lg border p-3"><summary className="cursor-pointer text-sm">[{f.id}] {f.claim}</summary><div className="mt-2 space-y-2 break-words text-xs leading-relaxed text-slate-500"><p>原文：{f.quote}</p><p>条件：{f.conditions}</p><p>{f.knowledgeBase} / {f.title} / {f.entryId} / {f.location}</p><p>身份：{f.identity}；日期：{f.date}；核查：{f.verifiedAt}</p></div></details>):<div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-400">尚未取得指定ima原文与图片<br/><span className="text-xs">连接后展示条目、定位、日期及限定条件</span></div>}</section>
     <section className="rounded-2xl border bg-white p-5"><h3 className="mb-3 font-semibold"><span className="mr-2 text-red-700">三</span>图文软文</h3>{current?.result.body?<><h4 className="mb-4 text-lg font-semibold">{current.result.title}</h4><Md text={current.result.body}/><p className="mt-4 text-sm font-semibold">{current.result.cta}</p></>:<p className="text-sm leading-7 text-slate-400">取得有效资料与模型响应后，正文将在这里呈现。当前不填充未经核实的产品文案。</p>}
     <div className="mt-4 grid gap-3 sm:grid-cols-2">{current?.result.images?.map(i=><figure key={i.id} className="min-w-0 rounded-lg border p-3"><img className="h-40 w-full object-contain" alt={i.caption} src={i.url} referrerPolicy="no-referrer" onLoad={()=>setImageState(s=>({...s,[i.id]:true}))} onError={()=>{setImageState(s=>({...s,[i.id]:false}));setReviewed(false);}}/><figcaption className="mt-2 break-words text-xs leading-relaxed text-slate-500">{i.filename} · {i.placement}<br/>{i.caption}<br/>来源：{i.title}/{i.entryId}/{i.location}<br/>身份：{i.identity}；条件：{i.conditions}<br/><a className="text-red-700 underline" href={i.url} target="_blank" rel="noreferrer">查看来源图片</a></figcaption></figure>)}</div>
     <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-6"><p>拟演示步骤（尚未实测）：{SCENE_STRATEGIES[(current?.task??task).scenario].demo}</p><p>报价：{current?.result.priceQuote?`${current.result.priceQuote.calculation}；SKU：${current.result.priceQuote.sku}；渠道：${current.result.priceQuote.channel}；条件：${current.result.priceQuote.conditions}；来源：${current.result.priceQuote.title}/${current.result.priceQuote.entryId}/${current.result.priceQuote.location}；当前复核：${current.result.priceQuote.currentVerifiedAt}`:(current?.task??task).withPrice?'待取得指定ima当前复核价格，禁止虚构优惠、库存与补贴。':'当前稿不含价格；需要报价时补充SKU、数量、渠道/地区、日期与来源。'}</p><p>下一步：{(current?.task??task).goal}</p></div>
     <div className="mt-4 border-t pt-4"><label className="mb-2 flex items-center gap-2 text-sm font-medium"><PencilLine size={15}/>修改与重验</label><textarea aria-label="修改要求" className={`${fieldClass} min-h-20`} placeholder="删减 / 换卖点 / 改目标：说明修改要求；每次修改重新检索、生成与核验。" value={revision} disabled={running} onChange={e=>{setRevision(e.target.value);setReviewed(false);}}/><Button variant="outline" className="mt-2" disabled={running||!current?.result.body||!revision.trim()||stale} onClick={()=>void generate(task,revision.trim())}>提交修改并重验</Button></div></section>
     <section className="rounded-2xl border bg-white p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><FileCheck2 size={18} className="text-red-700"/>四、核验结果</h3><p className="text-sm text-slate-600">{current?.result.message??'待生成；尚无事实或图片核验结果。'}</p><ul className="my-3 space-y-2 text-xs text-amber-800">{checks.map((issue,i)=><li key={i}>• {issue}</li>)}</ul>{current?.result.claimChecks?.map((value,i)=>{const check=value as {text:string;factIds:string[]};return <div key={i} className="mb-2 rounded bg-slate-50 p-3 text-xs leading-relaxed"><p>{check.text}</p><p className="mt-1 text-slate-500">对应依据：{check.factIds.join('、')||'纯行动引导，无产品结论'} · 待人工逐句复核</p></div>;})}<p className="text-xs leading-relaxed text-slate-500">规则未命中不代表营销合规通过。请逐句核对原文、条件、型号和每张图片实际画面；发布前复核动态信息。</p><label className="mt-4 flex items-start gap-2 text-xs leading-relaxed"><input aria-label="人工复核确认" type="checkbox" className="mt-1" checked={reviewed} disabled={!current?.result.ok||checks.length>0||stale||running} onChange={e=>setReviewed(e.target.checked)}/>我已逐句核对事实与限制、确认图片身份及使用条件，并完成营销合规复核。</label><div className="mt-4 flex flex-wrap items-center gap-2"><Button variant="outline" disabled={!current||running} onClick={()=>void copy()}><Copy size={14} className="mr-2"/>复制当前{formal?'复核稿':'草稿'}</Button><Button variant="outline" disabled={!current||running} onClick={download}><Download size={14} className="mr-2"/>下载当前{formal?'复核稿':'草稿'}</Button><Button className="bg-red-700 hover:bg-red-800" disabled={!formal} onClick={download}><CheckCircle2 size={14} className="mr-2"/>正式格式导出</Button></div><p aria-live="polite" className="mt-2 text-xs text-slate-500">{notice||'未满足核验要求只能导出带“不可发布”标识的草稿。'}</p></section>
     <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-medium">9阶段过程详情与版本记录</summary><ol className="mt-4 grid gap-2 text-xs sm:grid-cols-3">{stageNames.map((name,i)=><li key={name} className="rounded-lg bg-slate-50 p-3">{name}<p className="mt-1 text-slate-500">{running?'等待服务完整响应':!current?'待开始':i<2?'任务已记录':current.result.ok?(i<6?'已取回结果':i===8?formal?'可导出复核稿':'仅限草稿':'待人工复核'):'服务阻断，未完成'}</p></li>)}</ol><ul className="mt-4 space-y-2 text-xs text-slate-500">{versions.map(v=><li key={v.id}><details><summary className="cursor-pointer">v{v.id} · {v.task.platform} · {v.change} · {v.result.message}</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded bg-slate-50 p-3">{exportDocument(v.task,v.result,v.id,false)}</pre></details></li>)}</ul></details>
    </div>
   </div><footer className="py-6 text-center text-xs text-slate-400">指定知识库 · 单一行动目标 · 逐项来源复核 · 发布由门店负责人确认</footer>
  </main>
 </div>;
}
