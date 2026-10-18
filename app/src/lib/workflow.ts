import type { PriceQuote } from '../../server/contracts';
export interface ArticleTask {
  modelId:string; scenario:string; platform:string; audience:string; customerQuote:string;
  identity:string; software:string; buyingStage:string; goal:string; withPrice:boolean;
}
export interface SourceFact { id:string; claim:string; quote:string; title:string; entryId:string; location:string; date:string; identity:string; conditions:string; knowledgeBase:string; verifiedAt:string }
export interface SourceImage extends Omit<SourceFact,'claim'|'quote'> { filename:string; url:string; caption:string; placement:string }
export interface ArticleResult { ok:boolean; status:'blocked'|'draft'; message:string; issues:string[]; title?:string; body?:string; cta?:string; tags?:string[]; facts?:SourceFact[]; images?:SourceImage[]; claimChecks?:unknown[]; priceQuote?:PriceQuote & {total:number;calculation:string}; generatedAt?:string; verification?:{status:string;issues:string[]} }
export const PRODUCTS:Record<string,string>={'matebook-pro':'HUAWEI MateBook Pro（鸿蒙版）','matebook-14':'HUAWEI MateBook 14（鸿蒙版）','matebook-pro-s':'HUAWEI MateBook Pro S'};
export const SCENE_STRATEGIES:Record<string,{question:string;focus:string;demo:string}>={
  '开学季':{question:'每天携带和课程必装软件有什么要求？',focus:'课程任务 → 携带取舍 → 软件待测项',demo:'准备课程软件清单；逐项打开课程文件，记录版本与操作结果。'},
  '职场办公':{question:'会议前最容易卡在哪一步？',focus:'会前准备 → 外设条件 → 会议验收',demo:'带常用演示文件和投影设备；核对接口后完成连接，记录适配条件。'},
  '内容创作':{question:'素材处理哪一步是硬门槛？',focus:'创作任务 → 证据卡 → 插件与素材待测项',demo:'准备一份获授权的素材与必装软件清单；核对版本，打开、编辑、导出并记录结果。'},
  '家庭换新':{question:'旧机资料和家人的主要用途是什么？',focus:'家庭任务 → 迁移检查 → 服务条件',demo:'备份非敏感示例文件；核对迁移条件后演练复制和打开，不处理真实客户资料。'},
  '企业采购':{question:'业务软件、部署与外设的验收门槛是什么？',focus:'采购需求 → 同SKU证据 → 验收清单',demo:'列出部署、业务软件和外设清单；用拟采购SKU逐项验证并由采购方记录。'},
  '门店到访':{question:'现场最想核对哪一个功能？',focus:'一个问题 → 一个证据 → 到店验证',demo:'选定一个待验证任务；核对资料条件后现场操作，记录成功与失败步骤。'},
  '新品首发':{question:'哪项变化与当前任务有关？',focus:'同源可比证据 → 任务价值 → 适用限制',demo:'核对同库可比型号及日期；使用相同任务和条件逐项记录，未测不写结论。'},
  '节日营销':{question:'送给谁，主要完成什么任务？',focus:'使用对象 → 日常任务 → 选择条件',demo:'先确认收礼人的任务和必装软件；按清单演练，活动权益另行核实。'},
};
export const PLATFORM_RULES:Record<string,{min:number;max:number;structure:string;cta:string}>={
  '小红书':{min:3,max:6,structure:'口语标题 → 具体任务 → 证据卡 → 适合与限制 → 标签',cta:'评论咨询'},
  '公众号':{min:2,max:4,structure:'标题与导语 → 5–8个小标题 → 证据与取舍 → 核对清单；1200–2200字',cta:'领取核验清单'},
  '门店朋友圈':{min:1,max:3,structure:'一个人群与问题 → 一个核心卖点及条件 → 唯一行动；80–180字',cta:'私信咨询'},
  '门店海报':{min:1,max:1,structure:'12–22字主标题 → 副标题 → ≤3卖点 → 条件脚注 → 唯一行动',cta:'预约到店'},
};
export function missingFields(t:ArticleTask):string[]{
  const labels:Partial<Record<keyof ArticleTask,string>>={modelId:'产品型号',scenario:'业务场景',platform:'平台',audience:'确认目标人群',customerQuote:'客户原话或具体任务',identity:'完整身份（年份/系统/配置/屏幕版）',software:'必装软件与外设条件',buyingStage:'购买阶段',goal:'唯一行动目标'};
  const missing=Object.entries(labels).filter(([key])=>!String(t[key as keyof ArticleTask]??'').trim()).map(([,label])=>label!);
  if(t.identity && (!/\d{4}/.test(t.identity)||!/GB|配置|SKU/i.test(t.identity)||!/屏|标准|柔光|防窥|典藏/.test(t.identity)))missing.push('身份需包含年份、销售配置与屏幕细分版');
  if(/与|以及|同时|或|和|、/.test(t.goal))missing.push('请只选择一个行动目标');
  return missing;
}
export function platformIssues(platform:string,title:string,body:string,imageCount:number):string[]{
  const rule=PLATFORM_RULES[platform];if(!rule)return ['未知平台'];
  const issues:string[]=[];
  if(imageCount<rule.min||imageCount>rule.max)issues.push(`缺图或超限：${imageCount}张，${platform}要求${rule.min}–${rule.max}张`);
  const length=body.replace(/\s|[#*]/g,'').length;
  if(platform==='公众号'){
    if(length<1200||length>2200)issues.push('公众号正文须1200–2200字');
    const headings=(body.match(/^#{2,3}\s+.+/gm)||[]).length;
    if(headings<5||headings>8)issues.push('公众号须5–8个小标题');
  }
  if(platform==='门店朋友圈'&&(length<80||length>180))issues.push('朋友圈正文须80–180字');
  if(platform==='门店海报'){
    if(title.replace(/\s/g,'').length<12||title.replace(/\s/g,'').length>22)issues.push('海报主标题须12–22字');
    if((body.match(/^\s*(?:[-*]|\d+[.、])\s*/gm)||[]).length>3)issues.push('海报最多3个卖点');
  }
  if(platform==='小红书'&&!/#\S+/.test(body))issues.push('小红书缺少话题标签');
  if(/亲测|实测了|全网最低|百分之百|绝对领先|内部价|国家补贴/.test(`${title}\n${body}`))issues.push('规则命中无依据体验或营销承诺，需复核改写');
  return issues;
}
export function canExport(issues:string[],reviewed:boolean,stale:boolean){return issues.length===0&&reviewed&&!stale;}
export function exportDocument(t:ArticleTask,r:ArticleResult,version:number,formal:boolean):string{
  return [`# ${formal?'待发布人工复核':'草稿 · 不可发布'}｜v${version}｜${t.platform}`,
  `## 一、场景判断`,`产品：${PRODUCTS[t.modelId]??t.modelId}｜${t.identity}`,`人群：${t.audience}｜阶段：${t.buyingStage}`,`客户原话：${t.customerQuote}`,`场景：${t.scenario}｜唯一目标：${t.goal}`,`软件/外设：${t.software}`,`策略：${SCENE_STRATEGIES[t.scenario]?.focus??''}；${PLATFORM_RULES[t.platform]?.structure??''}`,
  `## 二、知识库依据`,...(r.facts?.length?r.facts.map(f=>`- [${f.id}] ${f.claim}；条件：${f.conditions}\n  原文：${f.quote}\n  来源：${f.knowledgeBase} / ${f.title} / ${f.entryId} / ${f.location}；身份：${f.identity}；资料日期：${f.date}；检索：${f.verifiedAt}`):['未取得指定ima事实原文；不得作为产品依据。']),
  `## 三、图文软文`,r.title??'等待资料与模型连接',r.body??'尚未生成产品文案。',r.cta??'',...(r.images??[]).map(i=>`- ${i.filename}｜${i.url}｜${i.knowledgeBase}/${i.title}/${i.entryId}/${i.location}｜身份：${i.identity}｜${i.placement}｜${i.caption}｜条件：${i.conditions}｜日期：${i.date}`),`拟演示步骤（尚未实测）：${SCENE_STRATEGIES[t.scenario]?.demo??''}`,`报价：${r.priceQuote?`${r.priceQuote.calculation}；SKU：${r.priceQuote.sku}；渠道：${r.priceQuote.channel}；条件：${r.priceQuote.conditions}；来源：${r.priceQuote.title}/${r.priceQuote.entryId}/${r.priceQuote.location}；日期：${r.priceQuote.date}；当前复核：${r.priceQuote.currentVerifiedAt}`:t.withPrice?'仅可引用指定ima当前复核的同SKU公开价格；待核实数量、渠道/地区、日期及条件。':'本稿不含价格；报价需补充SKU、数量、渠道/地区、日期及来源。'}`,`下一步：${t.goal}`,
  `## 四、核验结果`,`状态：${r.message}`,`稿件版本：v${version}｜生成时间：${r.generatedAt??'未生成'}`,`规则检查仅为辅助，不能替代语义与营销合规复核。`,...r.issues.map(x=>`- ${x}`),...(r.verification?.issues??[]).map(x=>`- ${x}`),`发布前由门店负责人核对产品事实、图片身份、条件与动态信息。`].join('\n\n');
}
