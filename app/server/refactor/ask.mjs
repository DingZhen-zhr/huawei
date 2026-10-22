// Recommendations use the complete ledger, including models without images.
import { getFacts, getProduct, listProducts } from "./ledger.mjs";
import { extractSlots } from "./ask-slots.mjs";

export function budgetAssessment(product, budget, now = new Date()) {
  const price = product.price;
  const facts = (product.facts || []).filter((fact) => fact.field === "price" && fact.status === "active" && Number(fact.value) === price?.min);
  const usable = facts.some((fact) => {
    const captured = Date.parse(fact.capturedAt);
    const age = now.getTime() - captured;
    return fact.productId === product.id && Boolean(fact.sku) && Number.isFinite(captured) && age >= 0 && age <= 7 * 86400000;
  });
  if (!budget || price?.status !== "active" || !Number.isFinite(price.min) || !usable) return { budgetFit: "unknown", overBy: null };
  return { budgetFit: price.min > budget ? "over" : "within", overBy: Math.max(0, price.min - budget) };
}

function matchesConstraints(product, slots) {
  const facts = getFacts(product.id).map((fact) => String(fact.value));
  if (slots.os === "Windows" && !facts.some((text) => /系统/.test(text) && /Windows/i.test(text) && !/不支持\s*Windows|仅(?:有|支持)?\s*(?:鸿蒙|HarmonyOS)/i.test(text))) return false;
  if (slots.screenMin !== null || slots.screenMax !== null) {
    const sizes = facts.filter((text) => /屏幕|屏|展开态|折叠态/.test(text)).flatMap((text) => [...text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*英寸/g)].map((match) => Number(match[1])));
    if (!sizes.length || sizes.some((size) => (slots.screenMin !== null && size < slots.screenMin) || (slots.screenMax !== null && size > slots.screenMax))) return false;
  }
  return true;
}

function score(product, scenarioKey) {
  const preferred = {
    edit: ["matebook-gt-14", "matebook-14-ultra", "matebook-x-pro"],
    study: ["matebook-d-14", "matebook-14-harmony", "matebook-d-16-se"],
    office: ["matebook-pro-s", "matebook-d-14", "matebook-d-16", "matebook-d-16-se"],
    dev: ["matebook-gt-14", "matebook-14-ultra", "matebook-d-14"],
    game: ["matebook-gt-14", "matebook-14-ultra"],
  }[scenarioKey] || [];
  const index = preferred.indexOf(product.id);
  return index < 0 ? 10 : 50 - index * 5;
}

export function localAsk({ messages = [], now = new Date() } = {}) {
  if (!Array.isArray(messages) || !messages.length) throw new Error("messages 不能为空");
  const slots = extractSlots(messages);
  const { budget, scenario, scenarioKey } = slots;
  let reply, options;
  let cards = [];
  if (!budget && !scenario) {
    reply = "先确认两件事：这台电脑主要用来做什么，预算大概在哪一档？";
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "预算 6000 左右"];
  } else if (!budget) {
    reply = `用途清楚了：${scenario}。预算大概在哪一档？我再把机型收敛到两三台。`;
    options = ["预算 4000–5000", "预算 5000–6000", "预算 6000–8000", "预算 8000 以上"];
  } else if (!scenario) {
    reply = `预算 ${budget.toLocaleString("zh-CN")} 元，先看主要用途。买来最常做的是哪件事？`;
    options = ["剪视频/做设计", "上网课/学习", "办公/通勤", "游戏/高性能"];
  } else {
    const candidates = listProducts().map((product) => getProduct(product.id)).filter((product) => matchesConstraints(product, slots))
      .map((product) => ({ product, ...budgetAssessment(product, budget, now) }))
      .sort((a, b) => score(b.product, scenarioKey) - score(a.product, scenarioKey) || a.product.price.min - b.product.price.min);
    const within = candidates.filter((item) => item.budgetFit === "within");
    const over = candidates.filter((item) => item.budgetFit === "over").sort((a, b) => a.overBy - b.overBy);
    const unknown = candidates.filter((item) => item.budgetFit === "unknown");
    const picked = (within.length ? within : over.length ? over : unknown).slice(0, 2);
    cards = picked.map(({ product, budgetFit, overBy }) => {
      const facts = getFacts(product.id);
      const reason = facts.find((fact) => fact.field === "audience") || facts[0];
      const limitation = facts.find((fact) => /确认|限制|兼容|仅|没有/.test(String(fact.value)))?.value || "具体配置需按 SKU 确认";
      return {
        id: product.id, model: product.name, shortName: product.shortName,
        priceLabel: budgetFit === "unknown" ? "价格待确认 · 预算适配未知" : product.price.label,
        priceStatus: product.price.status, budgetFit, overBy,
        reason: String(reason?.value || "已收录同型号官方事实").slice(0, 82),
        limitation: `${slots.os === "Windows" ? "请选择Windows配置；" : ""}${limitation}`,
      };
    });
    const budgetLine = cards.map((card) => `${card.shortName}（${card.priceLabel}${card.budgetFit === "over" ? `，超预算约 ¥${card.overBy.toLocaleString("zh-CN")}` : ""}）`).join("；");
    const intro = within.length ? `预算 ${budget.toLocaleString("zh-CN")} 元、${scenario}，先看预算内的${budgetLine}。` : over.length ? `预算内没有符合要求的型号，以下为明确超预算的备选：${budgetLine}。` : cards.length ? `以下型号价格待确认，预算适配未知：${budgetLine}。` : "没有找到满足系统和尺寸限制的型号，需要重新确认要求。";
    reply = `${intro}${cards[0]?.reason ? `\n\n${cards[0].reason}` : ""}\n\n你更在意屏幕和性能，还是每天带出门的重量？`;
    options = ["屏幕和性能优先", "轻一点、好带出门", "接口够用就行", "价格再压一点"];
  }
  const facts = cards.flatMap((card) => getFacts(card.id).slice(0, 2).map((fact) => ({ model: card.model, text: String(fact.value).slice(0, 90), source: fact.sourceTitle })));
  return { reply, options, facts, slots, cards, warning: "本地规则答复：只引用账本中的真实型号与事实；价格冲突时不报数字。" };
}
