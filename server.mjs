// server.mjs —— 零依赖 HTTP 服务：静态页 + /api/generate
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/pipeline.mjs';
import { answerGuide } from './lib/guide.mjs';
import { revise } from './lib/revise.mjs';
import { advise } from './lib/advisor.mjs';
import { PLATFORMS, SCENARIOS } from './lib/rules.mjs';
import { MODEL_NAMES, KB_META } from './lib/kb.mjs';
import { publicConfig, saveConfig } from './lib/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5177);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/meta') {
      return json(res, 200, { kb: KB_META, models: MODEL_NAMES, platforms: PLATFORMS, scenarios: SCENARIOS, engine: publicConfig() });
    }
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, publicConfig());
    }
    if (url.pathname === '/api/config' && req.method === 'POST') {
      const patch = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, { ok: true, config: saveConfig(patch) });
    }
    if (url.pathname === '/api/config/test' && req.method === 'POST') {
      const { getConfig } = await import('./lib/config.mjs');
      const cfg = getConfig();
      if (!cfg.apiKey) return json(res, 200, { ok: false, error: '未配置 Key' });
      try {
        const r = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: '回复两个字：可用' }], max_tokens: 12 }),
        });
        const d = await r.json();
        return json(res, 200, { ok: r.ok, reply: d.choices?.[0]?.message?.content || '', status: r.status });
      } catch (e) {
        return json(res, 200, { ok: false, error: String(e.message) });
      }
    }
    if (url.pathname === '/api/generate' && req.method === 'POST') {
      const body = await readBody(req);
      const input = JSON.parse(body || '{}');
      const result = await run(input);
      return json(res, 200, result);
    }
    // 知识库图片
    if (url.pathname.startsWith('/media/')) {
      const name = decodeURIComponent(url.pathname.slice('/media/'.length));
      const file = path.join(__dirname, 'data', 'media', path.basename(name));
      const data = await readFile(file);
      const ext = path.extname(file).toLowerCase();
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600' });
      return res.end(data);
    }
    if (url.pathname === '/api/advise' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const result = await advise({ messages: b.messages, criteria: b.criteria, message: b.message });
      return json(res, 200, result);
    }
    if (url.pathname === '/api/revise' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const result = await revise({ product: b.product, scenario: b.scenario, platform: b.platform, draft: b.draft, instruction: b.instruction });
      return json(res, 200, result);
    }
    if (url.pathname === '/api/guide' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const result = await answerGuide({ product: body.product, question: body.question });
      return json(res, 200, result);
    }
    // 静态资源
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(__dirname, 'public', path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(path.join(__dirname, 'public'))) return json(res, 403, { error: 'forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') return json(res, 404, { error: 'not found' });
    json(res, 500, { error: String(err && err.message || err) });
  }
});

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) reject(new Error('payload too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

server.listen(PORT, () => console.log(`[pc-copy-agent] http://127.0.0.1:${PORT}`));
