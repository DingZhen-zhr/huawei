// 模型写作：五渠道文案由 DeepSeek 生成；事实、价格与核验仍由确定性代码决定。
// 任何模型失败都退回规则稿，并在任务里如实标记，不伪装成模型成功。
import { chat } from "../deepseek.mjs";
import { getSpec } from "../mcp/core.mjs";

const MODEL = process.env.DEEPSEEK_CONTENT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
const SERVERLESS = Boolean(process.env.VERCEL || process.env.NETLIFY);
const MAX_ATTEMPTS = Number(process.env.HC_MODEL_ATTEMPTS || (SERVERLESS ? 1 : 2));
const TIMEOUT_MS = Number(process.env.HC_MODEL_TIMEOUT_MS || (SERVERLESS ? 30_000 : 45_000));

const ANGLE_GUIDE = {
  pain: "痛点切入：第一段写顾客正在做的动作和卡点（用真实细节），第二段只给一个能解决卡点的事实，第三段写边界，最后给下一步。",
  avoidance: "避坑与选择：第一段写“先别急着……”，第二段给两个判断标准（用事实），第三段写一个不适合的情况，最后给下一步。",
  story: "真实场景故事：第一段写门店里的一幕（基于真实细节，不虚构成交/姓名），第二段写当时怎么判断，第三段写这台机器对应的一个事实和边界，最后给下一步。",
};

const PLATFORM_GUIDE = {
  xiaohongshu:
    "标题 8–20 字；正文 300–800 字，短段落；3–5 个话题标签；一条首评；结尾一个自然动作。不要写成长文或公文。",
  moments:
    "无标题；正文 40–280 字，短句；前 6 行内说完关键信息；结尾轻钩子（到店/私聊/看实物）。不要写参数清单。",
  "wechat-mp":
    "标题 ≤64 字；摘要 ≤120 字；正文 800–1400 字，必须含“一、二、三”三个小标题；文末必须原样带来源说明：信息基准日 2026-10-17，产品信息来自华为官方公开资料；具体配置与价格以门店实际报价为准。",
  poster:
    "主标题 6–12 字；正文最多 4 行短句（每行 ≤16 字），一屏一结论；不写话题标签；二维码/地址/电话留白，不编造。",
  video:
    "标题 ≤12 字；口播脚本 45–60 秒，保留“0–3 秒：/3–15 秒：/15–32 秒：/32–48 秒：/48–60 秒：”时间标记；3–5 个分镜；首 3 秒必须有钩子。",
};

function str(value) {
  return String(value == null ? "" : value).trim();
}

function list(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  const text = str(value);
  return text ? text.split(/[\n,，、]+/).map(str).filter(Boolean) : [];
}

