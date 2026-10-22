// 对话式导购 Agent：事实级检索 + DeepSeek 多轮对话
// 设计原则：一次只问一个问题；只引用知识库事实；无依据就转人工
import { searchEvidence, priceFor, candidatesByBudget } from "../agent/kb-index.mjs";
import { getSpec, review } from "../mcp/core.mjs";
import { customFactsFor } from "./custom-facts.mjs";
import { chat as llmChat } from "../deepseek.mjs";

const MAX_FACTS = 8;

/** 从整段对话里抽槽位（用于系统提示与检索） */
export function slotsFrom(messages = []) {
  // 只解析销售自己说的话，避免把 Agent 的追问当成客户信息
  const text = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const num = (re) => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  const budget =
    num(/(?:预算|价格)?\s*(\d{3,5})\s*(?:元|块|左右|以内)/) ||
    num(/(?:预算|价格)\D{0,4}(\d{3,5})/) ||
    (/(\d(?:\.\d)?)\s*[千kK]/.test(text) ? Math.round(Number(text.match(/(\d(?:\.\d)?)\s*[千kK]/)[1]) * 1000) : null);

  const pick = (re) => (text.match(re) || [])[0] || null;
  return {
    budget,
    scenario: pick(/剪辑|视频|设计|修图|办公|网课|学习|编程|游戏|出差|会议/),
    segment: pick(/学生|大学生|研究生|职场|上班|设计师|剪辑师|创作者|家庭|孩子|企业|采购/),
    preference: pick(/轻薄|便携|续航|性能|屏幕|色准|性价比/),
    platform: pick(/小红书|朋友圈|公众号|海报/),
  };
}

function factLine(e, i) {
  return `[${i + 1}]（${e.model}｜${e.source}）${e.text}`;
}

/** 事实级检索：先走结构化事实，再按需补价格 */
export function gatherFacts(messages, { limit = MAX_FACTS } = {}) {
  const slots = slotsFrom(messages);
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const query = [last, slots.scenario, slots.segment, slots.preference, slots.budget ? `${slots.budget}预算` : ""]
    .filter(Boolean)
    .join(" ");

  const custom = customFactsFor(last);
  const raw = [...custom, ...searchEvidence(query, { limit: limit * 2, budget: slots.budget || undefined })];

  // 预算过滤：超预算 15% 以上的型号不进入推荐上下文
  const keep = (e) => {
    if (!slots.budget || e.kind === "price") return true;
    const p = priceFor(e.model);
    return !p || p.minPrice <= slots.budget * 1.15;
  };
  let hits = raw.filter(keep);

  // 价格保留位：先砍到 limit-1，再把最匹配型号的报价补进来
  hits = hits.slice(0, Math.max(1, limit - 1));
  const model = hits.find((h) => h.kind !== "price")?.model;
  const price = model ? priceFor(model) : null;
  if (price) {
    hits.push({
      kind: "price",
      model: price.productName,
      text: `${price.productName} 官方公开价 ¥${price.minPrice.toLocaleString()} 起，${price.skuCount} 条 SKU 记录`,
      source: price.file,
    });
  }
  return { slots, facts: hits.slice(0, limit) };
}

const GUIDE_PROMPT = `你是华为门店的资深导购顾问，正在和"销售顾问"对话（不是直接和顾客）。

你的本事是：先听懂顾客在意什么，再给建议。

必须遵守：
1. 一次只问一个问题。问完就停，等对方回答，绝不连问。
2. 开口先复述你听到的关键信息（一句话），再问下一个问题。
3. 追问要问动机，不要问参数。不要问"预算多少"，要问"更在意一次投入还是长期使用成本"。
4. 信息不足时，最多给一个初步方向，然后只问一个问题。不要一次列一堆机型。
5. 只能用【资料】里的型号、参数、价格。资料里没有的（补贴、库存、赠品、活动期限），直接说"这个要门店确认"，不要编。
6. 报价格必须带来源口径，例如"官方公开价 5,899 元起（2026-10-17 快照）"。
6.1 价格只能来自【预算内候选】或【资料】里明确写了该型号的那条。绝不能把 A 的价格安到 B 上。
6.2 如果候选标注"略超预算"，要直接说超了多少；不要换一个没被推荐的型号来凑预算。
7. 口语化，像同事说话。不要用 Markdown 标题、不要"首先/其次/综上"、不要列长清单。
8. 每次回复不超过 120 字。

如果销售已经明确要推荐、且预算和用途都有了，就给出 1-2 个具体机型：一句为什么 + 价格 + 一个下一步动作。`;

