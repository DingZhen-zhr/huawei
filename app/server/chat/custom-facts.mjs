// 新品资料：销售/运营手动导入的事实，参与生成与核验
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(process.cwd(), "server", "data");
const FILE = path.join(DIR, "custom-facts.json");

let cache = null;

export function listCustomFacts() {
  if (cache) return cache;
  try {
    cache = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf-8")) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function addCustomProduct({ model, price, points = [], extra = "" }) {
  const facts = listCustomFacts();
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  if (price) {
    rows.push({
      kind: "price",
      model,
      text: `${model} 官方公开价 ¥${Number(price).toLocaleString()} 起`,
      price: Number(price),
      source: "manual:新品导入",
      snapshotDate: today,
    });
  }
  for (const p of points.filter(Boolean)) {
    rows.push({ kind: "custom", model, text: `${model}：${p}`, price: null, source: "manual:新品导入", snapshotDate: today });
  }
  if (extra.trim()) {
    for (const line of extra.split("\n").map((s) => s.trim()).filter(Boolean)) {
      rows.push({ kind: "custom", model, text: line, price: null, source: "manual:新品导入", snapshotDate: today });
    }
  }
  const next = [...rows, ...facts].slice(0, 200);
  cache = next;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2), "utf-8");
  return rows;
}

export function customFactsFor(query) {
  const all = listCustomFacts();
  if (!query) return all.slice(0, 6);
  return all.filter((f) => query.includes(f.model) || f.text.includes(query)).slice(0, 8);
}
