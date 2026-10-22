// 顾客问答的确定性兜底：不依赖模型也能给出有依据的候选与下一步。
// 槽位规则：后说的覆盖先说的；否定表达不算命中；系统（Windows/鸿蒙）参与筛选。
import { getFacts, listProducts } from "./ledger.mjs";

const SCENARIOS = {
  edit: ["剪视频", "视频", "剪辑", "设计", "修图", "创作"],
  study: ["网课", "上课", "学习", "学生", "考研", "图书馆"],
  office: ["办公", "文档", "会议", "出差", "通勤", "上班"],
  dev: ["编程", "代码", "开发"],
  game: ["游戏"],
};
const NEGATION = /(不|别|非|没|无需|不用|不要|不想|不考虑|不是|除了)/;

function lastUser(messages) {
  return [...messages].reverse().find((m) => m?.role === "user")?.content || "";
}

function findBudget(text) {
  const range = text.match(/(\d{3,5})\s*[-–—~至到]\s*(\d{3,5})/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const numbers = [...text.matchAll(/(?<![\d.])(\d{3,5})(?![\d.])/g)].map((m) => Number(m[1]));
  if (!numbers.length) return null;
  if (/(预算|改成|改到|换成|调到|改|以内|左右|最多|不超过|元|块)/.test(text)) {
    return numbers[numbers.length - 1];
  }
  return null;
}

function findScenario(text) {
  for (const [key, words] of Object.entries(SCENARIOS)) {
    for (const word of words) {
      let index = text.indexOf(word);
      while (index >= 0) {
        const before = text.slice(Math.max(0, index - 4), index);
        if (!NEGATION.test(before)) return { key, label: word };
        index = text.indexOf(word, index + 1);
      }
    }
  }
  return null;
}

function negatedScenarios(text) {
  const out = new Set();
  for (const [key, words] of Object.entries(SCENARIOS)) {
    for (const word of words) {
      const index = text.indexOf(word);
      if (index >= 0 && NEGATION.test(text.slice(Math.max(0, index - 4), index))) out.add(key);
    }
  }
  return out;
}

function findOS(text) {
  const noHarmony = /(不要|不用|不想要|不考虑|排除|别给)[^，。；]{0,6}(鸿蒙|harmony)/i.test(text);
  const noWindows = /(不要|不用|不想要|不考虑|排除|别给)[^，。；]{0,6}(windows|win10|win11)/i.test(text);
  const wantsWindows = /(必须|只要|就要|要|得是)[^，。；]{0,4}(windows|win10|win11)/i.test(text);
  const wantsHarmony = /(必须|只要|就要|要|得是)[^，。；]{0,4}(鸿蒙|harmony)/i.test(text);
  if (noHarmony || wantsWindows) return "windows";
  if (noWindows || wantsHarmony) return "harmony";
  const hasWindows = /(windows|win10|win11)/i.test(text);
  const hasHarmony = /(鸿蒙|harmony)/i.test(text);
  if (hasWindows && !hasHarmony) return "windows";
  if (hasHarmony && !hasWindows) return "harmony";
  return null;
}

function findSegment(text) {
  const pairs = [
    ["学生", ["学生", "大学生", "研究生", "考研", "上课"]],
    ["职场", ["上班", "职场", "通勤", "办公", "出差"]],
    ["创作者", ["剪辑", "视频", "设计", "摄影", "创作"]],
    ["家庭", ["家长", "孩子", "爸妈", "家庭"]],
  ];
  for (const [label, words] of pairs) {
    if (words.some((word) => text.includes(word))) return label;
  }
  return null;
}

function extractSlots(messages) {
  const slots = { budget: null, scenario: null, segment: null, os: null };
  for (const message of messages.filter((item) => item?.role === "user")) {
    const text = String(message.content || "");
    if (!text.trim()) continue;
    const budget = findBudget(text);
    if (budget !== null) slots.budget = budget;
    const scenario = findScenario(text);
    const negated = negatedScenarios(text);
    if (scenario) slots.scenario = scenario.label;
    else if (negated.size) slots.scenario = null;
    const os = findOS(text);
    if (os) slots.os = os;
    const segment = findSegment(text);
    if (segment) slots.segment = segment;
  }
  return slots;
}

function scoreProduct(product, scenarioKey) {
  const order = {
    edit: ["matebook-gt-14", "matebook-pro-s", "matebook-x-pro"],
    study: ["matebook-14-harmony", "matebook-d-14", "matebook-d-16", "matebook-pro-s"],
    office: ["matebook-pro-s", "matebook-x-pro", "matebook-14-harmony", "matebook-14-ultra", "matebook-d-14", "matebook-d-16"],
    dev: ["matebook-gt-14", "matebook-pro-s", "matebook-x-pro"],
    game: ["matebook-gt-14", "matebook-pro-s"],
  }[scenarioKey || "office"] || [];
  const index = order.indexOf(product.id);
  return index >= 0 ? 50 - index * 5 : 0;
}

function scenarioKeyFromLabel(label) {
  if (!label) return "office";
  for (const [key, words] of Object.entries(SCENARIOS)) {
    if (words.includes(label)) return key;
  }
  return "office";
}

function matchesOS(product, os) {
  if (!os) return true;
  const family = String(product.family || "");
  return os === "windows" ? family.includes("Windows") : family.includes("鸿蒙");
}

function productCard(product, budget) {
  const productFacts = getFacts(product.id);
  const fact =
    productFacts.find((f) => f.field === "audience") ||
    productFacts.find((f) => f.field === "screen") ||
    productFacts.find((f) => f.field === "portable") ||
    productFacts[0];
  const limit = getFacts(product.id).find((f) => /确认|限制|仅|没有|兼容/.test(String(f.value)))?.value || "具体配置需按 SKU 确认";
  return {
    id: product.id,
    model: product.name,
    shortName: product.shortName,
    family: product.family,
    priceLabel: product.price.label,
    overBy: product.price.status === "active" && product.price.min > budget ? product.price.min - budget : 0,
    reason: String(fact?.value || "已收录同型号官方事实").slice(0, 82),
    limitation: String(limit).slice(0, 76),
    priceStatus: product.price.status,
  };
}

export function localAsk({ messages = [] } = {}) {
  if (!Array.isArray(messages) || !messages.length) throw new Error("messages 不能为空");
  const slots = extractSlots(messages);
  const scenarioKey = scenarioKeyFromLabel(slots.scenario);
  const budget = slots.budget;

  let options = [];
  let reply = "";
  let cards = [];

  if (budget === null && !slots.scenario) {
    reply = "这台电脑主要拿来做什么？预算大概多少？";
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "预算 6000 左右"];
  } else if (budget === null) {
    reply = `${slots.scenario}是吧。预算大概多少？我给你收两三个型号。`;
    options = ["预算 4000–5000", "预算 5000–6000", "预算 6000–8000", "预算 8000 以上"];
  } else if (!slots.scenario) {
    reply = `${budget.toLocaleString("zh-CN")} 元的话，主要拿来做什么？`;
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "游戏/高性能"];
  } else {
    const all = listProducts()
      .map((product) => ({ product, score: scoreProduct(product, scenarioKey) }))
      .filter((item) => item.score > 0 && item.product.price.status !== "missing")
      .filter((item) => matchesOS(item.product, slots.os));

    if (!all.length) {
      const osLabel = slots.os === "windows" ? "Windows" : slots.os === "harmony" ? "鸿蒙" : "";
      reply = `库里没有同时满足${osLabel ? `${osLabel}、` : ""}这个用途和预算的型号。放宽系统或预算，我再筛一轮？`;
      options = slots.os ? ["可以看鸿蒙", "可以看 Windows", "预算再放宽一点"] : ["预算再放宽一点", "换个用途看看"];
    } else {
      const withinBudget = (product) => !product.price.min || product.price.min <= budget * 1.15;
      const candidates = all
        .sort(
          (a, b) =>
            Number(withinBudget(b.product)) - Number(withinBudget(a.product)) ||
            b.score - a.score ||
            (a.product.price.min || 0) - (b.product.price.min || 0),
        )
        .slice(0, 2)
        .map((item) => item.product);

      const within = candidates.filter(
        (product) => !product.price.min || product.price.min <= budget * 1.15,
      );
      const picked = (within.length ? within : candidates).slice(0, 2);
      cards = picked.map((product) => productCard(product, budget));
      const budgetLine = picked
        .map((product) => {
          if (!product.price.min) return `${product.shortName}（${product.price.label}）`;
          if (product.price.min <= budget) return `${product.shortName}（${product.price.label}）`;
          const over = `比预算高约 ¥${(product.price.min - budget).toLocaleString("zh-CN")}`;
          return product.price.status === "active"
            ? `${product.shortName}（${product.price.label}，${over}）`
            : `${product.shortName}（${product.price.label}，${over}，只能参考）`;
        })
        .join("；");
      const osNote = slots.os === "windows" ? "只看 Windows 机型。" : slots.os === "harmony" ? "只看鸿蒙机型。" : "";
      const intro = within.length
        ? `${budget.toLocaleString("zh-CN")} 元，${slots.scenario}，${osNote}先看${budgetLine}。`
        : `这个价位没有正合适的现售机型，${osNote}先看${budgetLine}。`;
      reply = `${intro}\n\n你更在意屏幕，还是背着轻？`;
      options = ["屏幕和性能优先", "轻一点、好带出门", "接口够用就行", "价格再压一点"];
    }
  }

  const products = listProducts();
  const facts = products
    .filter((product) => cards.some((card) => card.id === product.id))
    .flatMap((product) =>
      getFacts(product.id, { includePrice: false })
        .slice(0, 2)
        .map((fact) => ({ model: product.name, text: String(fact.value).slice(0, 90), source: fact.sourceTitle })),
    );

  return {
    reply,
    options: options.slice(0, 4),
    facts,
    slots,
    cards,
    warning: "价格有冲突，或者只有参考价时，这里不报数字。",
  };
}