const CONTENT_PROMPT = `你是华为门店的内容策划，正在帮销售写可以直接发出去的软文。

必须遵守：
1. 只使用【资料】里的型号与事实，不编造参数、价格、活动。
2. 开头用一个具体场景切入（谁、在什么情况下、遇到什么问题），不要喊口号。
3. 不写"全网最好/第一/绝对"这类极限词。
4. 结尾留一个自然的到店钩子。
5. 直接输出正文，不要解释你的思路，不要 Markdown 标题。
6. 控制在 300-500 字。
7. 不要编造门店地址、电话、营业时间、活动日期；需要引导时说「到店」「私聊」，绝不用 XX 占位。`;

export function recommendCandidates(slots) {
  if (!slots.budget) return [];
  const query = `${slots.scenario || ""} ${slots.preference || ""}`;
  let list = candidatesByBudget(slots.budget, query);
  // 预算内没有：退回「最接近预算的机型」，并标记超预算，绝不虚构
  if (!list.length) {
    list = candidatesByBudget(null, query).slice().sort((a, b) => a.minPrice - b.minPrice).slice(0, 2);
  }
  return list.slice(0, 3).map((c) => ({
    model: c.productName,
    price: c.minPrice,
    over: c.minPrice > slots.budget,
    oneLiner: (c.card?.cards?.identity?.conclusion || c.card?.cards?.audience?.conclusion || "").slice(0, 70),
    sku: c.skus.find((s) => /\d/.test(s.sku) && !/专区默认|官网产品页/.test(s.sku)) || c.skus[0],
  }));
}

/** 平台规则注入：直接用 mcp 规则卡，和审核同源 */
export function platformBlock(platform) {
  if (!platform) return "";
  let spec;
  try {
    spec = getSpec(platform);
  } catch {
    return "";
  }
  const L = spec.limits;

  const STYLE = {
    xiaohongshu: {
      voice:
        "像女生分享好物：第一人称、口语、短句，每段 1-2 行；标题要有钩子；正文先给结果或痛点，不要自我介绍；带 1-2 个 emoji（至少 1 个）；结尾一句互动，再给 3-5 个话题标签。",
      shape:
        "第一行必须是标题（≤20 字，像「网课党换本前先看这篇」，不要句号/感叹号，不要 #）；空行；正文 3-5 段；空行；#话题 #话题 #话题",
    },
    moments: {
      voice:
        "像发朋友圈：第一人称、生活化、像跟朋友说话；不写标题、不堆参数、不用 Markdown；3-5 行说完，最多 1 个 emoji；结尾留一个轻钩子（到店/私聊），不要促销腔。",
      shape: "只写正文，不写标题；≤6 行、≤300 字",
    },
    "wechat-mp": {
      voice:
        "像公众号推文：先导语，再 3 个小标题展开（用「一、二、三」或短句），最后给结论和行动建议；克制、少 emoji、不喊口号、不用感叹号堆情绪。",
      shape: "第一行标题（≤64 字）；空行；正文 800-1500 字，含 3 个小标题",
    },
    poster: {
      voice:
        "海报文案：短语、数字优先、强对比；不写长句、不用「我们」；主标题直给结果，副标题一句卖点，再给价格、期限、到店引导。",
      shape:
        "第一行主标题（≤12 字）；空行；最多 4 行短句，每行 ≤18 字，依次为：卖点 / 价格 / 期限 / 到店；全篇正文不超过 100 字",
    },
  };

  const st = STYLE[platform] || STYLE.xiaohongshu;

  return `

【平台：${spec.label}】${spec.capabilityNote ? `（${spec.capabilityNote}）` : ""}
- 写法：${st.voice}
- 结构：${st.shape}
- 正文长度：${L.bodyMin}-${L.bodyMax} 字
- 禁用表达：${(spec.banned || []).join("、")}
- 必备：${(spec.required || []).map((r) => r.label).join("、") || "无"}
- 配图：${L.images?.min || 0}-${L.images?.max || 0} 张${L.images?.ratio ? `，比例 ${L.images.ratio}` : ""}`;
}

