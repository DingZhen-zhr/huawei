// 应用 Supabase 迁移：node server/db/apply-migrations.mjs
import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.SUPABASE_DB_URL || process.env.SUPABASE_POOLER_URL;
if (!url) {
  console.error("缺少 SUPABASE_DB_URL / SUPABASE_POOLER_URL");
  process.exit(1);
}

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  for (const file of files) {
    process.stdout.write(`applying ${file} ... `);
    await client.query(readFileSync(path.join(dir, file), "utf8"));
    console.log("ok");
  }
  console.log("✅ 迁移完成");
} finally {
  await client.end().catch(() => {});
}
