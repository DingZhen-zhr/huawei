// 用法：npm run kb:import -- "/path/to/华为PC全板块深度知识库_v7"
import { defaultKbRoot, importKbToDisk } from "../server/refactor/kb-import.mjs";

const root = process.argv[2] || defaultKbRoot();
try {
  const result = importKbToDisk({ root });
  console.log(`知识库导入完成：${result.models} 个型号，${result.images} 张图，${result.guides} 份平台指南`);
  console.log(`来源：${result.source}`);
} catch (error) {
  console.error(`导入失败：${error?.message || error}`);
  process.exitCode = 1;
}
