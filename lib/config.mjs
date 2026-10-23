// lib/config.mjs —— BYOK：用户自带 Key，本地保存，不入库、不回显
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', '.config.json');

const DEFAULTS = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
};

export function getConfig() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    saved = {};
  }
  const cfg = { ...DEFAULTS, ...saved };
  // 环境变量优先，方便 CI 或临时覆盖
  if (process.env.DEEPSEEK_API_KEY) cfg.apiKey = process.env.DEEPSEEK_API_KEY;
  if (process.env.DEEPSEEK_BASE_URL) cfg.baseUrl = process.env.DEEPSEEK_BASE_URL;
  if (process.env.DEEPSEEK_MODEL) cfg.model = process.env.DEEPSEEK_MODEL;
  return cfg;
}

export function saveConfig(patch = {}) {
  const cfg = { ...getConfig() };
  for (const k of ['baseUrl', 'model', 'provider']) {
    if (typeof patch[k] === 'string' && patch[k].trim()) cfg[k] = patch[k].trim();
  }
  if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) cfg.apiKey = patch.apiKey.trim();
  if (patch.clearKey) cfg.apiKey = '';
  cfg.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), 'utf8');
  return publicConfig(cfg);
}

export function publicConfig(cfg = getConfig()) {
  return {
    configured: Boolean(cfg.apiKey),
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    keyMask: mask(cfg.apiKey),
    updatedAt: cfg.updatedAt || null,
  };
}

function mask(key) {
  if (!key) return '';
  const tail = key.slice(-4);
  return key.startsWith('sk-') ? `sk-…${tail}` : `…${tail}`;
}
