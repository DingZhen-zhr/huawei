// 顾客问答的确定性兜底：不依赖模型也能给出有依据的候选与下一步。
import { getFacts, getProduct, listProducts } from "./ledger.mjs";

const SCENARIOS = {
  edit: ["剪视频", "视频", "剪辑", "设计", "修图"],
  study: ["网课", "上课", "学习", "学生", "考研"],
  office: ["办公", "文档", "会议", "出差", "通勤", "上班"],
  dev: ["编程", "代码", "开发"],
  game: ["游戏"],
};

function lastUser(messages) {
  return [...messages].reverse().find((m) => m?.role === "user")?.content || "";
}

function allUserText(messages) {
  return messages.filter((m) => m?.role === "user").map((m) => m.content).join(" ");
}

function findBudget(text) {
  const direct = text.match(/(?:预算|价格|大概|最多|不超过)?\s*(\d{3,5})\s*(?:元|块|左右|以内)/);
  if (direct) return Number(direct[1]);
  const afterKeyword = text.match(/(?:预算|价格)\D{0,4}(\d{3,5})/);
  if (afterKeyword) return Number(afterKeyword[1]);
  const beforeKeyword = text.match(/(\d{3,5})\s*(?:元|块)?\s*(?:预算|以内)/);
  if (beforeKeyword) return Number(beforeKeyword[1]);
  const wan = text.match(/(\d(?:\.\d)?)\s*[千kK]/);
  if (wan) return Math.round(Number(wan[1]) * 1000);
  return null;
}

function findScenario(text) {
  for (const [key, words] of Object.entries(SCENARIOS)) {
    const hit = words.find((w) => text.includes(w));
    if (hit) return { key, label: hit };
  }
  return null;
}

function findSegment(text) {
  const pairs = [
    ["学生", ["学生", "大学生", "研究生", "考研"]],
    ["职场", ["上班", "职场", "通勤", "办公"]],
    ["创作者", ["剪辑", "视频", "设计", "摄影"]],
    ["家庭", ["家长", "孩子", "爸妈", "家庭"]],
  ];
  for (const [label, words] of pairs) {
    if (words.some((w) => text.includes(w))) return label;
  }
  return null;
}

function scoreProduct(product, scenario) {
  const order = {
    edit: ["matebook-gt-14", "matebook-pro-s", "matebook-x-pro"],
    study: ["matebook-14-harmony", "matebook-d-14", "matebook-pro-s"],
    office: ["matebook-pro-s", "matebook-x-pro", "matebook-14-harmony"],
    dev: ["matebook-gt-14", "matebook-pro-s", "matebook-x-pro"],
    game: ["matebook-gt-14", "matebook-pro-s"],
  }[scenario?.key || "office"] || [];
  const index = order.indexOf(product.id);
  return index >= 0 ? 50 - index * 5 : 0;
}

function productCard(product, budget) {
  const productFacts = getFacts(product.id);
  const fact = productFacts.find((f) => f.field === "audience") || productFacts.find((f) => f.field === "screen") || productFacts.find((f) => f.field === "portable") || productFacts[0];
  const limit = getFacts(product.id).find((f) => /确认|限制|仅|没有|兼容/.test(String(f.value)))?.value || "具体配置需按 SKU 确认";
  return {
    id: product.id,
    model: product.name,
    shortName: product.shortName,
    priceLabel: product.price.status === "conflict"
      ? "价格待门店确认"
      : product.price.label,
    overBy: product.price.status !== "conflict" && product.price.min > budget ? product.price.min - budget : 0,
    reason: String(fact?.value || "已收录同型号官方事实").slice(0, 82),
    limitation: String(limit).slice(0, 76),
    priceStatus: product.price.status,
  };
}

export function localAsk({ messages = [] } = {}) {
  if (!Array.isArray(messages) || !messages.length) throw new Error("messages 不能为空");
  const text = allUserText(messages);
  const budget = findBudget(text);
  const scenario = findScenario(text);
  const segment = findSegment(text);
  const products = listProducts();
  const slots = { budget, scenario: scenario?.label || null, segment };

  let options = [];
  let reply = "";
  let cards = [];

  if (!budget && !scenario) {
    reply = "先确认两件事：这台电脑主要用来做什么，预算大概在哪一档？";
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "预算 6000 左右"];
  } else if (!budget) {
    reply = `用途清楚了：${scenario.label}。预算大概在哪一档？我再把机型收敛到两三台。`;
    options = ["4000–5000", "5000–6000", "6000–8000", "8000 以上"];
  } else if (!scenario) {
    reply = `预算 ${budget.toLocaleString("zh-CN")} 元，先看主要用途。买来最常做的是哪件事？`;
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "游戏/高性能"];
  } else {
    const candidates = products
      .map((p) => ({ p, score: scoreProduct(p, scenario) }))
      .filter((x) => x.score > 0 && x.p.price.status !== "missing")
      .sort((a, b) => b.score - a.score || (a.p.price.min || 0) - (b.p.price.min || 0))
      .slice(0, 2)
      .map((x) => x.p);

    const within = candidates.filter((p) => p.price.status === "conflict" || !p.price.min || p.price.min <= budget * 1.15);
    const picked = (within.length ? within : candidates).slice(0, 2);
    cards = picked.map((p) => productCard(p, budget));
    const budgetLine = picked.map((p) => `${p.shortName}${p.price.status === "conflict" ? "（价格待确认）" : `（${p.price.label}${p.price.min > budget ? `，超预算约 ¥${(p.price.min - budget).toLocaleString("zh-CN")}` : ""}）`}`).join("；");
    const first = cards[0];
    const intro = within.length ? `预算 ${budget.toLocaleString("zh-CN")} 元、${scenario.label}，先看${budgetLine}。` : `这个预算内没有完全匹配的型号，先看${budgetLine}，超预算的部分你自己判断。`;
    reply = `${intro}${first?.reason ? `\n\n${first.reason}` : ""}\n\n你更在意屏幕和性能，还是每天带出门的重量？`;
    options = ["屏幕和性能优先", "轻一点、好带出门", "接口够用就行", "价格再压一点"];
  }

  const facts = products
    .filter((p) => cards.some((c) => c.id === p.id))
    .flatMap((p) => getFacts(p.id, { includePrice: false }).slice(0, 2).map((f) => ({ model: p.name, text: String(f.value).slice(0, 90), source: f.sourceTitle })));

  return {
    reply,
    options: options.slice(0, 4),
    facts,
    slots,
    cards,
    warning: "本地规则答复：只引用账本中的真实型号与事实；价格冲突时不报数字。",
  };
}
