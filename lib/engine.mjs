// lib/engine.mjs —— 生成引擎：DeepSeek（OpenAI 兼容）优先，失败回退规则写作
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'system.md'), 'utf8');

export function engineReady() {
  return Boolean(getConfig().apiKey);
}

export async function draftWithLLM(ctx) {
  const raw = await callJSON(SYSTEM, buildUser(ctx));
  return normalize(raw, ctx);
}

/** 通用 JSON 调用：system + user → 解析后的对象 */
export async function callJSON(system, user, { temperature = 0.85, maxTokens = 1400 } = {}) {
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error('未配置 API Key');

  const body = {
    model: cfg.model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let data;
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`模型接口 ${res.status}：${text.slice(0, 160)}`);
    }
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  return parseJson(data.choices?.[0]?.message?.content || '');
}

const STYLES = {
  理性专业: '克制、术语准确、少用形容词，句子偏短',
  场景共鸣: '带入具体使用场景和生活细节，让人有画面感',
  简短有力: '短句为主，去掉修饰，一句一个意思',
  种草口语: '口语化、有亲近感，但不得编造个人使用体验',
};

function buildUser(ctx) {
  const { input, platform, scenario, angle, facts, images, model, limits, prices } = ctx;
  return [
    '## 本次任务',
    `产品：${model.full}`,
    `人群：${input.audience}`,
    `场景：${scenario}（切入角度：${angle}）`,
    `平台：${platform.name}（${platform.imageMin}–${platform.imageMax} 张图）`,
    `平台结构：${platform.sections.join(' → ')}`,
    `平台语气：${platform.tone}`,
    `行动引导方向：${platform.cta}`,
    `表达风格：${STYLES[input.style] || STYLES['理性专业']}`,
    input.brief ? `用户补充要求：${input.brief}` : '',
    ``,
    '## 可用事实点（只能用这些，不得新增数字或型号）',
    ...facts.map((f, i) => `${i + 1}. ${f.key}：${f.value}（来源：${f.title}）`),
    ``,
    '## 知识库给出的定位与边界',
    limits?.positioning ? `定位：${limits.positioning}` : '',
    ...(limits?.boundaries || []).slice(0, 3).map(b => `- ${b}`),
    ``,
    input.priceStrict
      ? '## 价格规则\n本稿不引用任何价格。'
      : (prices?.length
          ? ['## 可选价格事实（如引用，必须同时写出价格类型、条件与核验时间）',
             ...prices.slice(0, 3).map(p => `- ${p.type}${p.amount ? ` ${p.amount} 元` : ''}；条件：${p.condition || '以门店为准'}；核验：${p.checkedAt || '未记录'}`)].join('\n')
          : '## 价格规则\n本稿不引用任何价格。'),
    ``,
    '## 可用图片（按顺序编号，正文里用［图 N］引用）',
    ...images.map((img, i) => `${i + 1}. ${img.name}（插入位置建议：${img.position}）`),
    ``,
    `## 输出要求`,
    `只输出 JSON：{"title":"","lead":"","body":[{"heading":"","text":""}],"cta":"","hashtags":[]}`,
    `正文用中文全角标点；不要出现 Markdown 语法；不要写价格（除非上面给了价格规则）；不要伪造个人体验。`,
  ].filter(Boolean).join('\n');
}

function parseJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

function normalize(d, ctx) {
  const { platform } = ctx;
  const body = Array.isArray(d.body)
    ? d.body.map(b => ({ heading: String(b.heading || ''), text: String(b.text || '') })).filter(b => b.text || b.heading)
    : [];
  const draft = {
    title: String(d.title || '').slice(0, platform.title?.max ? platform.title.max + 4 : 40),
    lead: String(d.lead || ''),
    body,
    cta: String(d.cta || platform.cta),
    hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(String).slice(0, 6) : [],
    engine: 'llm',
  };
  if (!draft.body.length) throw new Error('模型输出缺少正文');
  // 模型没标注图片时，按顺序补到段落末尾
  const hasRef = draft.body.some(b => /［图\s*\d］/.test(b.text));
  if (!hasRef) {
    ctx.images.slice(0, draft.body.length).forEach((img, i) => {
      draft.body[i].text = `${draft.body[i].text}［图 ${i + 1}：${img.name}］`;
    });
  }
  return draft;
}
