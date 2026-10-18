import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { createService } from './service';
import type { ServerConfig } from './service';

export function workflowApi(config: ServerConfig): Plugin {
  const service = createService(config);
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== '/api/status' && pathname !== '/api/generate') { next(); return; }
    const send = (code: number, value: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) { send(403, { ok: false, status: 'blocked', message: '仅允许同源工作台请求', issues: [] }); return; }
    if (pathname === '/api/status' && req.method === 'GET') { send(200, await service.status()); return; }
    if (pathname !== '/api/generate' || req.method !== 'POST') { send(405, { ok: false, status: 'blocked', message: '不支持的请求方法', issues: [] }); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { send(415, { ok: false, status: 'blocked', message: '请发送 JSON 任务', issues: [] }); return; }
    try {
      let text = ''; let size = 0;
      for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 64000) { send(413, { ok: false, status: 'blocked', message: '任务内容过长', issues: [] }); return; } text += chunk.toString(); }
      const { code, result } = await service.generate(JSON.parse(text)); send(code, result);
    } catch { send(400, { ok: false, status: 'blocked', message: '任务格式无效', issues: [] }); }
  };
  return { name: 'server-only-workflow-api', configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); }, configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); } };
}
