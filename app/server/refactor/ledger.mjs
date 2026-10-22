// 事实账本：从 v7 知识库快照生成可追溯的产品事实，价格冲突显式冻结。
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKB } from "../agent/kb-index.mjs";
import { dbEnabled, dbLoadState, dbSaveState } from "./db.mjs";

const hash = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 12);

const PRODUCT_DEFS = [
  {
    id: "matebook-14-harmony",
    name: "HUAWEI MateBook 14（鸿蒙版）",
    shortName: "MateBook 14 鸿蒙版",
    modelKey: "HUAWEI MateBook 14",
    family: "鸿蒙电脑",
    asset: "/media/matebook-14-harmony.png",
    assetFit: "contain",
    priceConflict: true,
    conflictPrices: [5899, 6599],
  },
  {
    id: "matebook-gt-14",
    name: "HUAWEI MateBook GT 14",
    shortName: "MateBook GT 14",
    modelKey: "MateBook GT 系列",
    family: "Windows 创作本",
    asset: "/media/matebook-gt-14.png",
    assetFit: "contain",
    priceConflict: false,
  },
  {
    id: "matebook-pro-s",
    name: "HUAWEI MateBook Pro S",
    shortName: "MateBook Pro S",
    modelKey: "HUAWEI MateBook Pro S",
    family: "鸿蒙电脑",
    asset: "/media/matebook-pro-s.jpg",
    assetFit: "cover",
    priceConflict: false,
  },
  {
    id: "matebook-14-ultra",
    name: "HUAWEI MateBook 14 酷睿 Ultra",
    shortName: "MateBook 14 酷睿 Ultra",
    modelKey: "MateBook 14 酷睿 Ultra",
    family: "Windows 轻薄本",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-d-14",
    name: "HUAWEI MateBook D 14 2024",
    shortName: "MateBook D 14 2024",
    modelKey: "MateBook D 14",
    family: "Windows 入门本",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-d-16",
    name: "HUAWEI MateBook D 16 2024",
    shortName: "MateBook D 16 2024",
    modelKey: "MateBook D 16",
    family: "Windows 大屏本",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-d-16-se",
    name: "HUAWEI MateBook D 16 SE 版 2024",
    shortName: "MateBook D 16 SE",
    modelKey: "MateBook D 16 SE 版",
    family: "Windows 大屏本",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-fold",
    name: "HUAWEI MateBook Fold 非凡大师",
    shortName: "MateBook Fold",
    modelKey: "HUAWEI MateBook Fold 非凡大师",
    family: "鸿蒙折叠电脑",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-pro-harmony",
    name: "HUAWEI MateBook Pro（鸿蒙版）",
    shortName: "MateBook Pro 鸿蒙版",
    modelKey: "HUAWEI MateBook Pro",
    family: "鸿蒙电脑",
    asset: null,
    priceConflict: false,
  },
  {
    id: "matebook-x-pro",
    name: "HUAWEI MateBook X Pro 酷睿 Ultra 微绒典藏版",
    shortName: "MateBook X Pro 微绒典藏版",
    modelKey: "MateBook X系列",
    family: "Windows 旗舰轻薄本",
    asset: null,
    priceConflict: false,
  },
];

const kb = loadKB();
const modelMap = new Map((kb.models ? [...kb.models.values()] : []).map((value) => [value.name, value]));
const productRows = kb.products || [];
const priceRows = kb.records || [];

function sourceIdFor(file) {
  return `src:${hash(file)}`;
}

function productPriceRecords(name) {
  return priceRows.filter((r) => r.productName === name);
}

function buildPriceFacts(def, records) {
  return records.map((record, index) => ({
    id: `fact:${def.id}:price:${index + 1}`,
    productId: def.id,
    model: def.name,
    sku: record.sku || undefined,
    field: "price",
    value: Number(record.price),
    unit: "CNY",
    conditions: record.condition || "",
    sourceId: sourceIdFor(record.file || `${def.name}-price`),
    sourceUrl: record.url || "",
    sourceTitle: record.file || "官方公开价格快照",
    capturedAt: record.snapshotDate || productRows.find((p) => p.productName === def.name)?.snapshotDate || "2026-10-17",
    status: def.priceConflict ? "conflict" : "active",
    trustTier: 1,
    excerpt: [record.sku, record.priceType, `¥${record.price}`].filter(Boolean).join(" · "),
    priceType: record.priceType || "",
  }));
}

function buildModelFacts(def, model) {
  if (!model?.cards) return [];
  const out = [];
  for (const [kind, card] of Object.entries(model.cards)) {
    for (const [index, text] of (card.facts || []).entries()) {
      out.push({
        id: `fact:${def.id}:${kind}:${index + 1}`,
        productId: def.id,
        model: def.name,
        field: kind,
        value: text,
        unit: "",
        conditions: "",
        sourceId: sourceIdFor(card.file),
        sourceUrl: "",
        sourceTitle: card.file,
        capturedAt: "2026-10-17",
        status: "active",
        trustTier: 3,
        excerpt: text,
      });
    }
  }
  return out;
}

