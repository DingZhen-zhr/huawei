import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('export dropdown falls back after channel retry, task switch, or cross-channel stale selection', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const vite = await createServer({ root, configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, resolve: { alias: { '@': path.join(root, 'src') } }, esbuild: { jsx: 'automatic' } });
  try {
    const { default: ExportDelivery } = await vite.ssrLoadModule('/src/components/content/ExportDelivery.tsx');
    for (const [taskId, obsolete] of [['same-task-after-retry', 'old-angle'], ['different-task', 'previous-task-angle'], ['same-task-cross-channel', 'video-current']]) {
      const channels = Object.fromEntries(['xiaohongshu', 'moments', 'wechat-mp', 'poster', 'video'].map(platform => {
        const variant = { id: `${platform}-current`, angleLabel: '当前推荐', verification: { blocked: false } };
        return [platform, { label: platform, variants: [variant], recommended: variant }];
      }));
      const html = renderToStaticMarkup(createElement(ExportDelivery, { snapshot: { task: { id: taskId }, channels }, selections: { moments: obsolete }, onSelect() {} }));
      assert.match(html, /value="moments-current" selected=""/, taskId);
    }
  } finally { await vite.close(); }
});
