// lib/revise.mjs —— 按新要求改写 + 重新核验
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieve } from './kb.mjs';
import { PLATFORMS, verifyFacts, scanCompliance, verifyPrices } from './rules.mjs';
import { callJSON, engineReady } from './engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'revise.md'), 'utf8');

export async function revise({ product, scenario, platform, draft, instruction }) {
  const t0 = Date.now();
  const kb = await retrieve({ product, scenario });
  const plat = PLATFORMS[platform] || PLATFORMS.wechat;

  let out = normalizeDraft(draft);
  let engine = 'rules';
  let warn = null;

  if (instruction && instruction.trim()) {
    if (engineReady()) {
      try {
        const raw = await callJSON(SYSTEM, buildUser(kb, plat, out, instruction), { temperature: 0.6, maxTokens: 1400 });
        out = normalizeDraft(mergeMissing(raw, out));
        engine = 'llm';
        if (/删|去掉|别写|不要这段/.test(instruction) && out.body.length >= normalizeDraft(draft).body.length) {
          warn = '模型没有真的删段（段数没减少），建议再点一次重写，或直接手动删';
        }
      } catch (e) {
        warn = `模型不可用，已保留原稿：${String(e.message).slice(0, 60)}`;
      }
    } else {
      warn = '未配置模型，只能原样保留';
    }
  }

  const text = fullText(out);
  const factCheck = verifyFacts(text, kb.facts, [{ short: kb.model.short }]);
  const compliance = scanCompliance(text);
  const priceGaps = verifyPrices(text, kb.prices);

  const pending = [
    ...factCheck.claims.filter(c => c.status === 'fail').map(c => `无法核实的断言：${c.claim}`),
    ...priceGaps.map(p => `价格：${p.amount} 元无官方记录`),
    ...(out.body.length * 0 < 1 && (kb.images || []).length < plat.imageMin
      ? [`图片不足：${plat.name} 建议 ${plat.imageMin}–${plat.imageMax} 张，知识库仅命中 ${kb.images.length} 张`]
      : []),
  ];

  return {
    ok: true,
    draft: out,
    checks: { facts: factCheck, compliance, priceGaps, pending },
    engine,
    warn,
    elapsedMs: Date.now() - t0,
  };
}

function buildUser(kb, plat, draft, instruction) {
  return [
    '## 修改要求',
    instruction.trim(),
    '',
    `## 当前平台：${plat.name}`,
    `平台结构：${plat.sections.join(' → ')}`,
    `平台语气：${plat.tone}`,
    '',
    '## 事实点（改写时不得改变或新增）',
    ...kb.facts.map((f, i) => `${i + 1}. ${f.key}：${f.value}`),
    '',
    '## 当前稿子',
    JSON.stringify(draft, null, 1),
    '',
    '## 输出\n只输出 JSON：{"title":"","lead":"","body":[{"heading":"","text":""}],"cta":"","hashtags":[]}',
  ].join('\n');
}

function fullText(d) {
  return [d.title, d.lead, ...d.body.map(b => (b.heading || '') + (b.text || '')), d.cta].filter(Boolean).join('\n');
}

function normalizeDraft(d = {}) {
  const body = Array.isArray(d.body)
    ? d.body.map(b => ({ heading: String(b.heading || ''), text: String(b.text || '') })).filter(b => b.heading || b.text)
    : [];
  return {
    title: String(d.title || ''),
    lead: String(d.lead || ''),
    body: renumber(body),
    cta: String(d.cta || ''),
    hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(String).slice(0, 6) : [],
  };
}

const MARKS = '①②③④⑤⑥⑦⑧⑨⑩';
const MARK_RE = /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/;

// 删段之后编号会断档，统一重排（只在所有小标题都以序号开头时做）
function renumber(body) {
  if (!body.length || !body.every(b => MARK_RE.test(b.heading || ''))) return body;
  return body.map((b, i) => ({ ...b, heading: MARKS[i] + ' ' + b.heading.replace(MARK_RE, '') }));
}

// 模型偶尔漏字段，用原稿补齐，避免"改写把稿子改没了"
function mergeMissing(raw, old) {
  return {
    title: raw.title || old.title,
    lead: raw.lead || old.lead,
    body: Array.isArray(raw.body) && raw.body.length ? raw.body : old.body,
    cta: raw.cta || old.cta,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : old.hashtags,
  };
}
