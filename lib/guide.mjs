// lib/guide.mjs —— 导购模式：一句话问题 → 能说出口的口径 + 依据 + 不能说的 + 反问
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieve, KB_META } from './kb.mjs';
import { scanCompliance, verifyPrices } from './rules.mjs';
import { callJSON, engineReady } from './engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'guide.md'), 'utf8');

export async function answerGuide({ product, question }) {
  const q = String(question || '').trim();
  if (!q) return { ok: false, questions: ['顾客问的是什么？例如「这台能装 CAD 吗」「孩子上学够用吗」。'] };

  const t0 = Date.now();
  const kb = await retrieve({ product, scenario: '门店到访' });

  let d = null;
  let engine = 'rules';
  let warn = null;
  if (engineReady()) {
    try {
      d = await callJSON(SYSTEM, buildUser(kb, q), { temperature: 0.5, maxTokens: 700 });
      engine = 'llm';
    } catch (e) {
      warn = `模型不可用，回退规则口径：${String(e.message).slice(0, 60)}`;
    }
  }
  const data = d ? normalize(d, kb, q) : fallback(kb, q);

  const text = [data.answer, ...data.points, ...data.cautions, ...data.askBack].join('\n');
  const compliance = scanCompliance(text);
  const priceGaps = verifyPrices(text, kb.prices);

  return {
    ok: true,
    mode: 'guide',
    product: kb.model.full,
    question: q,
    ...data,
    evidence: kb.sources,
    limits: { positioning: kb.limits?.positioning || null, boundaries: (kb.limits?.boundaries || []).slice(0, 2) },
    checks: { compliance, priceGaps },
    engine,
    warn,
    elapsedMs: Date.now() - t0,
    kbName: KB_META.name,
  };
}

function buildUser(kb, q) {
  return [
    '## 顾客的问题',
    q,
    '',
    `## 顾客看的产品：${kb.model.full}`,
    ...kb.facts.map((f, i) => `${i + 1}. ${f.key}：${f.value}（来源：${f.title}）`),
    '',
    kb.limits?.positioning ? `## 这台机器的定位\n${kb.limits.positioning}` : '',
    '',
    (kb.limits?.boundaries || []).length
      ? '## 表达边界\n' + kb.limits.boundaries.slice(0, 4).map(b => `- ${b}`).join('\n')
      : '',
    '',
    '## 输出\n只输出 JSON：{"answer":"","points":[],"cautions":[],"askBack":[]}',
  ].filter(Boolean).join('\n');
}

function normalize(d, kb, q) {
  return {
    answer: String(d.answer || '').trim().slice(0, 200),
    points: arr(d.points, 3),
    cautions: arr(d.cautions, 3),
    askBack: arr(d.askBack, 2),
  };
}

function arr(v, n) {
  return Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean).slice(0, n) : [];
}

function fallback(kb, q) {
  const f = kb.facts.slice(0, 2);
  return {
    answer: `这个问题先看两点：${f.map(x => `${x.key}${x.value}`).join('，')}。具体适不适合您，我得先问一句您的用途。`,
    points: f.map(x => `${x.key}：${x.value}`),
    cautions: ['价格、优惠、库存以门店实时为准，不当场报数', '专业软件兼容与企业采购需转技术或客户经理'],
    askBack: ['您平时主要用它做什么？预算大概多少？'],
  };
}
