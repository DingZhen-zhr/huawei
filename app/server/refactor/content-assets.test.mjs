import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { spawnSync } from 'node:child_process';
import { getProduct } from './ledger.mjs';
import { generatePlatformVariants } from './generator.mjs';

test('persistent official media, stale copies, unavailable products and true selected ZIP', async () => {
  const mod = await import('./content-assets.mjs').catch(() => ({}));
  assert.equal(typeof mod.createAssetRepository, 'function', 'persistent media repository must exist');
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-'));
  try {
    const product = getProduct('matebook-pro-s');
    const store = { id: 'store:test', name: '测试门店', profile: {} };
    const task = { id: 'task:test', storeId: store.id, productId: product.id, expiresAt: new Date(Date.now() + 86400000).toISOString(), variants: ['xiaohongshu', 'moments', 'wechat-mp', 'poster', 'video'].flatMap(platform => generatePlatformVariants({ product, platform, realDetail: '到店试着放进自己的包里', audience: '通勤', scene: '通勤', target: '到店体验' }).map((v, i) => ({ ...v, id: `${platform}-${i}` }))) };
    let repo = mod.createAssetRepository({ runtimeDir: dir });
    const variant = task.variants[0];
    const rows = await repo.generate(task, store, variant.id);
    assert.equal(rows.length, 3);
    assert.ok(rows.every(a => a.status === 'ready'));
    repo = mod.createAssetRepository({ runtimeDir: dir });
    assert.equal(repo.list(task, store).length, 3);
    const restart = spawnSync(process.execPath, ['--input-type=module', '-e', `import { createAssetRepository } from './server/refactor/content-assets.mjs'; console.log(createAssetRepository({runtimeDir:process.env.HC_TEST_MEDIA_DIR}).list(JSON.parse(process.env.HC_TEST_TASK),JSON.parse(process.env.HC_TEST_STORE)).length)`], { encoding: 'utf8', env: { ...process.env, HC_TEST_MEDIA_DIR: dir, HC_TEST_TASK: JSON.stringify(task), HC_TEST_STORE: JSON.stringify(store) } });
    assert.equal(restart.status, 0, restart.stderr);
    assert.equal(restart.stdout.trim(), '3');
    assert.equal((await repo.download(task, store, rows[0].id)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    variant.body += '\n我会带上自己的包来试。';
    assert.equal(repo.list(task, store)[0].status, 'stale');
    await assert.rejects(repo.download(task, store, rows[0].id), e => e.status === 409);
    await assert.rejects(repo.generate(task, { ...store, id: 'other' }, variant.id), e => e.status === 404);
    await assert.rejects(repo.download(task, store, '../outside'), e => e.status === 404);
    const exp = await import('./content-export.mjs');
    const selection = { moments: task.variants.filter(v => v.platform === 'moments').at(-1).id };
    const zipped = unzipSync(await exp.exportContent({ task, store, repository: repo, selections: selection }));
    assert.ok(zipped['manifest.json']);
    assert.ok(zipped['sources.json']);
    assert.equal(Object.keys(zipped).filter(k => k.startsWith('copy/')).length, 5);
    const manifest = JSON.parse(strFromU8(zipped['manifest.json']));
    assert.equal(manifest.selections.moments, selection.moments);
    assert.equal(strFromU8(zipped['copy/moments.txt']), task.variants.find(v => v.id === selection.moments).body);
    assert.ok(manifest.missingImages.length > 0);
    for (const field of ['title', 'body', 'script', 'summary', 'cta', 'limitations', 'tags', 'shotList', 'overlayText']) {
      const unsafe = structuredClone(variant);
      const claim = '限时优惠直降999元，现货当天发货';
      if (field === 'overlayText') unsafe.imagePlan[0].overlayText = [claim];
      else unsafe[field] = ['limitations', 'tags', 'shotList'].includes(field) ? [claim] : claim;
      const unsafeTask = { ...task, variants: [unsafe] };
      await assert.rejects(repo.generate(unsafeTask, store, unsafe.id), e => e.status === 409, `verify media field: ${field}`);
    }
    const beforeFont = process.env.HC_CJK_FONT_PATH;
    process.env.HC_CJK_FONT_PATH = 'package.json';
    try {
      const failed = await repo.generate(task, store, task.variants.find(v => v.id !== variant.id).id);
      assert.ok(failed.every(a => a.status === 'failed' && a.error.includes('配置中文字体')));
    } finally { if (beforeFont === undefined) delete process.env.HC_CJK_FONT_PATH; else process.env.HC_CJK_FONT_PATH = beforeFont; }
    variant.body = '限时优惠直降999元，现货当天发货';
    await assert.rejects(repo.generate(task, store, variant.id), e => e.status === 409);
    await assert.rejects(repo.download(task, store, rows[0].id), e => e.status === 409);
    await assert.rejects(exp.exportContent({ task, store, repository: repo }), e => e.status === 409);
    task.expiresAt = '2000-01-01';
    assert.throws(() => repo.list(task, store), e => e.status === 410);
    const missingProduct = getProduct('matebook-d-14');
    assert.equal(missingProduct.asset, null);
    // A no-material task must contain that model's real generated draft, including
    // its current image-plan evidence. Relabeling a Pro S draft is cross-model data.
    const missing = { ...task, id: 'missing', productId: missingProduct.id, expiresAt: new Date(Date.now() + 86400000).toISOString(), variants: mod.PLATFORMS.flatMap(platform => generatePlatformVariants({ product: missingProduct, platform, realDetail: '到店试着放进自己的包里', audience: '通勤', scene: '通勤', target: '到店体验' }).map((v, index) => ({ ...v, id: `missing-${platform}-${index}` }))) };
    for (const draft of missing.variants) {
      const unavailable = await repo.generate(missing, store, draft.id);
      assert.equal(unavailable.length, draft.imagePlan.length);
      assert.ok(unavailable.every(a => a.status === 'unavailable' && a.source === null));
      await assert.rejects(repo.download(missing, store, unavailable[0].id), error => error.status === 409);
    }
    const missingZip = unzipSync(await exp.exportContent({ task: missing, store, repository: repo }));
    const missingManifest = JSON.parse(strFromU8(missingZip['manifest.json']));
    assert.equal(missingManifest.productId, missingProduct.id);
    assert.equal(missingManifest.images.length, 0);
    assert.equal(missingManifest.missingImages.length, 7);
    assert.equal(Object.keys(missingZip).filter(name => name.startsWith('copy/')).length, 5);
    assert.ok(!Object.keys(missingZip).some(name => name.startsWith('images/')));
    // Keep the original contamination as a negative gate regression: clearing a
    // cloned draft's visible body must not authorize another model's overlay facts.
    const contaminated = { ...variant, id: 'cross-model-overlay', title: '到店体验', body: '到店试一试', script: '', tags: [] };
    await assert.rejects(repo.generate({ ...missing, variants: [contaminated] }, store, contaminated.id), error => error.code === 'CONTENT_BLOCKED');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
