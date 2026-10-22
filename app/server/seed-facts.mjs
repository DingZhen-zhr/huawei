// 把知识库里的型号事实与官方价格灌进 Supabase facts 表
// 运行：node server/seed-facts.mjs
import "dotenv/config";
import pg from "pg";
import { loadKB } from "./agent/kb-index.mjs";

const url = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!url) throw new Error("缺少 SUPABASE_DB_URL / SUPABASE_POOLER_URL");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const kb = loadKB();
const rows = [];

for (const m of kb.models.values()) {
  for (const [kind, card] of Object.entries(m.cards)) {
    for (const text of card.facts) {
      rows.push([kind, m.name, text, null, card.file, "2026-10-17"]);
    }
    for (const text of card.fitFor || []) {
      rows.push([`${kind}_fit`, m.name, text, null, card.file, "2026-10-17"]);
    }
  }
}

for (const p of kb.products) {
  if (!p.minPrice) continue;
  rows.push([
    "price",
    p.productName,
    `${p.productName} 官方公开价 ¥${p.minPrice.toLocaleString()} 起，${p.skuCount} 条 SKU 记录`,
    p.minPrice,
    p.file,
    p.snapshotDate || "2026-10-17",
  ]);
}

await client.query("truncate table facts restart identity");

const batch = 200;
for (let i = 0; i < rows.length; i += batch) {
  const chunk = rows.slice(i, i + batch);
  const values = chunk
    .map((_, j) => `($${j * 6 + 1},$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6})`)
    .join(",");
  await client.query(
    `insert into facts (kind, model, text, price, source, snapshot_date) values ${values}`,
    chunk.flat(),
  );
}

const { rows: count } = await client.query("select count(*)::int as n from facts");
console.log(`✅ 已写入 ${count[0].n} 条事实（型号 ${kb.models.size} 个，价格 ${kb.products.length} 条）`);
await client.end();
