// 一键四平台：一次模型调用生成 4 份文案，再逐平台审核 / 收敛 / 核验
import { chat } from "../deepseek.mjs";
import { gatherFacts, platformBlock, parseContent, compressText, rebuild } from "./agent.mjs";
import { getSpec, review } from "../mcp/core.mjs";
import { customFactsFor } from "./custom-facts.mjs";

const PERSONAS = {
  student: "以学生本人第一人称写，带宿舍/教室/图书馆的具体细节，可以吐槽旧设备；语气像发自己的动态，不要像广告。",
  clerk: "以门店顾问视角写，讲一个真实顾客的小故事，专业但克制；不喊口号，不堆形容词。",
  parent: "以家长口吻写，给孩子买电脑；关注耐用、护眼、预算和售后，语气实在。",
};

const MARK = {
  xiaohongshu: "小红书",
  moments: "朋友圈",
  "wechat-mp": "公众号",
  poster: "海报",
};

function parseBatch(raw) {
  const text = String(raw || "");
  const out = {};
  const re = /===\s*(小红书|朋友圈|公众号|海报)\s*===/g;
  const hits = [...text.matchAll(re)];
  for (let i = 0; i < hits.length; i++) {
    const label = hits[i][1];
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const key = Object.keys(MARK).find((k) => MARK[k] === label);
    if (key) out[key] = text.slice(start, end).trim();
  }
  return out;
}

export function verifyText(text, corpus) {
  const t = String(text || "");
  const c = String(corpus || "").replace(/,/g, "");
  const seen = new Set();
  const supported = [];
  const unsupported = [];

  const check = (value, raw) => {
    const key = String(value);
    if (seen.has(key)) return;
    seen.add(key);
    (c.includes(key) ? supported : unsupported).push(raw.trim());
  };

  for (const m of t.matchAll(/¥\s*([\d,]+)/g)) check(m[1].replace(/,/g, ""), m[0]);
  for (const m of t.matchAll(/([\d.]+)\s*(GB|TB|英寸|寸|g|kg|mm|Wh|Hz|nit)/g)) check(m[1], m[0]);
  for (const m of t.matchAll(/([\d,]{3,6})\s*元/g)) check(m[1].replace(/,/g, ""), m[0]);

  return { checked: supported.length + unsupported.length, supported, unsupported };
}

function clamp(text, platform) {
  const spec = getSpec(platform);
  const parsed = parseContent(text, platform);
  if (spec.limits.titleMax > 0 && [...parsed.title].length > spec.limits.titleMax) {
    const chars = [...parsed.title];
    const head = chars.slice(0, spec.limits.titleMax).join("");
    const cut = Math.max(
      head.lastIndexOf("，"),
      head.lastIndexOf("、"),
      head.lastIndexOf("；"),
      head.lastIndexOf("？"),
      head.lastIndexOf("！"),
    );
    parsed.title = cut >= 4 ? head.slice(0, /[？?！!]/.test(head[cut]) ? cut + 1 : cut) : chars.slice(0, spec.limits.titleMax - 1).join("") + "…";
  }
  if ([...parsed.body].length > spec.limits.bodyMax) {
    parsed.body = compressText(parsed.body, Math.floor(spec.limits.bodyMax * 0.92));
  }
  return rebuild({ ...parsed, platform }, platform);
}

export async function finalize(text, platform, rules) {
  let out = text;
  let rv = review({ platform, ...parseContent(out, platform), images: [] });
  let issues = rv.issues.filter((i) => !i.rule.startsWith("images"));

  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) {
    const fixed = await chat({
      messages: [
        {
          role: "system",
          content:
            "你在修改一篇门店文案。只修正下面列出的违规点，保持原意和结构，直接输出修改后的完整文案，不要解释。\n" +
            rules,
        },
        { role: "assistant", content: out },
        { role: "user", content: errors.map((e) => `- ${e.message}`).join("\n") },
      ],
      temperature: 0.3,
      maxTokens: 1200,
    });
    out = clamp(String(fixed || out), platform);
    rv = review({ platform, ...parseContent(out, platform), images: [] });
    issues = rv.issues.filter((i) => !i.rule.startsWith("images"));
  } else {
    out = clamp(out, platform);
  }

  return { reply: out, issues };
}

export async function generateBatch({ brief = "", persona = "clerk" } = {}) {
  if (!brief.trim()) throw new Error("缺少需求描述");

  const { facts } = gatherFacts([{ role: "user", content: brief }]);
  const custom = customFactsFor(brief);
  const allFacts = [...custom, ...facts].filter((f) => f?.text).slice(0, 10);

  const factText = allFacts.map((f, i) => `[${i + 1}]（${f.model}｜${f.source}）${f.text}`).join("\n");
  const rules = ["xiaohongshu", "moments", "wechat-mp", "poster"].map((p) => platformBlock(p)).join("\n");

  const system = `你是华为门店的内容策划。根据同一份事实，为四个平台各写一版，风格必须明显不同。

【人设】${PERSONAS[persona] || PERSONAS.clerk}

【事实】只能使用下面的资料，禁止编造参数、价格、活动、地址。
${factText || "（无资料，请只写场景，不给具体参数）"}

${rules}

【输出格式·严格】
===小红书===
（标题 + 空行 + 正文 + 空行 + 3-5 个话题标签）
===朋友圈===
（无标题，3-5 行口语）
===公众号===
（标题 + 空行 + 800-1200 字正文，含 3 个小标题）
===海报===
（主标题 ≤12 字 + 空行 + 最多 4 行短句）

不要输出任何解释，不要用代码块。`;

  const raw = await chat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: brief },
    ],
    temperature: 0.75,
    maxTokens: 4000,
  });

  const parts = parseBatch(raw);
  const platforms = Object.keys(MARK);
  const missing = platforms.filter((p) => !parts[p]);
  if (missing.length) throw new Error(`批量生成缺少平台：${missing.map((p) => MARK[p]).join("、")}`);

  const corpusBase = allFacts.map((f) => f.text).join("\n") + "\n" + brief;
  const items = [];

  for (const platform of platforms) {
    const finished = await finalize(parts[platform], platform, platformBlock(platform));
    const verified = verifyText(finished.reply, corpusBase);
    items.push({
      platform,
      label: MARK[platform],
      reply: finished.reply,
      issues: finished.issues,
      verified,
      spec: getSpec(platform),
    });
  }

  return { items, persona, brief, facts: allFacts.slice(0, 6) };
}


/** 单卡改写：只重写一张，不影响其他平台 */
export async function rewriteOne({ platform, text, instruction = "", brief = "" } = {}) {
  if (!platform || !text) throw new Error("缺少平台或原文");
  const { facts } = gatherFacts([{ role: "user", content: brief || text }]);
  const custom = customFactsFor(brief || text);
  const corpus = [...custom.map((f) => f.text), ...facts.map((f) => f.text), brief].join("\n") + "\n" + brief;

  const raw = await chat({
    messages: [
      {
        role: "system",
        content:
          `你在改写一篇${MARK[platform] || platform}文案。要求：${instruction || "换个说法，更自然"}。` +
          "保留所有事实与数字，不得新增价格、参数或活动；保持平台结构；直接输出改写后的完整内容，不要解释。\n" +
          platformBlock(platform),
      },
      { role: "assistant", content: text },
      { role: "user", content: "按上面的要求改写。" },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const finished = await finalize(String(raw || text), platform, platformBlock(platform));
  return { platform, reply: finished.reply, issues: finished.issues, verified: verifyText(finished.reply, corpus) };
}
