// 模型写作：五渠道文案由 DeepSeek 生成；事实、价格与核验仍由确定性代码决定。
// 任何模型失败都退回规则稿，并在任务里如实标记，不伪装成模型成功。
import { chat } from "../deepseek.mjs";
import { getSpec } from "../mcp/core.mjs";

const MODEL = process.env.DEEPSEEK_CONTENT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
const SERVERLESS = Boolean(process.env.VERCEL || process.env.NETLIFY);
const MAX_ATTEMPTS = Number(process.env.HC_MODEL_ATTEMPTS || (SERVERLESS ? 1 : 2));
const TIMEOUT_MS = Number(process.env.HC_MODEL_TIMEOUT_MS || (SERVERLESS ? 30_000 : 45_000));

const ANGLE_GUIDE = {
  pain: "从顾客的麻烦写起。第一句就写他正在做的动作，不要先介绍产品，也不要先讲参数。",
  avoidance: "先说一个容易买错的地方，再给判断方法。像在店里提醒人，不像写测评。",
  story: "只按已知细节复述，不补人物、对白、表情、心理、成交或离开。宁可写得平一点，也不要编一幕戏。",
};

const PLATFORM_GUIDE = {
  xiaohongshu:
    "标题 8–20 字，像跟朋友说话；正文 300–800 字，一两句一段；3–5 个话题标签；一条首评；结尾给一个自然动作。",
  moments:
    "没有标题；40–280 字；像自己发朋友圈，不像门店广告；结尾轻轻带一句到店或私聊。",
  "wechat-mp":
    "标题 ≤64 字；摘要 ≤120 字；正文 800–1400 字，用空行分段，三个小标题各占一行（一、… / 二、… / 三、…）；文末必须原样带来源说明：信息基准日 2026-10-17，产品信息来自华为官方公开资料；具体配置与价格以门店实际报价为准。",
  poster:
    "主标题 6–12 字；最多 4 行短句，一行一个意思，别写成文案墙；不写话题标签；二维码、地址、电话留白。",
  video:
    "标题 ≤12 字；口播 45–60 秒，保留“0–3 秒：/3–15 秒：/15–32 秒：/32–48 秒：/48–60 秒：”；3–5 个分镜；前 3 秒说人话，不要喊口号。",
};

function str(value) {
  return String(value == null ? "" : value).trim();
}

function list(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  const text = str(value);
  return text ? text.split(/[\n,，、]+/).map(str).filter(Boolean) : [];
}

function humanizeCopy(text) {
  return str(text)
    .replace(/真正/g, "")
    .replace(/边界/g, "不合适的地方")
    .replace(/说到底[，,]?/g, "")
    .replace(/说白了[，,]?/g, "")
    .replace(/值得注意的是[，,]?/g, "")
    .replace(/更重要的是[，,]?/g, "")
    .replace(/先说结论[：:，,]?/g, "")
    .replace(/在这个[^。，\n]{0,15}的时代[，,]?/g, "")
    .replace(/换句话说[，,]?/g, "也就是说，")
    .replace(/这意味着/g, "也就是说")
    .replace(/某种程度上[，,]?/g, "")
    .replace(/不难看出[，,]?/g, "")
    .replace(/([\u4e00-\u9fa5])(\d)/g, "$1 $2")
    .replace(/(\d)([\u4e00-\u9fa5])/g, "$1 $2")
    .replace(/[，,]{2,}/g, "，")
    .replace(/^[，,。\s]+/g, "")
    .trim();
}

