// 知识库导入：只取型号、图片索引、平台指南，不把原始资料带进仓库。
// 生成物写到 server/data/kb/（已 gitignore），运行时由 kb-store 读取。
// 解析逻辑参考 byf 分支的 tools/build-kb.mjs，做了路径、大小和原子写入限制。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT_DIR = path.resolve(HERE, "..", "data", "kb");
const MATRIX = "P1-产品参数库/00-全库横向索引/全型号参数联合矩阵.csv";
const MAX_IMAGES = 200;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function safe(value, max = 80) {
  return String(value || "")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "file";
}

function hash(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 8);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((line) => line.some((cell) => String(cell).trim()));
}

function tableRows(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows.shift().map((cell) => String(cell).trim());
  const index = Object.fromEntries(head.map((cell, i) => [cell, i]));
  return rows.map((row) => ({ row, index }));
}

function lineOf(folder) {
  if (/鸿蒙/.test(folder)) return "鸿蒙电脑";
  if (/擎云/.test(folder)) return "擎云商用";
  if (/MateBook-Windows|Windows/i.test(folder)) return "MateBook Windows";
  return "其他";
}

function shortName(full) {
  const matched = String(full).match(/(MateBook\s*[A-Za-z0-9 ]+?)(?:\s*20\d\d)?$/i);
  return (matched ? matched[1] : String(full).replace(/^HUAWEI\s*/i, "")).trim();
}

function walk(root, out = [], limit = 30000) {
  if (out.length >= limit) return out;
  for (const name of fs.readdirSync(root)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(root, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) walk(full, out, limit);
    else out.push(full);
    if (out.length >= limit) break;
  }
  return out;
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch {
    return null;
  }
}

