// 知识库向量化脚本：遍历 md → 分块 → bge-m3 embedding → 保存索引
// 用法：node server/vectorize.mjs [--limit N] [--reset]
//   --limit N  只处理前 N 个文件（调试/小规模用）
//   --reset    清空已有索引重跑
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { collectMdFiles, chunkFile, embedBatch, loadIndex, saveIndex } from "./rag.mjs";

const cfileWithTimeout = (file) => withTimeout(chunkFile(file), 30000, `切块 ${file.rel}`);

const DATA_DIR = path.join(process.cwd(), "server", "data");
const INDEX_PATH = path.join(DATA_DIR, "kb-index.json");
const PROGRESS_PATH = path.join(DATA_DIR, "kb-progress.json");

// 核心业务板块（demo 自由对话最需要命中的内容）
const CORE_BOARDS = [
  "P1-产品参数库",
  "P6-营销素材库",
  "P8-客户场景库",
  "P2-卖点话术库",
  "P7-常见问题库",
  "P4-价格政策库（机密）",
];

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const reset = args.includes("--reset");
const boardsIdx = args.indexOf("--boards");
let boards = [];
if (boardsIdx >= 0) {
  // 支持逗号分隔：--boards "P1-产品参数库,P6-营销素材库"
  boards = args[boardsIdx + 1].split(",").map((x) => x.trim()).filter(Boolean);
} else {
  boards = CORE_BOARDS;
}

// 批量大小（embedding 一次处理多少块）
const BATCH = 16;
// 单文件超时保护（毫秒）：避免个别文件让整个索引任务挂住
const FILE_TIMEOUT = 120000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`超时 ${ms}ms：${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main() {
  console.log("开始构建知识库向量索引…");
  console.log("CPU 环境，bge-m3 运行中，全量约需数分钟到数十分钟。");

  const files = await collectMdFiles(boards);
  console.log(`发现的 markdown 文件：${files.length} 个（板块：${boards.join(", ") || "全部"}）`);

  let progress = { doneFiles: [] };
  if (!reset && existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8"));
  }

  const index = loadIndex() || { version: 1, chunks: [], doneFiles: [] };

  // 收集待处理文件（跳过已完成的，除非 reset）
  const pending = reset ? files : files.filter((f) => !index.doneFiles?.includes(f.rel));
  const toProcess = pending.slice(0, limit);
  console.log(`待处理：${toProcess.length} 个文件`);

  let processed = 0;
  let totalChunks = index.chunks.length;

  // 已处理文件块的 map（file -> chunks 起始位置），用于增量时替换
  for (const file of toProcess) {
    let blocks;
    try {
      blocks = await cfileWithTimeout(file);
    } catch (e) {
      console.warn(`⚠️ 跳过（切块失败）：${file.rel} → ${e.message}`);
      continue;
    }
    if (!blocks.length) {
      markDone(index, file.rel);
      continue;
    }
    // 分块 embedding（带单文件超时）
    const embeddings = [];
    try {
      for (let i = 0; i < blocks.length; i += BATCH) {
        const batch = blocks.slice(i, i + BATCH).map((b) => b.text);
        const vecs = await withTimeout(
          embedBatch(batch),
          FILE_TIMEOUT,
          `${file.rel} 第 ${Math.floor(i / BATCH) + 1} 批`
        );
        embeddings.push(...vecs);
      }
    } catch (e) {
      console.warn(`⚠️ 跳过（embedding 超时/失败）：${file.rel} → ${e.message}`);
      continue;
    }
    // 移除该文件旧的 chunks（增量重建）
    const oldChunks = index.chunks.filter((c) => c.file !== file.rel);
    const newChunks = blocks.map((b, i) => ({
      id: `${file.rel}#${b.chunkIndex}`,
      file: file.rel,
      board: b.board,
      chunkIndex: b.chunkIndex,
      text: b.text,
      embedding: embeddings[i],
    }));
    index.chunks = [...oldChunks, ...newChunks];
    markDone(index, file.rel, newChunks.length);
    totalChunks = index.chunks.length;
    processed++;
    if (processed % 10 === 0 || processed === toProcess.length) {
      console.log(`进度：${processed}/${toProcess.length} 文件，累计 chunk ${totalChunks}`);
      saveIndex(index);
      persistProgress(index);
    }
  }

  saveIndex(index);
  persistProgress(index);
  console.log(`✅ 索引构建完成：${index.chunks.length} 个 chunk，${index.doneFiles.length} 个文件`);
  console.log(`索引文件：${INDEX_PATH}`);
}

function markDone(index, file, chunkCount = 0) {
  if (!index.doneFiles) index.doneFiles = [];
  if (!index.doneFiles.includes(file)) index.doneFiles.push(file);
}

function persistProgress(index) {
  writeFileSync(PROGRESS_PATH, JSON.stringify({ doneFiles: index.doneFiles || [] }));
}

main().catch((e) => {
  console.error("构建失败：", e);
  process.exit(1);
});
