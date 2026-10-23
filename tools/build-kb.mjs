// tools/build-kb.mjs —— 华为PC全板块深度知识库 → data/kb.index.json + data/media/
// 用法: node tools/build-kb.mjs "C:\\path\\华为PC全板块深度知识库_v7"   (也支持 .zip)
import fs from 'node:fs';
import path from 'node:path';
import { readZip } from '../lib/zip.mjs';

const src = process.argv[2];
if (!src) {
  console.error('用法: node tools/build-kb.mjs <知识库目录 | 知识库.zip>');
  process.exit(1);
}
const abs = path.resolve(src);
if (!fs.existsSync(abs)) {
  console.error('路径不存在: ' + abs);
  process.exit(1);
}

const OUT = path.resolve('data');
const MEDIA = path.join(OUT, 'media');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(MEDIA, { recursive: true });

const TAG_BY_KEY = [
  [/重量|厚度|尺寸/, '便携'], [/屏幕|分辨率|亮度|色域|屏占比/, '屏幕'], [/电池|续航/, '续航'],
  [/接口|充电/, '接口'], [/处理器|内存|存储|显卡|性能/, '性能'], [/键盘|触控/, '输入'],
  [/摄像头|音频|麦克风/, '会议'], [/特色应用|系统/, '协同'],
];

/* ---------- 读取（目录或 zip 统一成 Map<relPath, Buffer>） ---------- */
const files = new Map();
let sourceName = path.basename(abs);

if (fs.statSync(abs).isDirectory()) {
  sourceName += '/';
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else files.set(path.relative(abs, full).split(path.sep).join('/'), fs.readFileSync(full));
    }
  };
  walk(abs);
} else {
  const zip = readZip(abs);
  for (const e of zip.entries) {
    if (e.isDir) continue;
    files.set(e.name.replace(/\\/g, '/'), zip.read(e));
  }
}

const text = (rel) => {
  const buf = files.get(rel);
  return buf ? buf.toString('utf8').replace(/^\uFEFF/, '') : null;
};
const find = (re) => [...files.keys()].filter(k => re.test(k));

/* ---------- 1. 型号矩阵 ---------- */
const MATRIX = 'P1-产品参数库/00-全库横向索引/全型号参数联合矩阵.csv';
const matrixRaw = text(MATRIX);
const models = [];
const warnings = [];

if (matrixRaw) {
  const rows = parseCSV(matrixRaw);
  const head = rows.shift();
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  for (const row of rows) {
    const get = (k) => (idx[k] !== undefined ? (row[idx[k]] || '').trim() : '');
    const full = get('型号');
    if (!full) continue;
    const sections = {};
    for (const col of ['操作系统', '屏幕规格', '处理器', '内存', '存储', '尺寸重量', '电池', '接口', '键盘触控板', '摄像头', '音频', '特色应用']) {
      const v = get(col);
      if (!v) continue;
      sections[col] = splitFacts(v);
    }
    const srcPath = get('本地事实源');
    const folder = srcPath ? srcPath.replace(/\/[^/]+$/, '') : '';
    models.push({
      full,
      short: shortName(full),
      line: lineOf(folder || srcPath),
      sections,
      facts: flattenFacts(sections),
      folder,
      images: [],
      limits: null,
      prices: [],
      source: srcPath || null,
    });
  }
} else {
  warnings.push('未找到全型号参数联合矩阵.csv，型号列表可能不完整');
}

/* ---------- 2. 图片（图片索引.csv + images 目录） ---------- */
for (const m of models) {
  if (!m.folder) continue;
  const csvPath = `${m.folder}/图片索引.csv`;
  const csv = text(csvPath);
  const dir = `${m.folder}/images/`;
  const available = [...files.keys()].filter(k => k.startsWith(dir));
  if (csv) {
    const rows = parseCSV(csv);
    const head = rows.shift() || [];
    const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
    for (const row of rows) {
      const file = (row[idx['文件名']] || '').trim();
      if (!file || !files.has(dir + file)) continue;
      pushImage(m, file, row, idx, dir);
    }
  }
  // 索引没覆盖到的图片也带上
  for (const k of available) {
    const file = k.slice(dir.length);
    if (m.images.some(i => i.file === file)) continue;
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    m.images.push({
      file, name: path.posix.basename(file, path.posix.extname(file)),
      caption: path.posix.basename(file, path.posix.extname(file)), usage: '', source: '', model: m.full,
      url: `/media/${safe(m.full)}-${safe(file)}`,
    });
    fs.writeFileSync(path.join(MEDIA, `${safe(m.full)}-${safe(file)}`), files.get(k));
  }
}

/* ---------- 3. 卖点与限制 ---------- */
for (const m of models) {
  const p = m.folder ? `${m.folder}/卖点与限制.md` : null;
  const md = p ? text(p) : null;
  if (md) m.limits = parseLimits(md);
}

/* ---------- 4. 官方公开价格 ---------- */
const priceRaw = text('P1-产品参数库/08-官方公开价格快照/官方价格快照.csv');
if (priceRaw) {
  const rows = parseCSV(priceRaw);
  const head = rows.shift() || [];
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  for (const row of rows) {
    const name = (row[idx['规范产品名称']] || '').trim();
    const hit = models.find(m => norm(m.full) === norm(name) || norm(name).includes(norm(m.short)));
    if (!hit) continue;
    hit.prices.push({
      type: (row[idx['价格类型']] || '').trim(),
      amount: (row[idx['页面金额（元）']] || '').trim(),
      ref: (row[idx['参考或划线金额（元）']] || '').trim(),
      condition: (row[idx['条件摘要']] || '').trim(),
      checkedAt: (row[idx['核验时间']] || '').trim(),
      url: (row[idx['官方URL']] || '').trim(),
      config: (row[idx['精确款式']] || '').trim(),
    });
  }
}

