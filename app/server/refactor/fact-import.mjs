import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { commitFacts, getFacts, getProduct } from "./ledger.mjs";
import { dbEnabled, dbLoadState, dbSaveState } from "./db.mjs";

const SUPPORTED_FIELDS = new Set(["price", "screen", "processor", "memory", "storage", "weight", "thickness", "battery", "ports"]);
const proposed = [];
const digest = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
const runtimeFile = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "runtime", "fact-proposals.json");

let proposalsLoaded = false;
let proposalsSave = Promise.resolve();

function persist() {
  if (dbEnabled()) {
    proposalsSave = dbSaveState("fact-proposals", proposed).catch((error) => {
      console.error("[fact-import] 保存到 Supabase 失败：", error.message);
    });
    return;
  }
  try { mkdirSync(dirname(runtimeFile), { recursive: true }); writeFileSync(runtimeFile, JSON.stringify(proposed, null, 2)); } catch { /* read-only runtimes retain in-memory state */ }
}

export async function ensureProposals() {
  if (proposalsLoaded) return;
  if (dbEnabled()) {
    const saved = await dbLoadState("fact-proposals");
    if (Array.isArray(saved)) proposed.push(...saved);
    proposalsLoaded = true;
    return;
  }
  try {
    const saved = JSON.parse(readFileSync(runtimeFile, "utf8"));
    if (Array.isArray(saved)) proposed.push(...saved);
  } catch { /* first boot */ }
  proposalsLoaded = true;
}

export async function flushProposals() {
  await proposalsSave;
}

if (!dbEnabled()) {
  try {
    const saved = JSON.parse(readFileSync(runtimeFile, "utf8"));
    if (Array.isArray(saved)) proposed.push(...saved);
    proposalsLoaded = true;
  } catch { /* first boot */ }
}

export function createProposedFacts({ productId, model, sku, field, value, unit, source }) {
  const product = getProduct(productId);
  if (!product || product.name !== model) throw new Error("型号与事实账本不一致");
  if (!SUPPORTED_FIELDS.has(field)) throw new Error("不支持的事实字段");
  if (!source?.id || !source?.url || !source?.capturedAt || !source?.excerpt || !source?.trustTier) throw new Error("候选事实缺少来源证据");
  const current = getFacts(productId, { includePrice: true });
  const conflict = current.some((fact) => fact.field === field && String(fact.unit || "") === String(unit || "") && String(fact.value) !== String(value));
  const item = { id: `proposed:${digest(`${source.id}:${productId}:${field}:${value}:${sku || ""}`)}`, productId, model, sku: sku || undefined, field, value, unit: unit || "", sourceId: source.id, sourceUrl: source.url, sourceTitle: source.title || "华为官方页面", sourceContentHash: source.contentHash || digest(source.excerpt), capturedAt: source.capturedAt, excerpt: source.excerpt, trustTier: source.trustTier, status: "proposed", conflict, committed: false };
  proposed.push(item);
  persist();
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
  const committed = commitFacts(selected);
  for (const item of proposed) {
    if (ids.includes(item.id)) Object.assign(item, { committed: true, committedAt: committed.find((fact) => fact.id === item.id)?.committedAt });
  }
  persist();
  return committed;
}
