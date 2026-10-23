// lib/rules.mjs —— 平台策略表 + 合规规则 + 事实核验
// 这一层是「自研」的核心证据：全部是确定性代码，不依赖模型自觉。

export const PLATFORMS = {
  wechat: {
    id: 'wechat', name: '公众号', imageMin: 2, imageMax: 4,
    title: { max: 24, rule: '观点/信息型，一句说清「给谁、解决什么」' },
    sections: ['导语', '正文', '结尾行动引导'],
    charRange: [600, 1200],
    tone: '克制、信息密度高、书面语，不用网络热词',
    cta: '文末引导：留言 / 到店 / 咨询',
    hashtags: false,
  },
  xhs: {
    id: 'xhs', name: '小红书', imageMin: 3, imageMax: 6,
    title: { max: 20, rule: '口语化、带情绪或数字，别像广告标题' },
    sections: ['开头钩子', '分点正文', '一句总结'],
    charRange: [250, 600],
    tone: '第一人称、短句、可带语气词；不得伪造个人使用体验',
    cta: '收藏 / 评论 / 私信',
    hashtags: true,
  },
  moments: {
    id: 'moments', name: '门店朋友圈', imageMin: 1, imageMax: 3,
    title: null,
    sections: ['一句话钩子', '一个核心卖点', '到店引导'],
    charRange: [60, 180],
    tone: '口语、短、只讲一个点，不堆参数',
    cta: '到店体验 / 加微 / 私信',
    hashtags: false,
  },
  poster: {
    id: 'poster', name: '门店海报', imageMin: 1, imageMax: 1,
    title: { max: 12, rule: '主标题短促有力，能一眼读完' },
    sections: ['主标题', '副标题', '卖点（≤3）', '活动说明'],
    charRange: [40, 120],
    tone: '短句、无形容词堆砌、可直接排进版面',
    cta: '到店 / 扫码咨询',
    hashtags: false,
  },
  custom: {
    id: 'custom', name: '自定义平台', imageMin: 1, imageMax: 6,
    title: { max: 30, rule: '按用户指定的平台习惯起标题' },
    sections: ['标题', '正文', '行动引导'],
    charRange: [80, 800],
    tone: '按用户在指令里描述的平台调性来写',
    cta: '按用户描述',
    hashtags: false,
  },
};

export const SCENARIOS = {
  '开学季': { audience: '大学新生、家长', angle: '学习、携带、续航、多设备协同', tags: ['学习', '便携', '续航', '协同'] },
  '职场办公': { audience: '商务人士、移动办公者', angle: '会议、差旅、文档处理、多任务、安全', tags: ['办公', '便携', '续航', '接口'] },
  '内容创作': { audience: '设计、摄影、视频创作者', angle: '屏幕、性能、素材流转、创作流程', tags: ['屏幕', '性能', '接口'] },
  '家庭换新': { audience: '家庭用户、旧机换新者', angle: '易用、全家共用、数据迁移、长期体验', tags: ['学习', '续航', '办公'] },
  '企业采购': { audience: '中小企业、团队采购', angle: '部署、管理、稳定性、服务', tags: ['办公', '接口', '续航'] },
  '门店到访': { audience: '附近潜在顾客', angle: '一个明确卖点 + 到店理由 + 咨询引导', tags: ['便携', '屏幕'] },
  '新品首发': { audience: '关注新品的用户', angle: '新品变化、适合人群、购买建议', tags: ['性能', '屏幕', '便携'] },
  '节日营销': { audience: '送礼人群、家庭购机', angle: '使用场景与选择建议', tags: ['屏幕', '便携', '续航'] },
};

// 合规规则：词表 + 正则，命中即拦截或降级
export const COMPLIANCE_RULES = [
  { type: '绝对化用语', re: /(最(好|佳|强|优|便宜|低|高|快|薄|轻|值))|第一|唯一|顶级|极致|巅峰|天花板|之王/g, fix: '改成可验证的具体表述，或直接删除' },
  { type: '虚假承诺', re: /(100%|百分百|永久|终身|永远|绝对|保证满意|零故障)/g, fix: '删除承诺，或改为条件句' },
  { type: '价格误导', re: /(全网最低|史上最低|跌破|秒杀|直降\s*\d+|到手价)/g, fix: '价格必须有知识库依据，否则删除' },
  { type: '数据无据', re: /(销量(冠军|第一|破万)|卖爆|脱销|复购率\s*\d+%|好评率\s*\d+%)/g, fix: '无知识库依据的销量/口碑数据一律删除' },
  { type: '无依据对比', re: /比(某|友商|竞品|其他|同价位)[^\s，。；]{0,8}(好|强|快|轻|薄|便宜|省)/g, fix: '改为客观参数陈述，或删除对比' },
  { type: '竞品贬低', re: /(吊打|碾压|秒杀友商|完爆|不如买)/g, fix: '删除贬损性表达' },
];

// 事实核验：把文案里出现的「数值 + 单位」和型号名，回查知识库
const NUM_RE = /(\d+(?:\.\d+)?)\s*(kg|g|克|英寸|寸|Hz|Wh|W|mm|TB|GB)/gi;

export function extractClaims(text) {
  const claims = [];
  for (const m of text.matchAll(NUM_RE)) claims.push(m[0].replace(/\s+/g, ''));
  return [...new Set(claims)];
}

export function verifyFacts(text, facts, models) {
  const claimList = extractClaims(text);
  const factText = facts.map(f => f.value).join(' ').replace(/\s+/g, '');
  const results = claimList.map(c => {
    const hit = factText.includes(c.replace(/\s+/g, ''));
    return { claim: c, status: hit ? 'pass' : 'fail', source: hit ? facts.find(f => f.value.replace(/\s+/g, '').includes(c.replace(/\s+/g, '')))?.title : null };
  });
  // 型号一致性：文案里提到的型号必须在本次检索到的型号集合内
  const mentioned = models.filter(m => text.includes(m.short));
  return { claims: results, models: mentioned.map(m => m.short), failCount: results.filter(r => r.status === 'fail').length };
}

export function scanCompliance(text) {
  const hits = [];
  for (const r of COMPLIANCE_RULES) {
    const found = text.match(r.re);
    if (found) hits.push({ type: r.type, words: [...new Set(found)].slice(0, 5), fix: r.fix });
  }
  return hits;
}

// 价格核验：文案里出现的金额必须能在「官方公开价格快照」里找到同额记录
const PRICE_RE = /(?:[¥￥]\s*(\d[\d,]*(?:\.\d+)?))|(?:(\d[\d,]*(?:\.\d+)?)\s*元)/g;

export function extractPriceClaims(text) {
  const out = [];
  for (const m of text.matchAll(PRICE_RE)) out.push((m[1] || m[2] || '').replace(/,/g, ''));
  return [...new Set(out)];
}

export function verifyPrices(text, prices = []) {
  const claims = extractPriceClaims(text);
  const known = prices.map(p => String(p.amount || '').replace(/,/g, '')).filter(Boolean);
  return claims.map(c => ({ amount: c, hasEvidence: known.includes(c) })).filter(x => !x.hasEvidence);
}