function buildGuides(root, files) {
  const prefix = "P6-营销素材库/02-平台模板/";
  return files
    .filter((full) => full.split(path.sep).join("/").includes(prefix) && full.endsWith(".md"))
    .map((full) => {
      const text = readText(full);
      if (!text) return null;
      const rel = path.relative(root, full).split(path.sep).join("/");
      const base = path.basename(full, ".md");
      return {
        platform: base.replace(/模板$/, ""),
        title: (text.match(/^#\s+(.+)$/m) || [])[1] || base,
        text: text.slice(0, 5000),
        source: rel,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function importModelImages({ root, model, mediaDir, mediaFiles, budget }) {
  const folder = model.folder;
  if (!folder) return;
  const imagesDir = path.join(root, folder, "images");
  if (!fs.existsSync(imagesDir)) return;
  const indexFile = path.join(root, folder, "图片索引.csv");
  const indexText = readText(indexFile);
  const indexRows = indexText ? tableRows(indexText) : [];
  const available = new Map();
  for (const full of walk(imagesDir)) {
    if (!/\.(png|jpe?g|webp)$/i.test(full)) continue;
    const stat = fs.statSync(full);
    if (stat.size > MAX_IMAGE_BYTES) continue;
    available.set(path.basename(full), full);
  }

  const seen = new Set();
  const rows = indexRows.length
    ? indexRows
    : [...available.keys()].map((file) => ({ row: [file, "", "", ""], index: { 文件名: 0, 官网图片说明: 1, 建议用途: 2, 来源页面: 3 } }));
  for (const { row, index } of rows) {
    if (mediaFiles.length >= MAX_IMAGES || budget.left <= 0) break;
    const file = String(row[index["文件名"]] || "").trim();
    if (!file || seen.has(file)) continue;
    const full = available.get(path.basename(file));
    if (!full) continue;
    seen.add(file);
    const ext = path.extname(full).toLowerCase();
    const outputName = `${safe(model.short, 36)}-${hash(`${model.full}/${file}`)}${ext}`;
    const target = path.join(mediaDir, outputName);
    try {
      fs.copyFileSync(full, target);
    } catch {
      continue;
    }
    budget.left -= 1;
    const caption = String(row[index["官网图片说明"]] || "").trim();
    const usage = String(row[index["建议用途"]] || "").trim();
    const source = String(row[index["来源页面"]] || "").trim();
    model.images.push({
      file: outputName,
      name: caption || path.basename(file, path.extname(file)),
      caption,
      usage,
      source,
      url: `/api/kb/media/${encodeURIComponent(outputName)}`,
    });
    mediaFiles.push(outputName);
  }
}

function replaceDir(target, staging) {
  const backup = `${target}.bak`;
  fs.rmSync(backup, { recursive: true, force: true });
  const hadTarget = fs.existsSync(target);
  if (hadTarget) fs.renameSync(target, backup);
  try {
    fs.renameSync(staging, target);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(target, { recursive: true, force: true });
    if (hadTarget) fs.renameSync(backup, target);
    throw error;
  }
}

export function defaultKbRoot() {
  if (process.env.KB_ROOT) return path.resolve(process.env.KB_ROOT);
  return path.resolve(HERE, "../../..", "华为PC全板块深度知识库_v7");
}

export function importKb({ root = defaultKbRoot(), outDir = DEFAULT_OUT_DIR } = {}) {
  const source = path.resolve(root);
  const stat = fs.existsSync(source) ? fs.statSync(source) : null;
  if (!stat || !stat.isDirectory()) throw new Error("知识库目录不存在，请设置 KB_ROOT 或传路径");
  const matrixFile = path.join(source, MATRIX);
  if (!fs.existsSync(matrixFile)) throw new Error("没找到全型号参数联合矩阵.csv，确认选的是 v7 知识库根目录");

  const files = walk(source);
  const matrixText = readText(matrixFile);
  const rows = tableRows(matrixText || "");
  if (!rows.length) throw new Error("型号矩阵是空的");
  const mediaFiles = [];
  const budget = { left: MAX_IMAGES };
  const models = [];

  for (const { row, index } of rows) {
    const full = String(row[index["型号"]] || "").trim();
    if (!full) continue;
    const sourcePath = String(row[index["本地事实源"]] || "").trim();
    const folder = sourcePath ? sourcePath.replace(/\/[^/]+$/, "") : "";
    const model = {
      full,
      short: shortName(full),
      line: lineOf(folder || sourcePath),
      folder,
      images: [],
    };
    importModelImages({ root: source, model, mediaDir: path.join(outDir, "media"), mediaFiles, budget });
    const hero = model.images.find((image) => {
      const text = `${image.caption} ${image.usage} ${image.name}`;
      return /主视觉|KV|外观|配色|产品图|创拍|颜色/.test(text) && !/处理器|屏幕|接口|协同|卖点|AI|性能|键盘|触控|续航/i.test(text);
    });
    if (hero) hero.hero = true;
    models.push(model);
  }

  const guides = buildGuides(source, files);
  if (!models.length) throw new Error("没有解析出型号");
  if (!mediaFiles.length) throw new Error("没有导入到图片，检查图片索引或 images 目录");

  const result = {
    version: 1,
    builtAt: new Date().toISOString(),
    source: path.basename(source),
    stats: { models: models.length, images: mediaFiles.length, guides: guides.length },
    models,
    platformGuides: guides,
    mediaFiles,
  };
  return result;
}

export function importKbToDisk(options = {}) {
  const outDir = path.resolve(options.outDir || DEFAULT_OUT_DIR);
  const staging = `${outDir}.tmp-${process.pid}`;
  const mediaDir = path.join(staging, "media");
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  try {
    const result = importKb({ ...options, outDir: staging });
    // importKb 用 staging/media 作为目标；这里保证目录结构后再原子替换。
    fs.writeFileSync(path.join(staging, "index.json"), JSON.stringify(result), "utf8");
    replaceDir(outDir, staging);
    return { ...result.stats, builtAt: result.builtAt, source: result.source };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
