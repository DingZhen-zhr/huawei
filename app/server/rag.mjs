// RAG 核心模块：本地 embedding（bge-m3）+ 知识库分块 + 向量检索
// 采用 @xenova/transformers 在本地加载 bge-m3，走 hf-mirror 镜像
import { pipeline, env } from "@xenova/transformers";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

// 使用国内镜像下载/加载模型
env.remoteHost = process.env.HF_ENDPOINT || "https://hf-mirror.com";
env.allowRemoteModels = true;

const EMBED_MODEL = "Xenova/bge-m3";
const INDEX_PATH = path.join(process.cwd(), "server", "data", "kb-index.json");

let extractorPromise = null;

/** 懒加载 embedding 管道（单例） */
export function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
  }
  return extractorPromise;
}

/** 对文本数组批量 embedding，返回 number[][] */
export async function embedBatch(texts) {
  const extractor = await getExtractor();
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  // out.data 是扁平 Float32Array，按行数切分
  const dim = out.dims[out.dims.length - 1];
  const rows = out.dims[out.dims.length - 2];
  const result = [];
  for (let i = 0; i < rows; i++) {
    const arr = Array.from(out.data.slice(i * dim, (i + 1) * dim));
    result.push(arr);
  }
  return result;
}

/** 单个文本 embedding */
export async function embed(text) {
  const [v] = await embedBatch([text]);
  return v;
}

/* ─────────────── 知识库文件遍历 & 分块 ─────────────── */

const KB_ROOT_ABS = path.resolve(process.cwd(), "..", "华为PC全板块深度知识库_v7");

// 排除的目录（归档、待审核，避免重复/噪音）
const EXCLUDE_DIRS = new Set(["99-历史归档", "90-待审核"]);

/**
 * 递归收集所有 .md 文件。
 * @param {string[]} includeBoards 顶层目录白名单（如 ["P1-产品参数库"]）；
 *   为空则收集全部（仍排除 EXCLUDE_DIRS）。
 */
export async function collectMdFiles(includeBoards = []) {
  const files = [];
  const root = KB_ROOT_ABS;
  if (!existsSync(root)) {
    throw new Error(
      `未找到知识库目录：${root}\n` +
        `请将「华为PC全板块深度知识库_v7」放到仓库根目录（与 app/ 同级）后再运行 npm run vectorize。`
    );
  }
  const topDirs = includeBoards.length
    ? includeBoards
    : (await readdir(root, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && !EXCLUDE_DIRS.has(e.name))
        .map((e) => e.name);

  for (const top of topDirs) {
    const dir = path.join(root, top);
    async function walk(d, rel) {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (EXCLUDE_DIRS.has(e.name)) continue;
        const full = path.join(d, e.name);
        const relPath = rel ? path.join(rel, e.name) : e.name;
        if (e.isDirectory()) {
          await walk(full, relPath);
        } else if (e.isFile() && e.name.endsWith(".md")) {
          files.push({ abs: full, rel: relPath });
        }
      }
    }
    await walk(dir, top);
  }
  return files;
}

/**
 * 用 markdown 标题（## / ###）将一个文件切成块。
 * 每个块尽量保留 < 约 800 字符，保证语义完整。
 */
export function splitMarkdown(text) {
  const lines = text.split("\n");
  // 记录每个标题行位置
  const headingIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i])) headingIdx.push(i);
  }
  if (headingIdx.length === 0) {
    // 没有标题，直接整文件作为一个块（过长时按空行粗切）
    return fallbackSplit(text);
  }
  const chunks = [];
  for (let k = 0; k < headingIdx.length; k++) {
    const start = headingIdx[k];
    const end = k + 1 < headingIdx.length ? headingIdx[k + 1] : lines.length;
    const block = lines.slice(start, end).join("\n").trim();
    if (block.length >= 8) chunks.push(block);
  }
  // 标题前的前言（若有正文）并入第一个块，避免丢失
  const preamble = lines.slice(0, headingIdx[0]).join("\n").trim();
  if (preamble && preamble.length >= 20) {
    chunks.unshift(preamble);
  }
  return chunks.map((c) => (c.length > 900 ? heavySplit(c) : c)).flat();
}

