// lib/kb.mjs —— 知识库适配层
// 优先读 data/kb.index.json（tools/build-kb.mjs 生成），没有则退回占位数据。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_MODELS, KB_META as MOCK_META } from './kb-mock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = path.join(__dirname, '..', 'data', 'kb.index.json');

let LOCAL = null;
try {
  LOCAL = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
} catch {
  LOCAL = null;
}

export const KB_META = LOCAL
  ? {
      name: '华为PC全板块深度知识库 ' + (LOCAL.version || ''),
      mode: 'local',
      note: `来源 ${LOCAL.source}｜型号 ${LOCAL.models.length} 个｜图片 ${LOCAL.stats?.images ?? 0} 张｜平台指南 ${LOCAL.stats?.platformGuides ?? 0} 份`,
    }
  : MOCK_META;

const MODELS = LOCAL ? LOCAL.models : MOCK_MODELS;
export const MODEL_NAMES = MODELS.map(m => ({
  short: m.short,
  full: m.full,
  line: m.line || '',
  hint: m.limits?.positioning ? String(m.limits.positioning).split('；')[0].slice(0, 90) : '',
}));

const SCENARIO_TAGS = {
  开学季: ['学习', '便携', '续航', '协同'],
  职场办公: ['办公', '便携', '续航', '接口'],
  内容创作: ['屏幕', '性能', '接口'],
  家庭换新: ['便携', '续航', '办公'],
  企业采购: ['办公', '接口', '续航'],
  门店到访: ['便携', '屏幕'],
  新品首发: ['性能', '屏幕', '便携'],
  节日营销: ['屏幕', '便携', '续航'],
};

// 写软文要用的参数：只保留这些，并换成用户能读懂的说法
const DISPLAY = {
  重量: '重量', 尺寸: '屏幕', 类型: '屏幕材质', 分辨率: '分辨率', 亮度: '亮度', 色域: '色域',
  屏占比: '屏占比', 屏幕比例: '屏幕比例', 处理器: '处理器', 内存: '内存', 存储: '存储',
  电池: '电池', 容量: '电池', 接口: '接口', 键盘触控板: '键盘', 摄像头: '摄像头', 音频: '音频',
  特色应用: '特色功能', 操作系统: '操作系统',
};
const IMP = { 重量: 6, 尺寸: 5, 类型: 4, 分辨率: 4, 亮度: 3, 处理器: 4, 内存: 3, 存储: 2, 电池: 4, 容量: 4, 接口: 4, 特色应用: 3, 操作系统: 2 };

export function findModel(product) {
  if (!product) return null;
  const key = norm(product);
  return MODELS.find(m => norm(m.full) === key || norm(m.short) === key)
    || MODELS.find(m => key.includes(norm(m.short)))
    || MODELS.find(m => norm(m.short).includes(key))
    || null;
}

export async function retrieve({ product, scenario }) {
  const model = findModel(product) || MODELS[0];
  const tags = SCENARIO_TAGS[scenario] || [];
  const ranked = (model.facts || [])
    .map(f => {
      const k = f.key || f.section || '';
      const hit = (f.tags || []).filter(t => tags.includes(t)).length;
      return { ...f, display: DISPLAY[k] || k, score: hit * 3 + (IMP[k] || 0) - (/宽度|深度|高度|包装|材料/.test(k) ? 5 : 0) };
    })
    .filter(f => f.display && f.value)
    .sort((a, b) => b.score - a.score);

  const facts = dedupeBy(ranked, 'display').slice(0, 3).map(f => ({
    key: f.display,
    value: String(f.value).replace(/\s+/g, ' ').slice(0, 60),
    title: `${model.full} · ${f.section || '官方规格'}`,
    tags: f.tags || [],
  }));

  const images = dedupeBy(model.images || [], 'caption').slice(0, 8).map((img, i) => ({
    name: (img.caption || img.name || '').trim() || img.file,
    position: ['首图', '正文中段', '卖点段'][i] || '补充图',
    caption: img.caption || img.usage || '',
    url: img.url || null,
    kind: i === 0 ? '主图' : '场景图',
  }));

  const prices = (model.prices || [])
    .filter(p => p.amount || p.type)
    .slice(0, 6)
    .map(p => ({ type: p.type, amount: p.amount, ref: p.ref, condition: p.condition, checkedAt: p.checkedAt, url: p.url }));

  return {
    mode: LOCAL ? 'local' : 'mock',
    model,
    facts,
    allFacts: ranked,
    images,
    prices,
    limits: model.limits || null,
    sources: facts.map(f => ({ title: f.title, fact: `${f.key}：${f.value}`, doc: model.source || null })),
  };
}

/** 给导购推荐用的紧凑型号表：只带推荐时真正会用到的字段 */
export function modelMatrix() {
  const pick = (m, names) => names.map(n => {
    const f = (m.facts || []).find(x => String(x.key || '').includes(n));
    return f ? `${n}${String(f.value).replace(/\s+/g, ' ').slice(0, 36)}` : null;
  }).filter(Boolean).join('　');
  return MODELS.map(m => ({
    name: m.full,
    line: m.line || '',
    spec: pick(m, ['重量', '尺寸', '处理器', '内存', '存储', '电池', '操作系统']),
    extra: (m.facts || []).find(x => /特色应用/.test(String(x.key || '')))?.value.slice(0, 50) || '',
    prices: (m.prices || []).length,
  }));
}

export function platformGuide(platform) {  if (!LOCAL?.platformGuides) return null;
  const map = { wechat: '微信公众号', xhs: '小红书', moments: '销售朋友圈', poster: '门店海报' };
  const want = map[platform] || '';
  const hit = LOCAL.platformGuides.find(g => g.platform.includes(want));
  return hit ? { title: hit.title, text: hit.text.slice(0, 1200) } : null;
}

function dedupeBy(list, field) {
  const seen = new Set();
  return list.filter(x => {
    const k = field === 'display' ? x.display : (x[field] || x.name || x.file);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function norm(s) {
  return String(s).replace(/\s+/g, '').toLowerCase();
}
