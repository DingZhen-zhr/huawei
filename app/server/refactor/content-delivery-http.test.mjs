import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { unzipSync, strFromU8 } from 'fflate';

test('authenticated HTTP delivery returns PNG and selected ZIP, refusing blocked/stale/unknown', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-http-media-'));
  process.env.HC_RUNTIME_DIR = dir;
  const { router } = await import('./routes.mjs');
  const app = express(); app.use(express.json()); app.use('/api', router);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const root = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = '';
  const req = (url, method = 'GET', body) => fetch(root + url, { method, headers: { 'content-type': 'application/json', cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await req('/content/tasks/unknown/assets')).status, 401);
    const auth = await req('/auth/demo', 'POST', {}); cookie = auth.headers.get('set-cookie').split(';')[0];
    const unknown = await req('/ask/to-content', 'POST', { productId: 'not-a-model' });
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).code, 'PRODUCT_NOT_FOUND');
    const prefill = await (await req('/ask/to-content', 'POST', { productId: 'matebook-pro-s', budget: '6000–8000', realDetail: { text: '未经确认的文字' } })).json();
    assert.equal(prefill.prefill.budget, '6000–8000');
    assert.equal(prefill.prefill.realDetail, null);
    for (const budget of ['优惠999元', -50, {}, '8000-6000']) {
      const result = await (await req('/ask/to-content', 'POST', { productId: 'matebook-pro-s', budget })).json();
      assert.equal(result.prefill.budget, '');
    }
    const confirmed = await (await req('/ask/to-content', 'POST', { productId: 'matebook-pro-s', budget: 8000, realDetail: { text: '  自带电脑包  ', source: 'sales_provided', confirmed: true } })).json();
    assert.equal(confirmed.prefill.budget, '8000');
    assert.equal(confirmed.prefill.realDetail.text, '自带电脑包');
    const create = await req('/content/tasks', 'POST', { productId: 'matebook-pro-s', audience: '通勤', scene: '通勤', target: '到店体验', realDetail: { text: '到店试着放进自己的包里', confirmed: true, source: 'sales_provided' } });
    const { taskId } = await create.json(); assert.ok(taskId);
    let snapshot;
    for (let i = 0; i < 30; i++) { snapshot = await (await req(`/content/tasks/${taskId}`)).json(); if (snapshot.task.status === 'done') break; await new Promise(resolve => setTimeout(resolve, 80)); }
    const variant = snapshot.variants.find(v => v.platform === 'moments');
    const gen = await req(`/content/tasks/${taskId}/assets`, 'POST', { variantId: variant.id });
    assert.equal(gen.status, 200, await gen.clone().text());
    const { assets } = await gen.json(); assert.equal(assets[0].status, 'ready');
    const reused = await req(`/content/tasks/${taskId}/assets`, 'POST', { variantId: variant.id });
    assert.equal(reused.status, 200);
    assert.equal((await reused.json()).assets[0].id, assets[0].id, 'HTTP repeat request reuses its existing PNG');
    assert.equal((await req(`/content/tasks/${taskId}/assets`, 'POST', { variantId: variant.id, source: '../../outside.png' })).status, 400);
    const { getTask } = await import('./tasks.mjs');
    const owned = getTask(taskId);
    const owner = owned.storeId;
    owned.storeId = 'store:other';
    assert.equal((await req(`/content/tasks/${taskId}/assets`)).status, 404);
    assert.equal((await req(`/content/tasks/${taskId}/assets/${assets[0].id}/download`)).status, 404);
    assert.equal((await req(`/content/tasks/${taskId}/export`, 'POST', {})).status, 404);
    owned.storeId = owner;
    const png = await req(`/content/tasks/${taskId}/assets/${assets[0].id}/download`);
    assert.match(png.headers.get('content-type'), /image\/png/);
    assert.equal(Buffer.from(await png.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal((await (await req(`/content/tasks/${taskId}`)).json()).assets.length, 1);
    const zip = await req(`/content/tasks/${taskId}/export`, 'POST', { selections: { moments: variant.id } });
    assert.match(zip.headers.get('content-type'), /application\/zip/);
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    assert.ok(Object.keys(files).some(f => f.startsWith('images/moments/')));
    assert.equal(JSON.parse(strFromU8(files['manifest.json'])).selections.moments, variant.id);
    assert.equal((await req('/content/tasks/unknown/assets')).status, 404);
    assert.equal((await req(`/content/tasks/${taskId}/assets/not-a-file/download`)).status, 404);
    for (const platform of ['moments', 'video']) await t.test(`${platform} unsafe image title is blocked at generation/download/export`, async () => {
      const target = snapshot.variants.find(v => v.platform === platform);
      const safeTitle = target.title;
      const generated = await req(`/content/tasks/${taskId}/assets`, 'POST', { variantId: target.id });
      const safeAssets = (await generated.json()).assets;
      assert.equal(safeAssets[0].status, 'ready');
      if (platform === 'moments') assets[0] = safeAssets[0];
      try {
        await req(`/content/tasks/${taskId}/variants/${target.id}`, 'PATCH', { title: '限时优惠直降999元，现货当天发货' });
        const denied = [
          await req(`/content/tasks/${taskId}/assets`, 'POST', { variantId: target.id }),
          await req(`/content/tasks/${taskId}/assets/${safeAssets[0].id}/download`),
          await req(`/content/tasks/${taskId}/export`, 'POST', { selections: { [platform]: target.id } }),
        ];
        for (const response of denied) {
          assert.equal(response.status, 409, `${platform}: all media outlets must verify rendered title`);
          assert.equal((await response.json()).code, 'CONTENT_BLOCKED', `${platform}: blocked by content gate, not just stale status`);
        }
      } finally { await req(`/content/tasks/${taskId}/variants/${target.id}`, 'PATCH', { title: safeTitle }); }
    });
    await req(`/content/tasks/${taskId}/variants/${variant.id}`, 'PATCH', { body: '限时优惠直降999元，现货当天发货' });
    assert.equal((await req(`/content/tasks/${taskId}/assets/${assets[0].id}/download`)).status, 409);
    assert.equal((await req(`/content/tasks/${taskId}/export`, 'POST', { selections: { moments: variant.id } })).status, 409);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