function buildConflict(def, records) {
  if (!def.priceConflict) return null;
  const allPrices = [...new Set(records.map((r) => Number(r.price)))].sort((a, b) => a - b);
  const candidates = def.conflictPrices?.length ? def.conflictPrices : allPrices;
  return {
    id: `conflict:${def.id}:price`,
    productId: def.id,
    field: "price",
    status: "open",
    reason: "知识库内部商城快照与官网参考起价不一致，按规格冻结该产品价格字段。",
    candidates: candidates.map((price) => ({
      value: price,
      unit: "CNY",
      evidence: records
        .filter((r) => Number(r.price) === price)
        .slice(0, 2)
        .map((r) => ({ sku: r.sku, priceType: r.priceType, url: r.url, capturedAt: r.snapshotDate })),
    })),
    resolution: null,
    createdAt: "2026-10-17T00:00:00.000Z",
  };
}

const products = PRODUCT_DEFS.map((def) => {
  const model = modelMap.get(def.modelKey);
  const records = productPriceRecords(def.name);
  const summary = productRows.find((p) => p.productName === def.name);
  const facts = [...buildModelFacts(def, model), ...buildPriceFacts(def, records)];
  const conflict = buildConflict(def, records);
  // 只有「官方商城页面价」才算当前售价；只有「官网参考起价」的型号（例如已下架）
  // 一律标 reference，不写进内容，避免把历史参考价当成当前售价。
  const hasMallPrice = records.some((record) => /商城|页面价|专区/.test(String(record.priceType || "")));
  const priceStatus = def.priceConflict ? "conflict" : records.length ? (hasMallPrice ? "active" : "reference") : "missing";
  const minPrice = records.length ? Math.min(...records.map((r) => Number(r.price))) : null;
  const priceLabel =
    priceStatus === "conflict"
      ? "价格待确认 · 未写入内容"
      : priceStatus === "reference"
        ? `参考起价 ¥${minPrice.toLocaleString("zh-CN")}（非当前售价）`
        : priceStatus === "active"
          ? `官方商城价 ¥${minPrice.toLocaleString("zh-CN")} 起`
          : "暂无官方价格事实";
  return {
    ...def,
    hasAssets: Boolean(def.asset),
    snapshotDate: summary?.snapshotDate || "2026-10-17",
    sourceStatus: summary?.status || "知识库快照",
    price: records.length
      ? {
          min: minPrice,
          max: Math.max(...records.map((r) => Number(r.price))),
          status: priceStatus,
          label: priceLabel,
          records: records.map((r) => ({
            sku: r.sku,
            price: Number(r.price),
            priceType: r.priceType,
            url: r.url,
            capturedAt: r.snapshotDate,
          })),
        }
      : { min: null, max: null, status: "missing", label: "暂无官方价格事实", records: [] },
    facts,
    conflict,
  };
});

const byId = new Map(products.map((p) => [p.id, p]));
const byName = new Map(products.map((p) => [p.name, p]));
const resolutions = new Map();
const importedFacts = new Map();
const runtimeFile = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "runtime", "fact-search.json");

let runtimeLoaded = false;
let runtimeSave = Promise.resolve();

function runtimePayload() {
  return { resolutions: [...resolutions.entries()], importedFacts: [...importedFacts.entries()] };
}

function persistRuntime() {
  if (dbEnabled()) {
    runtimeSave = dbSaveState("ledger", runtimePayload()).catch((error) => {
      console.error("[ledger] 保存到 Supabase 失败：", error.message);
    });
    return runtimeSave;
  }
  saveRuntime();
  return Promise.resolve();
}

export async function ensureFactRuntime() {
  if (runtimeLoaded) return;
  if (dbEnabled()) {
    const saved = await dbLoadState("ledger");
    for (const [id, records] of saved?.resolutions || []) resolutions.set(id, records);
    for (const [id, records] of saved?.importedFacts || []) importedFacts.set(id, records);
    runtimeLoaded = true;
    return;
  }
  loadRuntime();
  runtimeLoaded = true;
}

export async function flushFactRuntime() {
  await runtimeSave;
}

function saveRuntime() {
  if (dbEnabled()) return;
  try {
    mkdirSync(dirname(runtimeFile), { recursive: true });
    writeFileSync(runtimeFile, JSON.stringify({ resolutions: [...resolutions.entries()], importedFacts: [...importedFacts.entries()] }, null, 2));
  } catch {
    // Read-only/serverless runtimes retain the in-memory safety state for this request.
  }
}

function loadRuntime() {
  if (dbEnabled()) return;
  try {
    const saved = JSON.parse(readFileSync(runtimeFile, "utf8"));
    for (const [id, records] of saved.resolutions || []) resolutions.set(id, records);
    for (const [id, records] of saved.importedFacts || []) importedFacts.set(id, records);
  } catch {
    // No local runtime state is normal on first boot.
  }
}

