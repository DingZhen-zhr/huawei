// 读取 KB 导入产物：index.json 只包含型号、图片索引、平台指南。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "data", "kb");
const INDEX = path.join(ROOT, "index.json");
const MEDIA = path.join(ROOT, "media");

let cache = null;

export function loadKbStore() {
  try {
    const stat = fs.statSync(INDEX);
    if (cache && cache.mtime === stat.mtimeMs) return cache;
    const raw = JSON.parse(fs.readFileSync(INDEX, "utf8"));
    if (!raw || !Array.isArray(raw.models) || !Array.isArray(raw.platformGuides)) return null;
    cache = { ...raw, mtime: stat.mtimeMs };
    return cache;
  } catch {
    return null;
  }
}

export function reloadKbStore() {
  cache = null;
}

function norm(value) {
  return String(value || "").replace(/^HUAWEI\s*/i, "").replace(/\s+/g, "").toLowerCase();
}

export function importedAssetFor(modelKey) {
  const store = loadKbStore();
  if (!store) return null;
  const key = norm(modelKey);
  const model =
    store.models.find((item) => norm(item.full) === key || norm(item.short) === key) ||
    store.models.find((item) => norm(item.full).includes(key) || key.includes(norm(item.short)));
  return model?.images?.find((image) => image.hero)?.url || null;
}

export function kbPlatformGuide(platform) {
  const store = loadKbStore();
  if (!store) return null;
  const names = {
    xiaohongshu: ["小红书"],
    moments: ["朋友圈"],
    "wechat-mp": ["公众号", "微信"],
    poster: ["海报"],
    video: ["视频号", "短视频"],
  }[platform] || [];
  const guide = store.platformGuides.find((item) => names.some((name) => String(item.platform || "").includes(name)));
  return guide ? { title: guide.title, text: String(guide.text || "").slice(0, 1200) } : null;
}

export function kbMediaPath(file) {
  const name = path.basename(String(file || ""));
  const store = loadKbStore();
  if (!name || !store?.mediaFiles?.includes(name)) return null;
  const full = path.join(MEDIA, name);
  return fs.existsSync(full) ? full : null;
}

export function kbStatus() {
  const store = loadKbStore();
  if (!store) return { ready: false, stats: { models: 0, images: 0, guides: 0 }, builtAt: null, source: null };
  return {
    ready: true,
    stats: store.stats || { models: store.models.length, images: store.mediaFiles?.length || 0, guides: store.platformGuides.length },
    builtAt: store.builtAt || null,
    source: store.source || null,
  };
}