function cleanFactIds(text) {
  return humanizeCopy(text)
    .replace(/[（(]\s*F\d+\s*[)）]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(text, max) {
  const chars = [...str(text)];
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}

function clipTitle(text, max) {
  const chars = [...str(text)];
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max).join("");
  const cut = Math.max(head.lastIndexOf("，"), head.lastIndexOf("、"), head.lastIndexOf(" "));
  return cut >= Math.floor(max * 0.5) ? head.slice(0, cut) : head;
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
    "你是替门店同事写内容的人。写完要像这家店的销售自己敲出来的，不像品牌通稿，也不像 AI 总结。",
    "写之前先想清楚：这个顾客今天卡在哪儿？第一句就写那个动作或麻烦，不要铺垫，不要喊口号。",
    "事实规则：",
    "1. 只能使用【事实清单】里的数字、规格、型号、条件；不得新增任何数字、单位、型号、SKU、活动、库存、赠品、保修、销量、奖项、顾客评价。",
    "2. 价格：只有【价格口径】不是“不可写”时，才能原样引用其中的金额；否则全文不得出现任何金额。",
    "3. 真实细节只写已知信息。不要补人名、学校、公司、天气、顾客表情、对话、停顿、成交，也不要写成“我亲测/我背了/我用了”。顾客的动作和对白只写到已知信息为止，不要补“走了两圈”“临走他说”这种没发生的细节。不要替顾客用第一人称写体验（“我回宿舍”“我背着它”）；“我”只能指店里的人。",
    "3b. 不要写“他说/她说/他问/我递过去/他拎着没说话/临走/走的时候/笑了笑”这类对白和动作。真实细节里没有的，一个字都不补。",
    "写法规则：",
    "4. 开口就写具体动作或场景，再写支撑它的事实。卖点顺序由麻烦决定，不要按“屏幕→重量→电池”堆参数。",
    "5. 同一个平台的三个角度，开头、结构、句子都要不一样，不要只换标题。",
    "6. 句子长短错开。少用破折号，少用“体验、效率、价值、能力、边界、场景化、闭环、生态、赋能”这类抽象词。",
    "7. 不要用这些 AI 腔：",
    "   - “不是……而是……”“与其说……不如说……”",
    "   - “真正”“真正……的是……”“说到底”“说白了”“值得注意的是”“更重要的是”",
    "   - “从……到……”排比、“不仅……还……”“既……又……”",
    "   - “关键是：……”这种冒号后面接金句的写法",
    "   - “轻，是拿在手里的”“好屏，是……”“效率，是……”这种定义句、金句式标题；标题先说清型号、数字或动作",
    "   - “在这个……的时代”“当我们在谈论……时”",
    "   - “先说结论”“总之”“综上”“最后”这类开头或收尾",
    "8. 写给顾客看，不要写成给销售的操作步骤。不要出现“先问他”“让他”“讲给他”这类指令。",
  "9. 不贬低竞品，不承诺没给出的权益，不写“全网最低”“永久”。",
    "9. 不要用“第一/第二/首先/其次”编号。",
    "10. 只输出 JSON，不要 Markdown 代码块，不要解释。",
    "可以这样写：",
    "“每天地铁来回一个半小时，肩上那台旧电脑接近两公斤。先看这台，标准屏版 798 g。”",
    "“卡和硬盘只能插一个？右侧 SD 卡槽，后侧两个 USB-A，不用来回拔。”",
    "不要这样写：",
    "“真正决定体验的，不是参数，而是重量。”",
    "“这不仅是一次接口升级，更是效率的跃迁。”",
    "“说到底，选对工具，才能把时间还给自己。”",
    "“轻，是拿在手里的。”",
    "“他拎着没说话，又拎了一下自己包里那台。”",
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
    variant.title = clipTitle(variant.title, 20);
    variant.body = clip(variant.body, 1000);
    if (!variant.tags.length) variant.tags = ["华为电脑", "门店体验", "AI生成"];
  }
  if (platform === "moments") {
    variant.title = "";
    variant.body = clip(variant.body, 300);
    variant.tags = [];
  }
  if (platform === "wechat-mp") {
    variant.title = clipTitle(variant.title, 64);
    variant.body = clip(variant.body, 3000);
    variant.tags = [];
  }
  if (platform === "poster") {
    variant.title = clipTitle(variant.title, 12);
    if (variant.posterLines.length) variant.body = variant.posterLines.slice(0, 4).join("\n");
    variant.body = clip(variant.body, 140);
    variant.tags = [];
  }
  if (platform === "video") {
    variant.title = clipTitle(variant.title, 12);
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
  if (platform === "wechat-mp") {
    const broken = variants.filter((item) => !/(一|1)[、.．]/.test(item.body) || !item.body.includes("\n\n"));
    if (broken.length) throw new Error("公众号正文要有三个小标题，并用空行分段");
  }
  if (platform === "poster") {
    const broken = variants.filter((item) => item.body.split("\n").filter(Boolean).length < 3);
    if (broken.length) throw new Error("海报正文至少三行短句");
  }
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
