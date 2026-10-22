// 知识库索引：把 v7 知识库的「型号检索卡」与「官方价格拍卡」解析成结构化事实
// 目标：所有答案都能给出文件路径 + 快照日期，杜绝无依据生成
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import KB_FACTS from "../fixtures/kb-facts.mjs";
import path from "node:path";

export const KB_ROOT =
  process.env.KB_ROOT || path.resolve(process.cwd(), "..", "华为PC全板块深度知识库_v7");
const CARD_DIR = path.join(KB_ROOT, "P1-产品参数库", "06-型号检索卡");
const PRICE_DIR = path.join(KB_ROOT, "P1-产品参数库", "08-官方公开价格快照");
const PC_PRICE_SCOPES = ["01-消费级PC", "02-商用电脑"];

const CARD_KINDS = {
  "01": "identity",
  "02": "screen",
  "03": "performance",
  "04": "portable",
  "05": "ecosystem",
  "06": "audience",
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (!m) return fm;
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

/** 按 `## 标题` 切分小节 */
function sections(text) {
  const map = {};
  const parts = text.split(/\n##\s+/);
  for (const part of parts.slice(1)) {
    const [head, ...rest] = part.split("\n");
    map[head.trim()] = rest.join("\n").trim();
  }
  return map;
}

const bullets = (s) =>
  (s || "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l && !l.startsWith("|") && !l.startsWith(">"));

function rel(p) {
  return path.relative(KB_ROOT, p);
}

/** 解析价格卡：表格行 → SKU 记录 */
function parsePriceCard(file) {
  const text = readFileSync(file, "utf-8");
  const fm = frontMatter(text);
  const productName = fm.product_name || path.basename(file).replace(/-价格卡\.md$/, "");
  const sec = sections(text)["官方价格与销售状态记录"];
  const rows = [];
  if (!sec) return { productName, snapshotDate: fm.snapshot_date || "", records: rows, file: rel(file), status: fm.price_status || "" };

  for (const line of sec.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 8) continue;
    if (cells[0] === "核验时间") continue;
    const priceMatch = cells[3].match(/¥\s*([\d,]+)/);
    if (!priceMatch) continue;
    const urlMatch = cells[7].match(/\((https?:\/\/[^)]+)\)/);
    rows.push({
      productName,
      sku: cells[1],
      priceType: cells[2],
      price: Number(priceMatch[1].replace(/,/g, "")),
      listPrice: (cells[4].match(/¥\s*([\d,]+)/) || [])[1]?.replace(/,/g, "") || null,
      stock: cells[5],
      condition: cells[6],
      url: urlMatch ? urlMatch[1] : "",
      verifiedAt: cells[0],
      snapshotDate: fm.snapshot_date || "",
      file: rel(file),
    });
  }
  return { productName, snapshotDate: fm.snapshot_date || "", records: rows, file: rel(file), status: fm.price_status || "" };
}

function parseModelCard(file) {
  const text = readFileSync(file, "utf-8");
  const sec = sections(text);
  return {
    conclusion: (sec["检索结论"] || "").trim(),
    facts: bullets(sec["已确认事实"]),
    limits: bullets(sec["限定条件"]),
    fitFor: bullets(sec["适用任务"]),
    notFor: bullets(sec["不适用或需先验证的任务"]),
    file: rel(file),
  };
}

const keyExact = (s) => String(s || "").toLowerCase().replace(/huawei/g, "").replace(/\s+/g, "").trim();
// 宽松键：去括号版本、去年份，用于跨目录匹配（如 "D 16 2024" ↔ "D 16"）
const keyLoose = (s) =>
  keyExact(s)
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/20\d{2}(款|版)?/g, "")
    .trim();

let cache = null;

export function loadKB() {
  if (cache) return cache;

  // 部署环境没有本地知识库目录时，读取导出的快照
  if (!existsSync(CARD_DIR) || !existsSync(PRICE_DIR)) {
    const j = KB_FACTS;
    cache = {
      root: KB_ROOT,
      products: j.products,
      records: j.records,
      models: new Map(j.models.map((m) => [m.key, { name: m.name, dir: m.dir, cards: m.cards }])),
      generatedAt: j.generatedAt,
      source: "fixture",
    };
    return cache;
  }

  // 价格记录：只取 PC 两个品类
  const priceFiles = PC_PRICE_SCOPES.flatMap((scope) =>
    walk(path.join(PRICE_DIR, scope)).filter((f) => f.endsWith("价格卡.md")),
  );
  const priceCards = priceFiles.map(parsePriceCard);

  const records = priceCards.flatMap((c) => c.records);
  const products = priceCards
    .map((c) => {
      const prices = c.records.map((r) => r.price);
      return {
        productName: c.productName,
        status: c.status,
        snapshotDate: c.snapshotDate,
        file: c.file,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        skuCount: c.records.length,
      };
    })
    .filter((p) => p.minPrice != null);

  // 型号检索卡
  const models = new Map();
  if (existsSync(CARD_DIR)) {
    for (const dir of readdirSync(CARD_DIR)) {
      const full = path.join(CARD_DIR, dir);
      if (!statSync(full).isDirectory()) continue;
      const cards = {};
      for (const f of readdirSync(full)) {
        const m = f.match(/^(0\d)-/);
        if (!m || !CARD_KINDS[m[1]]) continue;
        cards[CARD_KINDS[m[1]]] = parseModelCard(path.join(full, f));
      }
      if (Object.keys(cards).length) {
        models.set(keyLoose(dir), { name: dir, dir: rel(full), cards });
      }
    }
  }

  cache = { root: KB_ROOT, products, records, models, generatedAt: new Date().toISOString() };
  return cache;
}