function fallbackSplit(text) {
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim().length >= 8);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > 800) {
      if (cur) chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [text.trim()];
}

function heavySplit(text) {
  // 纯文本过长时按句/行切成块
  const lines = text.split("\n");
  const chunks = [];
  let cur = "";
  for (const l of lines) {
    if ((cur + "\n" + l).length > 700) {
      if (cur) chunks.push(cur);
      cur = l;
    } else {
      cur = cur ? cur + "\n" + l : l;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** 读取并分块一个文件，返回块数组 */
export async function chunkFile(file) {
  const text = readFileSync(file.abs, "utf-8");
  const blocks = splitMarkdown(text);
  return blocks.map((text, i) => ({
    file: file.rel,
    chunkIndex: i,
    text,
    // 用文件相对路径作为板块标识的前两级
    board: file.rel.split(path.sep).slice(0, 2).join("/"),
  }));
}

/* ─────────────── 索引构建 & 检索 ─────────────── */

// 索引可能在几十 MB 以上：按 mtime 缓存，避免每次检索重复解析
let cachedIndex = null;
let cachedMtime = 0;

export function loadIndex() {
  if (!existsSync(INDEX_PATH)) return null;
  const mtime = statSync(INDEX_PATH).mtimeMs;
  if (cachedIndex && mtime === cachedMtime) return cachedIndex;
  cachedIndex = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
  cachedMtime = mtime;
  return cachedIndex;
}

export function saveIndex(index) {
  writeFileSync(INDEX_PATH, JSON.stringify(index));
}

/** 余弦相似度 */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/** 知识库中的型号目录（按长度降序匹配，避免 "Pro" 吃掉 "Pro S"） */
const MODEL_DIRS = [
  "HUAWEI MateBook Pro S",
  "HUAWEI MateBook Pro",
  "HUAWEI MateBook Fold",
  "HUAWEI MateBook 14",
];

/**
 * 从问题中识别被提及的型号。
 * 注意 "MateBook Pro S" 含 "MateBook Pro" 子串，需分别用显式规则判断。
 */
export function detectModels(query) {
  const q = query.toLowerCase();
  const found = new Set();
  if (/pro\s*s\b|pros\b/.test(q)) found.add("HUAWEI MateBook Pro S");
  // 非 Pro S 的 Pro：排除 "pro s"
  if (/matebook\s*pro(?!\s*s\b)/.test(q) || /(^|[^a-z])pro(?!\s*s\b)(?![a-z])/.test(q)) {
    found.add("HUAWEI MateBook Pro");
  }
  if (/matebook\s*14|\b14\s*英寸/.test(q)) found.add("HUAWEI MateBook 14");
  if (/fold|非凡大师|折叠/.test(q)) found.add("HUAWEI MateBook Fold");
  return [...found];
}

/** 该 chunk 是否属于指定型号的目录（严格带 /，避免 "Pro" 误匹配 "Pro S"） */
function inModelDir(chunk, modelDir) {
  return chunk.file.includes(`${modelDir}/`);
}

/**
 * 检索：query → embedding → 余弦相似度 → 多样性挑选。
 * 为防止 top-K 全落在同一个文件（例如只命中 Pro S 而漏掉 Pro），
 * 先取较大的候选池，再按「每个文件最多 maxPerFile 块」挑选，保证来源分散。
 */
export async function retrieve(query, { topK = 8, maxPerFile = 2 } = {}) {
  const index = loadIndex();
  if (!index || !index.chunks || !index.chunks.length) {
    return { chunks: [], error: "索引尚未构建，请先运行 node server/vectorize.mjs" };
  }
  const qv = await embed(query);
  // 意图感知加权：问价格时优先价格卡，问平台时优先平台模板
  const wantsPrice = /(价格|多少钱|报价|预算|优惠|券|补贴|以旧换新|到手价)/.test(query);
  const wantsPlatform = /(小红书|公众号|朋友圈|海报|文案|软文|图文|标题)/.test(query);
  const scored = index.chunks.map((c) => {
    let score = cosine(qv, c.embedding);
    if (wantsPrice && /价格卡|价格快照|官方公开价格/.test(c.file)) score += 0.08;
    if (wantsPlatform && /平台模板|模板|完整成稿/.test(c.file)) score += 0.06;
    return { ...c, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // 候选池：取 topK 的 5 倍（至少 40），再做多样性挑选
  const pool = scored.slice(0, Math.max(topK * 5, 40));
  const perFile = new Map();
  const picked = [];
  for (const c of pool) {
    const n = perFile.get(c.file) || 0;
    if (n >= maxPerFile) continue;
    perFile.set(c.file, n + 1);
    picked.push(c);
    if (picked.length >= topK) break;
  }
  // 若多样性约束导致不足，用剩余候选补齐
  if (picked.length < topK) {
    const pickedIds = new Set(picked.map((c) => c.id));
    for (const c of pool) {
      if (picked.length >= topK) break;
      if (!pickedIds.has(c.id)) picked.push(c);
    }
  }

  // 价格类问题：把命中价格卡的其余分块一并带上，保证表格里具体 SKU 行不被切掉
  if (wantsPrice) {
    const priceFiles = new Set(
      picked.filter((c) => /价格卡/.test(c.file)).map((c) => c.file)
    );
    // 只扩展得分最高的 2 个价格卡文件，避免上下文膨胀
    const topPriceFiles = [...priceFiles].slice(0, 2);
    for (const file of topPriceFiles) {
      const ref = picked.find((c) => c.file === file);
      const base = ref ? ref.score : 0;
      const siblings = index.chunks
        .filter((c) => c.file === file && !picked.some((p) => p.id === c.id))
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .slice(0, 4);
      for (const sib of siblings) {
        picked.push({ ...sib, score: Math.max(0, base - 0.001 * (sib.chunkIndex + 1)) });
      }
    }
  }

  // 型号覆盖保证：问题提到的每个型号，注入其「产品事实」的关键分块
  const models = detectModels(query);
  const covered = [...picked];
  for (const m of models) {
    const inDir = scored.filter((c) => inModelDir(c, m));
    if (!inDir.length) continue;
    const factChunks = inDir
      .filter((c) => /产品事实\.md$/.test(c.file))
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    // 产品事实优先，并按「重量/屏幕/性能/接口」等关键小节排序取前 3 块
    const KEYS = ["尺寸与重量", "屏幕", "性能", "处理器", "内存", "接口", "电池"];
    const rankedFacts = [...factChunks].sort((a, b) => {
      const rank = (c) => {
        const i = KEYS.findIndex((k) => c.text.includes(k));
        return i === -1 ? KEYS.length : i;
      };
      return rank(a) - rank(b);
    });
    const inject = factChunks.length
      ? rankedFacts.slice(0, 3)
      : [inDir.find((c) => /卖点与限制\.md$/.test(c.file)) || inDir[0]];
    for (const b of inject) {
      if (covered.some((c) => c.id === b.id)) continue;
      // 替换掉分数最低、且不属于任何已提及型号的块
      let replaceIdx = -1;
      for (let i = covered.length - 1; i >= 0; i--) {
        if (!models.some((m2) => inModelDir(covered[i], m2))) {
          replaceIdx = i;
          break;
        }
      }
      if (replaceIdx >= 0) covered[replaceIdx] = b;
      else covered.push(b);
    }
  }

  // 去重并限制上下文规模（最多 16 块）
  const seen = new Set();
  const finalChunks = covered
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .slice(0, 16);

  return {
    chunks: finalChunks
      .sort((a, b) => b.score - a.score)
      .map((c) => ({
        file: c.file,
        board: c.board,
        chunkIndex: c.chunkIndex,
        text: c.text,
        score: c.score,
      })),
  };
}