function productForConflict(id) {
  return products.find((product) => product.conflict?.id === id) || null;
}

function requiredResolution(input) {
  for (const field of ["sku", "region", "effectiveFrom", "sourceId", "conclusion"]) {
    if (!String(input?.[field] || "").trim()) throw new Error(`管理员确认缺少 ${field === "sku" ? "SKU" : field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.effectiveFrom))) throw new Error("生效日期必须是 YYYY-MM-DD");
}

export function resolveConflict(conflictId, input) {
  const product = productForConflict(conflictId);
  if (!product) throw new Error("价格冲突不存在");
  requiredResolution(input);
  const record = {
    id: `audit:${conflictId}:${Date.now()}`,
    sku: String(input.sku).trim(),
    region: String(input.region).trim(),
    effectiveFrom: String(input.effectiveFrom),
    sourceId: String(input.sourceId).trim(),
    conclusion: String(input.conclusion).trim(),
    value: Number.isFinite(Number(input.value)) ? Number(input.value) : undefined,
    confirmedAt: new Date().toISOString(),
  };
  const existing = resolutions.get(conflictId) || [];
  resolutions.set(conflictId, [...existing.filter((item) => item.sku !== record.sku), record]);
  void persistRuntime();
  return getConflict(product.id);
}

export function resetFactSearchRuntime() {
  resolutions.clear();
  importedFacts.clear();
  void persistRuntime();
}

export function commitFacts(candidates) {
  const committed = [];
  for (const candidate of candidates) {
    const product = getProduct(candidate.productId);
    if (!product) throw new Error("候选事实对应的产品不存在");
    const facts = importedFacts.get(product.id) || [];
    const fact = { ...candidate, status: "active", committed: true, committedAt: new Date().toISOString() };
    importedFacts.set(product.id, [...facts.filter((item) => item.id !== fact.id), fact]);
    committed.push(fact);
  }
  void persistRuntime();
  return committed;
}

export function getPriceResolution(productId, sku, value) {
  const conflict = getProduct(productId)?.conflict;
  if (!conflict) return null;
  return (resolutions.get(conflict.id) || []).find((item) => item.sku === sku && (item.value === undefined || item.value === Number(value))) || null;
}

export function isPriceFrozen(productId, sku, value) {
  const conflict = getProduct(productId)?.conflict;
  return Boolean(conflict && !getPriceResolution(productId, sku, value));
}

export function listProducts() {
  return products.map(publicProduct);
}

export function getProduct(idOrName) {
  return byId.get(idOrName) || byName.get(idOrName) || null;
}

export function publicProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    family: p.family,
    asset: p.asset,
    assetFit: p.assetFit || "cover",
    hasAssets: p.hasAssets,
    snapshotDate: p.snapshotDate,
    sourceStatus: p.sourceStatus,
    price: {
      min: p.price.min,
      max: p.price.max,
      status: p.price.status,
      label: p.price.label,
    },
    factCount: p.facts.filter((f) => f.field !== "price").length,
    factStatus: p.conflict ? "conflict" : "active",
  };
}

export function getFacts(productId, { includePrice = false } = {}) {
  const product = getProduct(productId);
  if (!product) return [];
  return [...product.facts, ...(importedFacts.get(product.id) || [])].filter((f) => includePrice || f.field !== "price");
}

export function getPriceFacts(productId) {
  return getFacts(productId, { includePrice: true }).filter((f) => f.field === "price");
}

export function getConflict(productId) {
  const product = getProduct(productId);
  if (!product?.conflict) return null;
  const audit = resolutions.get(product.conflict.id) || [];
  return {
    ...product.conflict,
    status: audit.length ? "partially_resolved" : "open",
    resolution: audit.length ? audit[audit.length - 1] : null,
    audit,
  };
}

export function getEvidence(productId, ids = []) {
  const product = getProduct(productId);
  if (!product) return [];
  const wanted = new Set(ids);
  return getFacts(product.id, { includePrice: true }).filter((f) => !ids.length || wanted.has(f.id));
}

export function evidenceForVariant(productId, { fields = [], limit = 8, includePrice = false } = {}) {
  const product = getProduct(productId);
  if (!product) return [];
  const wantedFields = new Set(fields);
  const selected = getFacts(product.id, { includePrice: true }).filter((f) => {
    if (!includePrice && f.field === "price") return false;
    return !wantedFields.size || wantedFields.has(f.field);
  });
  return selected.slice(0, limit).map((f) => ({
    ...f,
    source: f.sourceTitle,
  }));
}

export function productContext(productId) {
  const p = getProduct(productId);
  if (!p) return null;
  const facts = getFacts(p.id).filter((f) => f.field !== "price");
  return {
    product: publicProduct(p),
    facts: facts.slice(0, 12),
    conflict: p.conflict,
    hasAssets: p.hasAssets,
  };
}

export function productsForTaskCards() {
  return products.filter((p) => p.hasAssets).map(publicProduct);
}

loadRuntime();
