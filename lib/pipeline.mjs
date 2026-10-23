// lib/pipeline.mjs —— 9 步流水线：场景解析 → 平台策略 → 检索 → 事实点 → 编排 → 生成 → 核验 → 合规 → 组装
import { retrieve, MODEL_NAMES, KB_META, platformGuide } from './kb.mjs';
import { PLATFORMS, SCENARIOS, verifyFacts, scanCompliance, verifyPrices } from './rules.mjs';
import { engineReady, draftWithLLM } from './engine.mjs';

const REQUIRED = [
  { key: 'product', q: '要写哪一款产品？（当前知识库收录：' + MODEL_NAMES.map(m => m.short).join('、') + '）' },
  { key: 'scenario', q: '属于哪个业务场景？' + Object.keys(SCENARIOS).join(' / ') },
  { key: 'platform', q: '发在哪个平台？公众号 / 小红书 / 门店朋友圈 / 门店海报' },
];

export async function run(input = {}) {
  const t0 = Date.now();
  const trace = [];

  // ① 任务解析 + 追问（信息不足必须先问，不能猜）
  const questions = REQUIRED.filter(r => !input[r.key] || String(input[r.key]).trim() === '').map(r => r.q);
  if (questions.length) {
    trace.push({ step: '任务解析', status: 'need_info', questions });
    return { ok: false, questions, trace };
  }

  const product = String(input.product);
  const basePlatform = PLATFORMS[input.platform] || PLATFORMS.wechat;
  const platform = input.platform === 'custom'
    ? { ...basePlatform, name: String(input.platformName || '自定义平台').slice(0, 24) }
    : basePlatform;
  const scenario = SCENARIOS[input.scenario] ? input.scenario : '职场办公';
  const angle = SCENARIOS[scenario].angle;
  const audience = String(input.audience || '').trim() || SCENARIOS[scenario].audience;
  input.audience = audience;
  trace.push({ step: '场景解析', status: 'ok', detail: `${audience} / ${scenario} / ${platform.name}` });

  // ② 平台策略
  const strategy = {
    audience, scenario, platform: platform.name, platformId: platform.id,
    goal: platform.id === 'poster' ? '到店与咨询' : platform.id === 'moments' ? '到店 / 加微' : '种草与搜索触达',
    angle, tone: platform.tone, imageRange: `${platform.imageMin}–${platform.imageMax} 张`,
    structure: platform.sections.join(' → '),
    style: input.style || '理性专业',
    brief: input.brief || '',
    priceStrict: input.priceStrict === undefined ? true : Boolean(input.priceStrict),
  };
  trace.push({ step: '平台策略', status: 'ok', detail: strategy.structure });

  // ③ 检索
  const kb = await retrieve({ product, scenario });
  strategy.positioning = kb.limits?.positioning || null;
  strategy.boundaries = (kb.limits?.boundaries || []).slice(0, 3);
  const guide = platformGuide(platform.id);
  if (guide) strategy.guide = guide.title;
  trace.push({ step: '资料检索', status: 'ok', detail: `${kb.mode} · ${kb.facts.length} 条事实 / ${kb.images.length} 张图 / ${kb.prices.length} 条价格` });

  // ④ 事实点
  const facts = kb.facts;
  trace.push({ step: '事实点提取', status: 'ok', detail: facts.map(f => f.key).join('、') });

  // ⑤ 图文编排
  const count = Math.min(platform.imageMax, Math.max(platform.imageMin, kb.images.length));
  const picked = kb.images.slice(0, count);
  const images = picked.map((img, i) => ({
    name: img.name, source: `${KB_META.name} · ${kb.model.full}`, position: img.position,
    caption: img.caption, modelOk: true, index: i + 1,
  }));
  trace.push({ step: '图文编排', status: 'ok', detail: `${images.length} 张图` });
  const imageShort = images.length < platform.imageMin;
  if (imageShort) trace.push({ step: '图文编排', status: 'warn', detail: `素材不足：${platform.name} 建议 ${platform.imageMin}–${platform.imageMax} 张` });

  // ⑥ 生成
  // ⑥ 生成：模型优先，失败回退规则写作
  let draft = null;
  let engine = 'rules';
  if (engineReady()) {
    try {
      draft = await draftWithLLM({ input, platform, scenario, angle, facts, images, model: kb.model, limits: kb.limits, prices: kb.prices });
      engine = 'llm';
    } catch (err) {
      trace.push({ step: '软文生成', status: 'warn', detail: `模型不可用，回退规则写作：${String(err.message).slice(0, 60)}` });
    }
  }
  if (!draft) draft = writeDraft({ input, platform, scenario, angle, facts, images, model: kb.model });
  draft.images = images;
  trace.push({ step: '软文生成', status: 'ok', detail: `${platform.name} · ${engine}` });

  // ⑦ 事实核验
  const fullText = [draft.title, draft.lead, ...draft.body.map(b => b.heading + b.text), draft.cta].filter(Boolean).join('\n');
  const factCheck = verifyFacts(fullText, facts, [{ short: kb.model.short }]);
  trace.push({ step: '事实核验', status: factCheck.failCount ? 'warn' : 'ok', detail: `${factCheck.claims.length} 项断言` });

  // ⑧ 合规检查
  const compliance = scanCompliance(fullText);
  if (input.__stress) compliance.push({ type: '演示注入', words: ['全网最低价', '100% 无故障'], fix: '这条是故意注入的违规样本，用于演示拦截' });
  trace.push({ step: '合规检查', status: compliance.length ? 'block' : 'ok', detail: `${compliance.length} 类风险` });

  // ⑧.5 价格核验：文案里出现金额，必须有官方价格记录兜底
  const priceGaps = verifyPrices(fullText, kb.prices);
  if (priceGaps.length) trace.push({ step: '价格核验', status: 'warn', detail: `${priceGaps.length} 个金额无依据` });

  return {
    ok: true,
    strategy,
    sources: kb.sources.map(s => ({ ...s, source: `${KB_META.name} · ${kb.model.full}` })),
    draft,
    checks: {
      facts: factCheck,
      compliance,
      images: images.map(i => ({ name: i.name, modelOk: i.modelOk, note: '来自本地知识库，型号一致' })),
      pending: [
        ...factCheck.claims.filter(c => c.status === 'fail').map(c => `无法核实的断言：${c.claim}`),
        ...(imageShort ? [`图片不足：${platform.name} 建议 ${platform.imageMin}–${platform.imageMax} 张，知识库仅命中 ${images.length} 张，需补素材`] : []),
        ...priceGaps.map(p => `价格：${p.amount} 元无官方价格记录，需核验后补充或删除`),
      ],
      blocked: compliance.length > 0,
    },
    meta: { kbMode: kb.mode, kbName: KB_META.name, model: kb.model.full, engine, elapsedMs: Date.now() - t0, at: new Date().toISOString() },
    trace,
  };
}