function cleanFactIds(text) {
  return str(text)
    .replace(/[（(]\s*F\d+\s*[)）]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clip(text, max) {
  const chars = [...str(text)];
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}

export function contentModel() {
  return MODEL;
}

export function modelEnabled() {
  return Boolean(process.env.DEEPSEEK_API_KEY) && process.env.HC_GENERATION !== "rules";
}

function factSheet(product) {
  const facts = (product.facts || [])
    .filter((fact) => fact.field !== "price")
    .filter((fact) => fact.value)
    .slice(0, 28);
  return facts.map((fact, index) => ({
    id: `F${index + 1}`,
    field: fact.field,
    text: str(fact.value),
    source: str(fact.sourceTitle || fact.source || ""),
  }));
}

function priceLine(product) {
  if (product.price?.status !== "active") return null;
  return `${product.price.label}（2026-10-17 官方快照，以门店实际报价为准）`;
}

function anglesFor(platform) {
  return ["xiaohongshu", "moments", "video"].includes(platform) ? ["pain", "avoidance", "story"] : ["pain"];
}

function buildPrompt({ product, platform, realDetail, audience, scene, target, store }) {
  const spec = (() => {
    try {
      return getSpec(platform);
    } catch {
      return null;
    }
  })();
  const facts = factSheet(product);
  const price = priceLine(product);
  const angles = anglesFor(platform);
  const storeLine = [store?.name, store?.city, store?.voiceTone ? `口吻：${store.voiceTone}` : ""]
    .filter(Boolean)
    .join(" · ");

  const system = [
    "你是「华采智营」门店内容副驾驶的写作 Agent，服务华为 PC 门店销售。你写的每一句话都要能被事实账本核对。",
    "硬规则（违反会被系统拦下）：",
    "1. 只能使用【事实清单】里的数字、规格、型号、条件；不得新增任何数字、单位、型号、SKU、活动、库存、赠品、保修、销量、奖项、顾客评价。",
    "2. 价格：只有【价格口径】不是“不可写”时，才能原样引用其中的金额；否则全文不得出现任何金额。",
    "3. 真实细节必须保留，但只能作为“销售提供的场景”；不得补人名、学校、公司、天气、成交、使用天数，不得写成官方参数。",
    "4. 先写顾客正在做的动作或卡点，再写支撑它的事实；不要按“屏幕→重量→电池”堆参数。卖点顺序由痛点决定。",
    "4.1 真实细节只保留已知信息；不得补写顾客的动作、对话、表情、停顿、成交，也不得写成“我亲测/我背了/我用了”的个人体验。",
    "5. 同一平台的不同角度，开头、结构、句式必须不同；不得复用同一段话。",
    "6. 禁止使用：赋能、打造、引领、重新定义、在这个时代、首先/其次/最后、一站式、生态闭环、全方位、全新体验、轻松搞定、绝对、第一、最好、最强、100%（色域参数除外）。",
    "7. 不贬低竞品，不承诺未给出的权益，不写“全网最低”“永久”。",
    "8. 不要用“第一/第二/首先/其次”做编号，直接写判断句；也不要用序数词开头。",
    "9. 只输出 JSON，不要 Markdown 代码块，不要解释。",
  ].join("\n");

  const user = [
    `【产品】${product.name}（${product.family || ""}）`,
    storeLine ? `【门店】${storeLine}` : "",
    `【任务】受众：${audience || "到店顾客"}；场景：${scene || "门店接待"}；下一步动作：${target || "到店看实物"}`,
    `【真实细节】${str(realDetail)}（销售提供，必须保留；原样引用，不要补数字或单位）`,
    "【事实清单】",
    ...facts.map((fact) => `[${fact.id}] ${fact.text}（来源：${fact.source || "官方资料"}）`),
    `【价格口径】${price || "不可写（该型号价格冻结/无当前售价，全文不得出现金额）"}`,
    `【平台】${spec?.label || platform}`,
    `【平台规则】${PLATFORM_GUIDE[platform] || ""}`,
    spec?.style?.tone ? `【语气】${spec.style.tone}` : "",
    spec?.required?.length ? `【必备】${spec.required.map((r) => `${r.label}：${r.hint}`).join("；")}` : "",
    `【角度】${angles.map((angle) => `${angle}=${ANGLE_GUIDE[angle]}`).join("\n")}`,
    "【输出 JSON 结构】",
    '{"variants":[{"angle":"pain","title":"","body":"","tags":[],"firstComment":"","cta":"","summary":"","script":"","shotList":[],"posterLines":[]}]}',
    `variants 必须按顺序包含 ${angles.join("、")} 三个 angle` + (angles.length === 1 ? "（只输出 pain）" : "") + "。",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function parseJson(raw) {
  const text = str(raw)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeVariant(raw, platform, angle, product) {
  const rawTitle = str(raw.title);
  const posterLines = list(raw.posterLines || raw.lines).slice(0, 4);
  let body = str(raw.body);
  if (!body && posterLines.length) body = posterLines.join("\n");
  if (!body && raw.script) body = str(raw.script);
  // 模型常把标题和话题标签也塞进正文：这里剥掉，避免复制出来重复。
  const hashtags = [...body.matchAll(/#([^\s#]+)/g)].map((match) => match[1]);
  body = body
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (rawTitle && body.startsWith(rawTitle)) body = body.slice(rawTitle.length).replace(/^\s+/, "");
  const tags = list(raw.tags)
    .map((tag) => tag.replace(/^#/, ""))
    .concat(hashtags)
    .filter((tag, index, all) => tag && all.indexOf(tag) === index)
    .slice(0, 5);
  const variant = {
    angle,
    title: cleanFactIds(rawTitle),
    body: cleanFactIds(body),
    tags,
    firstComment: cleanFactIds(raw.firstComment),
    cta: cleanFactIds(raw.cta),
    summary: cleanFactIds(raw.summary),
    script: cleanFactIds(raw.script),
    shotList: list(raw.shotList).map(cleanFactIds).slice(0, 6),
    posterLines: posterLines.map(cleanFactIds),
    limitations: [],
    evidence: [],
  };
  if (platform === "xiaohongshu") {
    variant.title = clip(variant.title, 20);
    variant.body = clip(variant.body, 1000);
    if (!variant.tags.length) variant.tags = ["华为电脑", "门店体验", "AI生成"];
  }
  if (platform === "moments") {
    variant.title = "";
    variant.body = clip(variant.body, 300);
    variant.tags = [];
  }
  if (platform === "wechat-mp") {
    variant.title = clip(variant.title, 64);
    variant.body = clip(variant.body, 3000);
    variant.tags = [];
  }
  if (platform === "poster") {
    variant.title = clip(variant.title, 12);
    variant.body = clip(variant.body, 100);
    variant.tags = [];
  }
  if (platform === "video") {
    variant.title = clip(variant.title, 12);
    variant.body = clip(variant.script || variant.body, 1600);
    variant.tags = [];
  }
  if (!variant.cta) variant.cta = "想摸一下重量和屏幕，直接到店看实物。";
  variant.limitations = [product.price?.status === "active" ? "价格以门店实际报价为准" : "价格字段冻结，正文不写具体价格"];
  return variant;
}

function validate(variants, platform, angles) {
  const missing = angles.filter((angle) => !variants.some((item) => item.angle === angle && item.body));
  if (missing.length) throw new Error(`模型缺少角度：${missing.join("、")}`);
  const minBody = platform === "wechat-mp" ? 700 : platform === "poster" ? 8 : platform === "moments" ? 40 : 160;
  const short = variants.filter((item) => [...item.body].length < minBody);
  if (short.length) throw new Error(`模型正文过短：${short.map((item) => item.angle).join("、")}`);
}

async function attemptPrompt({ product, platform, realDetail, audience, scene, target, store, attempt, feedback }) {
  const messages = buildPrompt({ product, platform, realDetail, audience, scene, target, store });
  if (feedback) {
    messages.push({
      role: "user",
      content: `上一版没有通过检查：${feedback}。请重写这一版，仍然只输出 JSON。`,
    });
  }
  const raw = await chat({
    model: MODEL,
    messages,
    temperature: attempt === 1 ? 0.8 : 0.55,
    maxTokens: platform === "wechat-mp" ? 4200 : 2600,
    timeoutMs: TIMEOUT_MS,
    responseFormat: { type: "json_object" },
  });
  const parsed = parseJson(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed.variants;
  if (!Array.isArray(rows) || !rows.length) throw new Error("模型返回的 variants 为空");
  const angles = anglesFor(platform);
  const variants = angles.map((angle) => {
    const row = rows.find((item) => str(item.angle || item.angleKey) === angle) || rows[angles.indexOf(angle)];
    if (!row) throw new Error(`模型缺少角度 ${angle}`);
    return normalizeVariant(row, platform, angle, product);
  });
  validate(variants, platform, angles);
  return variants;
}

export async function generateWithModel({ product, platform, realDetail, audience, scene, target, store }) {
  let feedback = "";
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const variants = await attemptPrompt({ product, platform, realDetail, audience, scene, target, store, attempt, feedback });
      return variants.map((variant) => ({ ...variant, generatedBy: "model" }));
    } catch (error) {
      lastError = error;
      feedback = error?.message || "格式不正确";
    }
  }
  throw lastError || new Error("模型生成失败");
}

export function buildRepairPrompt({ product, platform, variant, reasons }) {
  const facts = factSheet(product);
  const angles = anglesFor(platform);
  return [
    {
      role: "system",
      content: [
        "你是一名严格的事实校对编辑。只修改被拦下的句子，不新增任何事实。",
        "只使用事实清单里的数字、单位、型号与条件；不得新增价格、活动、库存、赠品、保修、销量、评价。",
        "只输出 JSON：{\"title\":\"\",\"body\":\"\",\"tags\":[],\"firstComment\":\"\",\"cta\":\"\",\"script\":\"\",\"shotList\":[],\"posterLines\":[]}",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `产品：${product.name}`,
        `平台：${platform}；角度：${variant.angle}`,
        `被拦原因：${reasons.join("；")}`,
        "事实清单：",
        ...facts.map((fact) => `- ${fact.text}`),
        `价格口径：${priceLine(product) || "不可写（不得出现金额）"}`,
        `当前内容：\n${variant.copyText || variant.body || ""}`,
        `可用角度：${angles.join("、")}`,
        "保留真实细节和原有结构，删掉或替换掉没有依据的数字/承诺；正文长度保持原渠道要求。",
      ].join("\n"),
    },
  ];
}

export async function repairVariant({ product, platform, variant, reasons }) {
  const raw = await chat({
    model: MODEL,
    messages: buildRepairPrompt({ product, platform, variant, reasons }),
    temperature: 0.3,
    maxTokens: 2200,
    timeoutMs: Math.min(TIMEOUT_MS, 30_000),
    responseFormat: { type: "json_object" },
  });
  const parsed = parseJson(raw);
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  return normalizeVariant(row, platform, variant.angle, product);
}
