// 确定性核验：不改稿、不替模型背书；数字必须落到同型号、同字段、同单位的事实。
import { getFacts, getPriceFacts, getConflict, getPriceResolution, isPriceFrozen } from "./ledger.mjs";
import { getSpec } from "../mcp/core.mjs";

const DAY = 24 * 60 * 60 * 1000;

function daysSince(dateLike) {
  const t = new Date(dateLike || 0).getTime();
  if (!Number.isFinite(t) || !t) return Infinity;
  return (Date.now() - t) / DAY;
}

function normalizePrice(raw) {
  return Number(String(raw || "").replace(/[,，\s]/g, ""));
}

function specClaims(facts) {
  return facts.map((f) => ({
    id: f.id,
    text: `${f.value || ""} ${f.conditions || ""} ${f.excerpt || ""}`,
    field: f.field,
    sourceTitle: f.sourceTitle,
  }));
}

function hasSpecFact(facts, value, unit) {
  const num = String(value);
  const u = String(unit).toLowerCase();
  const pattern = new RegExp(`${num.replace(/\./g, "\\.")}\\s*${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|\\s|，|。|、|$)`, "i");
  return facts.some((f) => pattern.test(f.text));
}

function hasResolutionFact(facts, width, height) {
  return facts.some((f) => {
    const text = f.text.replace(/[×xX]/g, "×").replace(/\s+/g, "");
    return text.includes(`${width}×${height}`);
  });
}

function platformBanned(text, platform) {
  if (!platform) return [];
  let spec;
  try {
    spec = getSpec(platform);
  } catch {
    return [];
  }
  const hits = [];
  for (const word of spec.banned || []) {
    if (!text.includes(word)) continue;
    const allowed = (spec.falsePositiveGuards || []).some(
      (g) => g.word === word && (g.allowSuffixes || []).some((suffix) => new RegExp(`${word}\\s*${suffix}`, "i").test(text)),
    );
    if (!allowed) hits.push({ term: word, reason: "平台规则卡禁用极限词/绝对化表达" });
  }
  return hits;
}

/**
 * @param {string} text
 * @param {string} productId
 * @param {{ platform?: string }} options
 */
export function verifyContent(text, productId, { platform, sku } = {}) {
  const t = String(text || "");
  const facts = specClaims(getFacts(productId, { includePrice: true }));
  const priceFacts = getPriceFacts(productId);
  const conflict = getConflict(productId);
  const claims = [];
  const reasons = [];

  for (const match of t.matchAll(/¥\s*([\d,]+)(?:\s*起)?/g)) {
    const value = normalizePrice(match[1]);
    const resolution = getPriceResolution(productId, sku, value);
    const blockedByConflict = Boolean(conflict && isPriceFrozen(productId, sku, value));
    const exact = priceFacts.find((f) => Number(f.value) === value);
    const stale = exact ? daysSince(exact.capturedAt) > 7 : false;
    const status = blockedByConflict ? "blocked" : resolution ? "supported" : exact ? (stale ? "stale" : "supported") : "blocked";
    claims.push({
      type: "price",
      text: match[0],
      value,
      unit: "CNY",
      status,
      span: { start: match.index || 0, end: (match.index || 0) + match[0].length },
      evidenceIds: resolution ? [resolution.id] : exact ? [exact.id] : [],
      reason: blockedByConflict
        ? "该型号价格存在未解决冲突，价格字段冻结"
        : exact
          ? stale
            ? "价格快照超过 7 天，需要重新确认"
            : "匹配到同型号官方价格事实"
          : "事实账本没有同型号、同 SKU 的这个价格",
    });
    if (status !== "supported") reasons.push(`价格 ${match[0]}：${claims[claims.length - 1].reason}`);
  }

  const unitRe = /(\d+(?:\.\d+)?)\s*(英寸|寸|GB|TB|kg|g|mm|Wh|Hz|nits|ppi|W)(?![A-Za-z])/gi;
  for (const match of t.matchAll(unitRe)) {
    const value = match[1];
    const unit = match[2];
    const supported = hasSpecFact(facts, value, unit);
    claims.push({
      type: "spec",
      text: match[0],
      value: Number(value),
      unit,
      status: supported ? "supported" : "blocked",
      span: { start: match.index || 0, end: (match.index || 0) + match[0].length },
      reason: supported ? "匹配到同型号、同单位事实" : "没有同型号、同单位事实",
    });
    if (!supported) reasons.push(`参数 ${match[0]} 没有同型号、同单位事实`);
  }

  for (const match of t.matchAll(/(\d{3,4})\s*[×xX]\s*(\d{3,4})/g)) {
    const supported = hasResolutionFact(facts, match[1], match[2]);
    claims.push({
      type: "resolution",
      text: match[0],
      value: `${match[1]}×${match[2]}`,
      unit: "px",
      status: supported ? "supported" : "blocked",
      span: { start: match.index || 0, end: (match.index || 0) + match[0].length },
      reason: supported ? "匹配到同型号屏幕分辨率事实" : "没有同型号屏幕分辨率事实",
    });
    if (!supported) reasons.push(`分辨率 ${match[0]} 没有同型号事实`);
  }

  const commercialRe = /(现货|库存|赠品|优惠|直降|到手价|活动价|补贴|当天发货|保修|延保)/g;
  for (const match of t.matchAll(commercialRe)) {
    const supported = facts.some((f) => f.text.includes(match[0]));
    claims.push({
      type: "commercial",
      text: match[0],
      value: match[0],
      status: supported ? "supported" : "blocked",
      span: { start: match.index || 0, end: (match.index || 0) + match[0].length },
      reason: supported ? "事实中包含该商业条件，发布前仍需核对门店实际" : "商业承诺没有事实依据",
    });
    if (!supported) reasons.push(`商业承诺“${match[0]}”没有事实依据`);
  }

  for (const item of platformBanned(t, platform)) {
    claims.push({ type: "banned", text: item.term, value: item.term, status: "blocked", reason: item.reason });
    reasons.push(`${item.term}：${item.reason}`);
  }

  const unsupported = claims.filter((c) => c.status !== "supported");
  return {
    status: unsupported.length ? "blocked" : "ready",
    blocked: unsupported.length > 0,
    claims,
    reasons: [...new Set(reasons)],
    checkedAt: new Date().toISOString(),
  };
}
