// 确定性核验：不改稿、不替模型背书；数字必须落到同型号、同字段、同单位的事实。
import { getProduct, getFacts, getPriceFacts, getConflict, getPriceResolution } from "./ledger.mjs";
import { getSpec } from "../mcp/core.mjs";

const DAY = 24 * 60 * 60 * 1000;
const UNIT_RE = /(?<![\dA-Za-z.])(\d+(?:\.\d+)?)\s*(英寸|寸|GB|TB|kg|g|mm|Wh|Hz|nits|ppi|W)/gi;
const RANGE_UNIT_RE = /(\d+(?:\.\d+)?)\s*[-–—~至]\s*(\d+(?:\.\d+)?)\s*(英寸|寸|GB|TB|kg|g|mm|Wh|Hz|nits|ppi|W)/gi;
const RESOLUTION_RE = /(?<![\d.])(\d{3,4})\s*[×xX]\s*(\d{3,4})(?![\d.])/g;
const PRICE_PREFIX_RE = /[¥￥]\s*(\d[\d,，]*)(?:\s*起)?/g;
const PRICE_SUFFIX_RE = /(\d[\d,，]*)\s*(?:元|块)(?:\s*起)?/g;
const PRICE_CODE_RE = /(?:RMB|CNY)\s*(\d[\d,，]*)(?:\s*起)?/gi;
const COMMERCIAL_RE = /(现货|库存|赠品|优惠|直降|到手价|活动价|补贴|当天发货|保修|延保)/g;

function daysSince(dateLike, now = Date.now()) {
  const t = new Date(dateLike || 0).getTime();
  if (!Number.isFinite(t) || !t) return Infinity;
  return (new Date(now).getTime() - t) / DAY;
}

function normalizePrice(raw) {
  return Number(String(raw || "").replace(/[,，\s]/g, ""));
}

function normalizeKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function specClaims(facts) {
  return facts.map((f) => ({
    id: f.id,
    text: `${f.value || ""} ${f.conditions || ""} ${f.excerpt || ""}`,
    field: f.field,
    sourceTitle: f.sourceTitle,
  }));
}

function measureMatches(text) {
  const out = [];
  for (const match of String(text || "").matchAll(UNIT_RE)) {
    out.push({ value: Number(match[1]), unit: match[2].toLowerCase(), text: match[0] });
  }
  for (const match of String(text || "").matchAll(RANGE_UNIT_RE)) {
    out.push({ value: Number(match[1]), unit: match[3].toLowerCase(), text: match[0] });
    out.push({ value: Number(match[2]), unit: match[3].toLowerCase(), text: match[0] });
  }
  return out;
}

function hasSpecFact(facts, value, unit) {
  const wantedValue = Number(value);
  const wantedUnit = String(unit).toLowerCase();
  return facts.some((fact) => measureMatches(fact.text).some((item) => item.value === wantedValue && item.unit === wantedUnit));
}

