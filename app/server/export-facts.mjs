// 导出知识库事实快照，供无本地知识库的部署环境（Vercel）使用
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadKB } from "./agent/kb-index.mjs";

const kb = loadKB();
const out = {
  generatedAt: new Date().toISOString(),
  products: kb.products,
  records: kb.records,
  models: [...kb.models.entries()].map(([key, v]) => ({ key, ...v })),
};
const file = path.join(process.cwd(), "server", "fixtures", "kb-facts.json");
writeFileSync(file, JSON.stringify(out));
console.log(`✅ exported ${out.models.length} models / ${out.products.length} products → ${file}`);