// ⑥ 生成层：本地确定性写作（无 Key 也能演示）；有 Key 时换成模型调用
const CLAUSE = [
  [/重量/, '放进包里通勤一天，差别是能感觉到的'],
  [/屏幕|分辨率|亮度|色域|屏占比/, '长时间看文献、改稿子，眼睛的耐受度差很多'],
  [/电池/, '一整天的课或会，不用一直找插座'],
  [/接口/, '出门前先想好要不要带扩展坞'],
  [/处理器|内存|存储/, '多开文档和浏览器的时候，不容易卡'],
  [/键盘/, '表格和数字录入会省不少事'],
  [/特色功能|操作系统/, '和手机、平板之间的协同，是它容易忽略的加分项'],
];
const clauseOf = (key) => (CLAUSE.find(([re]) => re.test(key || '')) || [])[1] || '';
const NUM = ['一', '二', '三'];
const CIR = ['①', '②', '③'];

function writeDraft({ input, platform, scenario, angle, facts, images, model }) {
  const short = model.short;
  const aud = input.audience;
  const f = facts.slice(0, 3);
  const imgRef = i => (images[i] ? `［图 ${i + 1}：${images[i].name}］` : '');
  const clause = i => (f[i] && clauseOf(f[i].key) ? clauseOf(f[i].key) + '。' : '');

  if (platform.id === 'wechat') {
    return {
      title: `${aud}选本：${short} 的三个取舍`,
      lead: `要是需求集中在${angle}，${short} 值得进候选。它不面面俱到，取舍很清楚，下面按三点说。`,
      body: f.map((x, i) => ({
        heading: `${NUM[i]}、${x.key}：${x.value}`,
        text: `${clause(i)}这一点，基本决定了它在${scenario}里的位置。${imgRef(i)}`,
      })),
      cta: `如果你正好是${aud}，可以带着自己的使用习惯到店实际体验；参数以现场样机与官方资料为准。`,
      hashtags: [],
    };
  }
  if (platform.id === 'xhs') {
    return {
      title: `${scenario}选本，我先看这台`,
      lead: `先说结论：如果是${aud}，${short} 值得看一眼。重点不是堆参数，是这三点对不对得上你的日常。`,
      body: f.map((x, i) => ({
        heading: `${CIR[i]} ${x.key}`,
        text: `${x.value}。${clause(i)}${imgRef(i)}`,
      })),
      cta: '有同款需求可以评论区说下预算，我按使用场景帮你排个序；具体参数以官方与门店样机为准。',
      hashtags: [`#${scenario}`, '#轻薄本', '#华为PC', '#选购'],
    };
  }
  if (platform.id === 'moments') {
    return {
      title: '',
      lead: `${scenario}换本，先看一个点就够：${f[0] ? f[0].key + f[0].value : short}。`,
      body: [{ heading: '', text: `${short} 这台，${f[0] ? f[0].key + f[0].value : ''}，${scenario}用起来最直接。${imgRef(0)}` }],
      cta: '到店可以上手掂一掂、开合试一下，地址在定位里。',
      hashtags: [],
    };
  }
  return {
    title: `${short}`,
    lead: `${aud} · ${scenario}`,
    body: [
      { heading: '副标题', text: `${angle.split('、')[0]}，就是它的强项` },
      { heading: '卖点', text: f.slice(0, 3).map(x => `· ${x.key} ${x.value}`).join('\n') },
      { heading: '活动说明', text: '活动与权益以门店公示为准' },
    ],
    cta: '到店体验 / 扫码咨询',
    hashtags: [],
  };
}
