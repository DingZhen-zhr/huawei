// 把 JSON 规则卡与知识库快照打包成 ESM，供 Serverless 环境直接 import
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

// 1) 平台规则卡
const pdir = path.join(root, "server", "platforms");
const specs = {};
for (const f of readdirSync(pdir).filter((x) => x.endsWith(".json"))) {
  const s = JSON.parse(readFileSync(path.join(pdir, f), "utf-8"));
  specs[s.platform] = s;
}
writeFileSync(
  path.join(pdir, "index.mjs"),
  `// 由 build-fixtures.mjs 生成，勿手改\nexport default ${JSON.stringify(specs, null, 2)};\n`,
);

// 2) 知识库快照
const kb = JSON.parse(readFileSync(path.join(root, "server", "fixtures", "kb-facts.json"), "utf-8"));
writeFileSync(
  path.join(root, "server", "fixtures", "kb-facts.mjs"),
  `// 由 build-fixtures.mjs 生成，勿手改\nexport default ${JSON.stringify(kb)};\n`,
);
console.log("✅ 生成 platforms/index.mjs 与 fixtures/kb-facts.mjs");