/* ---------- 5. 平台写作指南 ---------- */
const platformGuides = [];
for (const rel of find(/^P6-营销素材库\/02-平台模板\/.+\.md$/)) {
  const t = text(rel);
  if (!t) continue;
  platformGuides.push({
    platform: path.posix.basename(rel, '.md').replace(/模板$/, ''),
    title: (t.match(/^#\s+(.+)$/m) || [])[1] || path.posix.basename(rel, '.md'),
    text: t,
  });
}

/* ---------- 6. 写索引 ---------- */
const index = {
  builtAt: new Date().toISOString(),
  source: sourceName,
  version: 'v7',
  stats: {
    files: files.size,
    models: models.length,
    images: models.reduce((n, m) => n + m.images.length, 0),
    platformGuides: platformGuides.length,
  },
  models: models.map(m => ({ ...m, sections: m.sections, facts: m.facts })),
  platformGuides,
  warnings,
};

fs.writeFileSync(path.join(OUT, 'kb.index.json'), JSON.stringify(index), 'utf8');

console.log('✓ 索引已生成');
console.log(`  型号 ${models.length} 个 · 图片 ${index.stats.images} 张 · 平台指南 ${platformGuides.length} 份 · 源文件 ${files.size} 个`);
for (const m of models) {
  console.log(`  - ${m.full}｜${m.line}｜事实 ${m.facts.length} 条 / 图 ${m.images.length} 张 / 价格 ${m.prices.length} 条`);
}
if (warnings.length) console.log('  ⚠ ' + warnings.join('；'));

/* ================= 工具函数 ================= */

function parseCSV(t) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

/** "尺寸；14.2 英寸；类型；OLED" → [{key:'尺寸',value:'14.2 英寸'},...] */
function splitFacts(s) {
  const parts = s.split(/[；;]/).map(x => x.trim()).filter(Boolean);
  if (parts.length >= 4 && parts.length % 2 === 0 && parts.every(p => p.length <= 60)) {
    const out = [];
    for (let i = 0; i < parts.length; i += 2) out.push({ key: parts[i].replace(/[：:]$/, ''), value: parts[i + 1] });
    return out;
  }
  const hasColon = /^[^：:]{1,10}[：:]/.test(parts[0] || '');
  if (hasColon) return parts.map(p => {
    const m = p.match(/^([^：:]{1,10})[：:]\s*(.+)$/);
    return m ? { key: m[1].trim(), value: m[2].trim() } : { key: '', value: p };
  }).filter(x => x.key);
  return [{ key: '', value: parts.join('；') }];
}

const TAG_BY_KEY_DUP = null;

function flattenFacts(sections) {
  const out = [];
  for (const [col, arr] of Object.entries(sections)) {
    for (const f of arr) {
      const key = (f.key || col).trim();
      const value = String(f.value || '').trim();
      if (!value) continue;
      out.push({ key, value, section: col, tags: tagsFor(key + col) });
    }
  }
  return out;
}

function tagsFor(s) {
  const tags = [];
  for (const [re, tag] of TAG_BY_KEY) if (re.test(s)) tags.push(tag);
  return tags.length ? tags : ['通用'];
}

function parseLimits(md) {
  const pos = (md.match(/##\s*一句话定位\s*\n+([^\n#]+)/) || [])[1];
  const boundaries = [...md.matchAll(/\*\*表达边界\*\*\s*\n((?:[-*]\s*.+\n?)+)/g)]
    .flatMap(m => m[1].split('\n').map(s => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean));
  const usable = [...md.matchAll(/\*\*可用结论\*\*\s*\n+([^\n*#]+)/g)].map(m => m[1].trim());
  return {
    positioning: pos ? pos.trim() : null,
    boundaries: boundaries.slice(0, 12),
    conclusions: usable.slice(0, 6),
  };
}

function pushImage(m, file, row, idx, dir) {
  const caption = (row[idx['官网图片说明']] || '').trim();
  const usage = (row[idx['建议用途']] || '').trim();
  const page = (row[idx['来源页面']] || '').trim();
  m.images.push({
    file,
    name: `${m.short} · ${caption || path.posix.basename(file, path.posix.extname(file))}`,
    caption: caption || '',
    usage,
    source: page,
    model: m.full,
    url: `/media/${safe(m.full)}-${safe(file)}`,
  });
  fs.writeFileSync(path.join(MEDIA, `${safe(m.full)}-${safe(file)}`), files.get(dir + file));
}

function safe(s) {
  return s.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 120);
}

function norm(s) {
  return String(s).replace(/\s+/g, '').toLowerCase();
}

function shortName(full) {
  const m = full.match(/(MateBook\s*[A-Za-z0-9 ]+?)(?:\s*20\d\d)?$/i);
  return (m ? m[1] : full.replace(/^HUAWEI\s*/i, '')).trim();
}

function lineOf(p) {
  if (/鸿蒙/.test(p)) return '鸿蒙电脑';
  if (/擎云/.test(p)) return '擎云商用';
  if (/MateBook-Windows|Windows/i.test(p)) return 'MateBook Windows';
  return '其他';
}
