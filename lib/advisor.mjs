// lib/advisor.mjs —— 导购对话式选型：每轮收敛条件 → 候选 → 追问
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelMatrix, KB_META } from './kb.mjs';
import { callJSON, engineReady } from './engine.mjs';
import { scanCompliance } from './rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'advisor.md'), 'utf8');

export async function advise({ messages = [], criteria = {}, message = '' }) {
  const text = String(message || '').trim();
  if (!text) return { ok: false, questions: ['把顾客说的一句话记下来，我再帮你收敛。'] };

  const t0 = Date.now();
  const matrix = modelMatrix();
  const convo = [...messages, { role: 'user', content: text }].slice(-12);

  let out = null;
  let engine = 'rules';
  let warn = null;

  if (engineReady()) {
    try {
      out = await callJSON(SYSTEM, buildUser(matrix, criteria, convo), { temperature: 0.5, maxTokens: 1100 });
      engine = 'llm';
    } catch (e) {
      warn = `模型不可用，改用规则兜底：${String(e.message).slice(0, 50)}`;
    }
  }
  if (!out) out = heuristic(matrix, criteria, text);

  const valid = new Set(matrix.map(m => m.name));
  const mapped = (Array.isArray(out.matches) ? out.matches : [])
    .map(m => ({ ...m, row: matchModel(matrix, m.model) }))
    .filter(m => m.row)
    .slice(0, 3)
    .map(m => ({
      model: m.row.name, line: m.row.line || '',
      reason: String(m.reason || ''), tradeoff: String(m.tradeoff || ''), spec: m.row.spec || '',
    }));

  let matches = mapped;
  if (!matches.length && Array.isArray(out.matches) && out.matches.length) {
    const fb = heuristic(matrix, criteria, text);
    matches = fb.matches;
    warn = (warn ? warn + '；' : '') + '模型给出的型号不在清单里，已用规则兜底';
  }

  const merged = { ...criteria };
  for (const [k, v] of Object.entries(typeof out.criteria === 'object' && out.criteria ? out.criteria : {})) {
    if (v && String(v).trim()) merged[k] = v;
  }

  return {
    ok: true,
    reply: String(out.reply || '').slice(0, 60),
    criteria: merged,
    matches,
    ask: (Array.isArray(out.ask) ? out.ask : []).map(String).slice(0, 3),
    checks: { compliance: scanCompliance([out.reply, ...matches.map(m => m.reason + m.tradeoff)].join('\n')) },
    engine,
    warn,
    total: matrix.length,
    kbName: KB_META.name,
    elapsedMs: Date.now() - t0,
  };
}

function buildUser(matrix, criteria, convo) {
  return [
    '## 可选型号清单（只能从这些里选）',
    ...matrix.map((m, i) => `${i + 1}. ${m.name}｜${m.line}｜${m.spec}${m.extra ? '｜' + m.extra : ''}`),
    '',
    '## 已确认条件',
    JSON.stringify(criteria || {}, null, 1),
    '',
    '## 到目前为止的对话',
    ...convo.map(c => `${c.role === 'user' ? '导购' : '你'}：${c.content}`),
    '',
    '## 输出\n只输出 JSON：{"reply":"","criteria":{},"matches":[{"model":"","reason":"","tradeoff":""}],"ask":[]}',
  ].join('\n');
}

function norm(s) {
  return String(s).replace(/^HUAWEI\s*/i, '').replace(/^华为\s*/, '').replace(/\s+/g, '').toLowerCase();
}

/** 模型返回的型号名可能带/不带 HUAWEI，做一次归一化匹配，取最长的那个 */
function matchModel(matrix, name) {
  const n = norm(name);
  if (!n) return null;
  const exact = matrix.find(m => norm(m.name) === n);
  if (exact) return exact;
  const cands = matrix.filter(m => norm(m.name).includes(n) || n.includes(norm(m.name)));
  if (!cands.length) return null;
  return cands.sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
}

/* ---------- 无模型时的兜底：按关键词粗筛 ---------- */
function heuristic(matrix, criteria, text) {
  const t = text;
  const next = { ...criteria };
  if (/预算|价位|块钱|元/.test(t)) next.budget = t.match(/\d{3,5}/)?.[0] || next.budget || '已提到预算';
  if (/学生|上课|网课|考研/.test(t)) next.usage = '学生/学习';
  if (/出差|商务|办公|会议/.test(t)) next.usage = '办公/出差';
  if (/设计|剪|修图|创作/.test(t)) next.usage = '内容创作';
  if (/轻|便携|背着|通勤/.test(t)) next.portable = '便携优先';
  if (/鸿蒙/.test(t)) next.system = '鸿蒙';
  if (/windows/i.test(t)) next.system = 'Windows';
  if (/大屏|16|大一点的/.test(t)) next.screen = '大屏';

  let list = matrix.slice();
  if (next.system === '鸿蒙') list = list.filter(m => m.line.includes('鸿蒙'));
  if (next.system === 'Windows') list = list.filter(m => m.line.includes('Windows'));
  if (next.screen === '大屏') list = list.filter(m => /1[56] 英寸|16 英寸/.test(m.spec)) || list;

  const weight = (spec) => Number((spec.match(/重量(\d+(?:\.\d+)?)\s*kg/) || [])[1] || 9);
  if (next.portable) list.sort((a, b) => weight(a.spec) - weight(b.spec));

  const picked = list.slice(0, 3).map(m => ({
    model: m.name,
    reason: `${m.line}｜${m.spec.split('　').slice(0, 2).join('　')}`,
    tradeoff: '需按实际销售版本与门店实时价核实',
  }));

  return {
    reply: picked.length ? '先按已知条件筛出这几台' : '当前条件还选不出来，再多问一句',
    criteria: next,
    matches: picked,
    ask: ['平时主要用它做什么？上课、办公还是剪视频？', '预算大概在哪个区间？', '会经常背着走吗？'],
  };
}