function hasResolutionFact(facts, width, height) {
  return facts.some((fact) => {
    for (const match of String(fact.text || "").matchAll(RESOLUTION_RE)) {
      if (match[1] === String(width) && match[2] === String(height)) return true;
    }
    return false;
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

function priceMatches(text) {
  const found = [];
  const overlaps = (start, end) => found.some((item) => start < item.end && end > item.start);
  const add = (match, start, kind) => {
    const end = start + match[0].length;
    if (overlaps(start, end)) return;
    if (kind === "suffix") {
      const before = text.slice(Math.max(0, start - 10), start);
      if (/(预算|最多|不超过|以内|左右)/.test(before)) return;
    }
    found.push({ value: normalizePrice(match[1]), text: match[0], start, end });
  };
  for (const match of text.matchAll(PRICE_PREFIX_RE)) add(match, match.index || 0, "prefix");
  for (const match of text.matchAll(PRICE_SUFFIX_RE)) add(match, match.index || 0, "suffix");
  for (const match of text.matchAll(PRICE_CODE_RE)) add(match, match.index || 0, "code");
  return found.sort((a, b) => a.start - b.start);
}

function commercialItem(segment, term) {
  const after = segment.slice(segment.indexOf(term) + term.length).replace(/^[为是送:：\s]+/, "");
  return after.split(/[，,。；;\n]/)[0].trim();
}

function commercialSupported(segment, term, facts) {
  const factText = facts.map((item) => normalizeKey(item.text)).join("\n");
  const item = commercialItem(segment, term);
  const hasQualifier = /以(?:门店|结算页|实际|官方)[^。；;\n]{0,24}为准|具体[^。；;\n]{0,16}为准/.test(segment);
  const withoutQualifier = segment.replace(/[，,]?以[^。；;\n]{0,30}为准/g, "").replace(/[，,]?具体[^。；;\n]{0,20}为准/g, "").trim();
  const specificItem = item && !/^(以|具体|门店|实际|官方|结算页|活动|优惠|现货|库存|当天|保修|延保|服务)/.test(item);

  if (specificItem && item.length >= 2) return factText.includes(normalizeKey(item));
  if (hasQualifier) return factText.includes(normalizeKey(term));
  // 泛化承诺没有落到具体事实时也拦下；宁可不发，不把“可能有”写成确定权益。
  return withoutQualifier.length <= term.length + 1 && factText.includes(normalizeKey(term));
}

/**
 * @param {string} text
 * @param {string} productId
 * @param {{ platform?: string, sku?: string, now?: string|number|Date }} options
 */
export function verifyContent(text, productId, { platform, sku, now } = {}) {
  const t = String(text || "");
  const product = getProduct(productId);
  const facts = specClaims(getFacts(productId, { includePrice: true }));
  const priceFacts = getPriceFacts(productId);
  const priceWritable = product?.price.status === "active";
  const conflict = getConflict(productId);
  const priceStateReason = conflict
    ? "该型号价格存在未解决冲突，价格字段冻结"
    : product?.price.status === "reference"
      ? "该型号只有官网参考起价，不是当前售价"
      : "该型号暂无当前售价";
  const claims = [];
  const reasons = [];

  for (const match of priceMatches(t)) {
    const value = match.value;
    const resolution = getPriceResolution(productId, sku, value);
    const blockedByPriceState = !priceWritable && !resolution;
    const exact = priceFacts
      .filter((f) => Number(f.value) === value && (!sku || f.sku === sku || (!f.sku && sku === "")))
      .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0))[0];
    const stale = exact ? daysSince(exact.capturedAt, now) > 7 : false;
    const status = blockedByPriceState ? "blocked" : resolution ? "supported" : exact ? (stale ? "stale" : "supported") : "blocked";
    claims.push({
      type: "price",
      text: match.text,
      value,
      unit: "CNY",
      status,
      span: { start: match.start, end: match.end },
      evidenceIds: resolution ? [resolution.id] : exact ? [exact.id] : [],
      reason: blockedByPriceState
        ? priceStateReason
        : exact
          ? stale
            ? "价格快照超过 7 天，需要重新确认"
            : "匹配到同型号官方价格事实"
          : "事实账本没有同型号、同 SKU 的这个价格",
    });
    if (status !== "supported") reasons.push(`价格 ${match.text}：${claims[claims.length - 1].reason}`);
  }

  for (const match of t.matchAll(UNIT_RE)) {
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

  for (const match of t.matchAll(RESOLUTION_RE)) {
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

  for (const match of t.matchAll(COMMERCIAL_RE)) {
    const start = match.index || 0;
    const end = start + match[0].length;
    const sentenceStart = Math.max(t.lastIndexOf("。", start - 1), t.lastIndexOf("\n", start - 1)) + 1;
    const sentenceEndCandidates = [t.indexOf("。", end), t.indexOf("；", end), t.indexOf("\n", end)].filter((i) => i >= 0);
    const sentenceEnd = sentenceEndCandidates.length ? Math.min(...sentenceEndCandidates) : Math.min(t.length, end + 80);
    const segment = t.slice(sentenceStart, sentenceEnd).trim();
    const supported = commercialSupported(segment, match[0], facts);
    claims.push({
      type: "commercial",
      text: match[0],
      value: match[0],
      status: supported ? "supported" : "blocked",
      span: { start, end },
      reason: supported ? "事实中包含该商业条件，发布前仍需核对门店实际" : "商业承诺没有可核对的同型号事实",
    });
    if (!supported) reasons.push(`商业承诺“${match[0]}”没有可核对的同型号事实`);
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