/** 找到某产品对应的型号检索卡（先精确后宽松） */
export function findModelCard(productName) {
  const { models } = loadKB();
  const exact = models.get(keyExact(productName));
  if (exact) return exact;
  return models.get(keyLoose(productName)) || null;
}

const STOP = new Set(["主要", "需要", "现在", "这个", "那个", "可以", "怎么", "比较", "预算", "一位", "两台"]);

const LEXICON = [
  "剪辑", "视频", "设计", "绘图", "学生", "办公", "轻薄", "续航", "屏幕", "色准", "游戏",
  "编程", "商务", "出差", "便携", "性能", "散热", "价格", "预算", "鸿蒙", "触控", "折叠",
  "OLED", "护眼", "接口", "重量", "键盘", "柔光", "续航", "AI", "办公", "网课", "便携",
];

/** 极简分词：领域词表命中 + 中文 2-gram，够用且可解释 */
export function tokens(q) {
  const text = String(q || "");
  const set = new Set();
  for (const w of LEXICON) if (text.includes(w)) set.add(w);
  const cjk = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const seg of cjk) {
    for (let i = 0; i < seg.length - 1; i++) {
      const bg = seg.slice(i, i + 2);
      if (!STOP.has(bg)) set.add(bg);
    }
  }
  const nums = text.match(/\d{3,5}/g) || [];
  nums.forEach((n) => set.add(n));
  return [...set].slice(0, 24);
}

function score(text, toks) {
  let s = 0;
  for (const t of toks) {
    if (!text.includes(t)) continue;
    // 领域词权重更高；2 字通用词只给低分，避免「主要」这类噪声
    s += LEXICON.includes(t) ? 4 : t.length >= 3 ? 3 : 1;
  }
  return s;
}

/**
 * 检索证据：在型号卡事实与价格记录里按关键词打分
 * 返回可直接展示的引用片段（文件 + 原文）
 */
export function searchEvidence(query, { limit = 8, budget } = {}) {
  const { models, products } = loadKB();
  const toks = tokens(query);
  const hits = [];

  for (const model of models.values()) {
    for (const [kind, card] of Object.entries(model.cards)) {
      for (const line of card.facts) {
        const s = score(`${model.name} ${line}`, toks);
        if (s > 0) hits.push({ kind, model: model.name, text: line, source: card.file, score: s });
      }
      // 适用任务属于「画像」，单独打标，文案阶段不直接引用
      for (const line of card.fitFor) {
        const s = score(`${model.name} ${line}`, toks);
        if (s > 0) hits.push({ kind: `${kind}_fit`, model: model.name, text: line, source: card.file, score: s });
      }
      if (card.conclusion) {
        const s = score(`${model.name} ${card.conclusion}`, toks);
        if (s > 0) hits.push({ kind, model: model.name, text: card.conclusion, source: card.file, score: s + 1 });
      }
    }
  }

  const budgetNum = budget ?? Number((String(query).match(/(\d{3,5})/) || [])[1]);
  for (const p of products) {
    if (budgetNum && p.minPrice > budgetNum * 1.2) continue;
    const s = score(p.productName, toks);
    hits.push({
      kind: "price",
      model: p.productName,
      text: p.minPrice ? `${p.productName} 官方公开价 ¥${p.minPrice.toLocaleString()} 起（${p.skuCount} 条 SKU 记录）` : p.productName,
      source: p.file,
      score: s + 1,
      price: p.minPrice,
    });
  }

  const seen = new Set();
  return hits
    .filter((h) => h.score >= 4)
    .sort((a, b) => b.score - a.score)
    .filter((h) => {
      const k = `${h.source}|${h.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

/** 取某型号的官方公开价摘要（找不到返回 null） */
export function priceFor(productName) {
  const { products } = loadKB();
  const key = keyLoose(productName);
  return products.find((p) => keyLoose(p.productName) === key) || null;
}

/** 按预算筛选候选产品，按型号卡匹配度排序 */
export function candidatesByBudget(budget, query = "") {
  const { products, records } = loadKB();
  const toks = tokens(query);
  return products
    .filter((p) => !/下架/.test(p.status || "")) // 下架款不推荐给顾客
    .filter((p) => !budget || p.minPrice <= budget * 1.15)
    .map((p) => {
      const card = findModelCard(p.productName);
      const text = card
        ? [card.cards.identity?.conclusion, ...(card.cards.audience?.fitFor || [])].join(" ")
        : "";
      let sc = score(text, toks) + (card ? 2 : 0) + Math.min(p.skuCount, 6) * 0.6;
      if (budget && p.minPrice > budget) sc -= 3; // 超预算降权，但不直接排除
      return { ...p, card, score: sc };
    })
    .sort((a, b) => b.score - a.score || a.minPrice - b.minPrice)
    .map((p) => ({
      ...p,
      skus: records.filter((r) => r.productName === p.productName).sort((a, b) => a.price - b.price),
    }));
}