export function parseContent(raw, platform) {
  // 模型偶尔会写「标题：」「正文：」，统一剥掉
  const strip = (s) => String(s).replace(/^\s*(主标题|副标题|标题|正文|文案)\s*[：:]\s*/, "").trim();
  const text = String(raw || "").trim();
  if (platform === "moments") return { title: "", body: strip(text), tags: [] };

  const lines = text.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return { title: "", body: text, tags: [] };

  const title = strip(lines[firstIdx]).replace(/^#+\s*/, "").replace(/^["“]|["”]$/g, "");
  let body = lines
    .slice(firstIdx + 1)
    .map((l, i) => (i === 0 ? strip(l) : l))
    .join("\n")
    .trim();

  const tagLine = body
    .split("\n")
    .reverse()
    .find((l) => /^\s*#[^\s#]+/.test(l));
  const tags = tagLine
    ? tagLine.split(/\s+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean)
    : [];
  if (tagLine) body = body.replace(tagLine, "").trim();

  return { title, body, tags };
}

const WORD_FIX = {
  最好: "更建议", 最佳: "更合适", 最强: "更强", 最低价: "更低价格", 最高级: "更高规格",
  第一: "优先", 国家级: "行业级", 顶级: "高端", 绝对: "基本", "100%": "很高",
  全网最低: "价格有优势", 史无前例: "少见", 永久: "长期", 包治: "可改善",
};

export function rebuild({ platform, title, body, tags }) {
  if (platform === "moments") return body;
  const head = title ? `${title}\n\n` : "";
  const tail = tags?.length ? `\n\n${tags.map((t) => `#${t}`).join(" ")}` : "";
  return `${head}${body}${tail}`.trim();
}

export function compressText(text, max) {
  const raw = String(text || "");
  if ([...raw].length <= max) return raw;

  // 多行内容优先按整行保留，避免把短语截断
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    let out = "";
    for (const line of lines) {
      const next = out ? `${out}\n${line}` : line;
      if ([...next].length > max) break;
      out = next;
    }
    if (out) return out;
  }

  const parts = raw.split(/(?<=[。！？])/);
  let out = "";
  for (const p of parts) {
    if ([...(out + p)].length > max) break;
    out += p;
  }
  return out || [...raw].slice(0, max - 1).join("") + "…";
}

/** 确定性兜底：模型改不动时，按规则直接修 */
function autoFix(reply, platform) {
  let out = String(reply || "");
  const applied = [];
  for (const [bad, good] of Object.entries(WORD_FIX)) {
    if (out.includes(bad)) {
      out = out.split(bad).join(good);
      applied.push(`「${bad}」→「${good}」`);
    }
  }
  return { reply: out, applied };
}

/** 写完按平台规则卡审一遍；有 error 就让模型只改违规点 */
async function reviewAndFix({ reply, platform, messages, mode, facts, slots, candidates }) {
  if (!platform) return { reply, issues: [] };
  const parse = (r) => parseContent(r, platform);
  let c = parse(reply);
  let rv = review({ platform, ...c, images: [] });
  // 配图由前端按平台生成，这里的「图片数量」提示没有意义
  const visible = rv.issues.filter((i) => !i.rule.startsWith("images"));
  let issues = visible.filter((i) => i.level === "error");
  if (!issues.length) return { reply, issues: visible };

  const fixed = await llmChat({
    messages: [
      ...buildMessages({ messages, mode, facts, slots, candidates }),
      { role: "assistant", content: reply },
      {
        role: "user",
        content:
          "下面的内容违反平台规则，请只修改违规点，其他内容保持不变，直接输出改后的完整内容：\n" +
          issues.map((i) => `- ${i.message}`).join("\n"),
      },
    ],
    temperature: 0.3,
    maxTokens: 900,
  });
  c = parse(fixed);
  rv = review({ platform, ...c, images: [] });
  issues = rv.issues.filter((i) => !i.rule.startsWith("images") && i.level === "error");
  return { reply: fixed, issues: rv.issues.filter((i) => !i.rule.startsWith("images")), fixed: issues.length === 0 };
}

export function buildMessages({ messages, mode, facts, slots, candidates = [], platform }) {
  const context = facts.length
    ? facts.map(factLine).join("\n")
    : "（本次没有检索到可用资料，请直接告诉对方需要到店确认，不要编造）";
  const slotText = [
    slots.segment && `人群=${slots.segment}`,
    slots.budget && `预算=${slots.budget}`,
    slots.scenario && `场景=${slots.scenario}`,
    slots.preference && `偏好=${slots.preference}`,
    slots.platform && `平台=${slots.platform}`,
  ]
    .filter(Boolean)
    .join("，") || "暂无";

  const mustRecommend = shouldRecommend(messages, slots, mode);

  const candidateText = candidates.length
    ? "\n【候选机型（已按预算匹配）】\n" +
      candidates
        .map(
          (c) =>
            `- ${c.model}｜官方公开价 ¥${c.price.toLocaleString()} 起${c.over ? `（超预算 ¥${(c.price - (slots.budget || 0)).toLocaleString()}）` : ""}｜${c.oneLiner}`,
        )
        .join("\n")
    : "";

  const system =
    (mode === "content" ? CONTENT_PROMPT : GUIDE_PROMPT) +
    (mode === "content" ? platformBlock(platform) : "") +
    `\n\n【已知信息】${slotText}\n【资料】\n${context}` +
    candidateText +
    (mustRecommend
      ? "\n\n【本轮要求·硬约束】你已经问过两轮，信息足够。这次必须直接给结论：点名 1 个具体机型，给出它的官方公开价、是否超预算；如果候选里全是超预算的，就挑最接近的一台，明说超了多少。不要只说\"没有合适的\"。回复中禁止出现问号，禁止反问。"
      : "");

  return [{ role: "system", content: system }, ...messages.slice(-12)];
}

const countQuestions = (s) => (String(s).match(/[？?]/g) || []).length;

function shouldRecommend(messages, slots, mode) {
  const asked = messages.filter((m) => m.role === "assistant").length;
  return mode === "guide" && asked >= 2 && Boolean(slots.budget && slots.scenario);
}

/**
 * 选项生成：正文写完后再单独问一次，只让它把问题拆成短选项
 * 比在同一个回复里塞标记更稳（实测模型会忽略标记）
 */
async function makeOptions(reply, slots) {
  const known = [
    slots.segment && `人群=${slots.segment}`,
    slots.budget && `预算=${slots.budget}`,
    slots.scenario && `场景=${slots.scenario}`,
    slots.preference && `偏好=${slots.preference}`,
  ].filter(Boolean).join("，");
  try {
    const raw = await llmChat({
      messages: [
        {
          role: "system",
          content:
            "把下面这个问题，拆成 3-4 个「顾客能直接说出口的回答」。每个不超过 12 个字，口语化。只输出选项本身，用 | 分隔，不要编号，不要解释。" +
              "\n示例：问题「他更在意机身轻，还是屏幕舒服？」→ 机身轻|屏幕舒服|两者都要|还没想过",
        },
        { role: "user", content: `问题：${reply}\n已知：${known || "无"}` },
      ],
      temperature: 0.4,
      maxTokens: 120,
    });
    return String(raw)
      .split(/[|｜\n]/)
      .map((x) => x.trim().replace(/^[-*\d.、\s]+/, ""))
      .filter((x) => x && x.length <= 16)
      .slice(0, 4);
  } catch {
    return [];
  }
}

/** 兜底选项：按最该补的槽位给 */
export function fallbackOptions(slots) {
  if (!slots.scenario) return ["主要办公文档", "剪视频/做设计", "上网课/学习", "打游戏"];
  if (!slots.budget) return ["4000-5000", "5000-6000", "6000-8000", "8000以上"];
  if (!slots.segment) return ["学生", "职场上班", "设计师/创作者", "家庭/孩子用"];
  if (!slots.preference) return ["越轻越好", "续航优先", "性能优先", "屏幕色准优先"];
  return [];
}

/**
 * 跑一轮对话
 * @returns {{reply, options, facts, slots, warning?}}
 */
export async function converse({ messages = [], mode = "guide", platform } = {}) {
  if (!Array.isArray(messages) || !messages.length) throw new Error("messages 不能为空");
  const { slots, facts } = gatherFacts(messages);
  const mustRec = shouldRecommend(messages, slots, mode);
  const candidates = mustRec ? recommendCandidates(slots) : [];

  let reply = await llmChat({
    messages: buildMessages({ messages, mode, facts, slots, candidates, platform }),
    temperature: 0.6,
    maxTokens: 900,
  });
  let options = [];
  let warning;
  let issues = [];

  if (mode === "content") {
    const checked = await reviewAndFix({ reply, platform, messages, mode, facts, slots, candidates });
    reply = checked.reply;
    issues = checked.issues;

    // 模型没改干净就确定性兜底，保证交付物能过规则卡
    if (platform && issues.some((i) => i.level === "error")) {
      const fixed = autoFix(reply, platform);
      const parsed = parseContent(fixed.reply, platform);
      const rv = review({ platform, ...parsed, images: [] });
      // 兜底结果即使还有残留问题也采用，避免把超长稿直接交付
      reply = fixed.reply;
      issues = rv.issues.filter((i) => !i.rule.startsWith("images"));
      warning =
        rv.errorCount === 0
          ? `已按规则自动修正：${fixed.applied.join("；") || "格式"}`
          : "仍有未通过项，请人工复核";
    }
  }

  // 该给结论时禁止再问
  if (mustRec && countQuestions(reply) > 0) {
    reply = await llmChat({
      messages: [
        ...buildMessages({ messages, mode, facts, slots, candidates, platform }),
        { role: "assistant", content: reply },
        { role: "user", content: "不要再问问题。直接给机型、为什么、价格口径和下一步。" },
      ],
      temperature: 0.2,
      maxTokens: 500,
    });
    warning = "已切换到推荐";
    if (countQuestions(reply) > 0) {
      reply = String(reply)
        .split(/(?<=[。！!])/)
        .filter((p) => !/[？?]/.test(p))
        .join("")
        .trim() || reply;
    }
  }

  // 一次只问一个问题
  if (!mustRec && countQuestions(reply) > 1) {
    const stricter = await llmChat({
      messages: [
        ...buildMessages({ messages, mode, facts, slots, candidates, platform }),
        { role: "assistant", content: reply },
        { role: "user", content: "你刚才一次问了不止一个问题。只保留最关键的那一个，其余删掉，120 字以内。" },
      ],
      temperature: 0.3,
      maxTokens: 400,
    });
    if (countQuestions(stricter) < countQuestions(reply)) {
      reply = stricter;
      warning = "已把多问题收敛为一个";
    }
  }

  // 交付前最后一道硬闸：标题与正文字数按规则卡收敛
  if (mode === "content" && platform) {
    try {
      const spec = getSpec(platform);
      const parsed = parseContent(reply, platform);
      let changed = false;
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
        if (cut >= 4) {
          const keepMark = /[？?！!]/.test(head[cut]);
          parsed.title = head.slice(0, keepMark ? cut + 1 : cut);
        } else {
          parsed.title = chars.slice(0, spec.limits.titleMax - 1).join("") + "…";
        }
        changed = true;
      }
      if ([...parsed.body].length > spec.limits.bodyMax) {
        parsed.body = compressText(parsed.body, Math.floor(spec.limits.bodyMax * 0.9));
        changed = true;
      }
      if (changed) {
        reply = rebuild({ ...parsed, platform }, platform);
        // 收敛后重新审核，避免返回过期的 issue
        const rv = review({ platform, ...parseContent(reply, platform), images: [] });
        issues = rv.issues.filter((i) => !i.rule.startsWith("images"));
        warning = warning || "已按平台字数上限收敛";
      }
    } catch {
      /* 忽略 */
    }
  }

  // 只有在提问时才生成选项
  if (mode === "guide" && !mustRec && countQuestions(reply) === 1) {
    options = await makeOptions(reply, slots);
    if (!options.length) options = fallbackOptions(slots);
  }

  return {
    reply: String(reply).trim(),
    options: options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4),
    slots,
    facts: facts.map((f) => ({ model: f.model, text: f.text.slice(0, 90), source: f.source })),
    issues: issues.map((i) => ({ level: i.level, rule: i.rule, message: i.message })),
    warning,
  };
}
