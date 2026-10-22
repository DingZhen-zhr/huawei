import { createHash } from "node:crypto";
import { getFacts, getProduct } from "./ledger.mjs";

const SUPPORTED_FIELDS = new Set(["price", "screen", "processor", "memory", "storage", "weight", "thickness", "battery", "ports"]);
const proposed = [];
const digest = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 16);

export function createProposedFacts({ productId, model, sku, field, value, unit, source }) {
  const product = getProduct(productId);
  if (!product || product.name !== model) throw new Error("型号与事实账本不一致");
  if (!SUPPORTED_FIELDS.has(field)) throw new Error("不支持的事实字段");
  if (!source?.id || !source?.url || !source?.capturedAt || !source?.excerpt || !source?.trustTier) throw new Error("候选事实缺少来源证据");
  const current = getFacts(productId, { includePrice: true });
  const conflict = current.some((fact) => fact.field === field && String(fact.unit || "") === String(unit || "") && String(fact.value) !== String(value));
  const item = { id: `proposed:${digest(`${source.id}:${productId}:${field}:${value}:${sku || ""}`)}`, productId, model, sku: sku || undefined, field, value, unit: unit || "", sourceId: source.id, sourceUrl: source.url, sourceTitle: source.title || "华为官方页面", sourceContentHash: source.contentHash || digest(source.excerpt), capturedAt: source.capturedAt, excerpt: source.excerpt, trustTier: source.trustTier, status: "proposed", conflict, committed: false };
  proposed.push(item);
  return [item];
}

export function listProposedFacts() { return proposed.map((item) => ({ ...item })); }

export function listSources() {
  return [...new Map(proposed.map((item) => [item.sourceId, {
    id: item.sourceId, url: item.sourceUrl, title: item.sourceTitle, contentHash: item.sourceContentHash, capturedAt: item.capturedAt, excerpt: item.excerpt, trustTier: item.trustTier,
  }])).values()];
}

export function commitProposedFacts(ids = []) {
  const selected = proposed.filter((item) => ids.includes(item.id));
  if (selected.some((item) => item.conflict)) throw new Error("存在冲突的候选事实不能自动入账");
  return selected.map((item) => ({ ...item, committed: true }));
}
