import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { getProduct } from './ledger.mjs';
import { generatePlatformVariants } from './generator.mjs';
import { createAssetRepository } from './content-assets.mjs';
import { composeImage } from './image-compose.mjs';

test('real GT14 cover, evidence and CTA plans produce distinct raster text and poster preserves current copy', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-plan-pixels-'));
  try {
    const product = getProduct('matebook-gt-14');
    const store = { id: 'store:plans', name: '测试门店', profile: {} };
    const args = { product, audience: '创作者', target: '私聊问配置', scene: '剪视频 / 整理素材', realDetail: '每天拍完课程要从相机导入素材，SD卡和移动硬盘经常一起插。' };
    const drafts = ['xiaohongshu', 'poster'].map(platform => ({ ...generatePlatformVariants({ ...args, platform })[0], id: platform }));
    const task = { id: 'task:plans', storeId: store.id, productId: product.id, expiresAt: new Date(Date.now() + 86400000).toISOString(), variants: drafts };
    const repo = createAssetRepository({ runtimeDir: dir });
    const rows = await repo.generate(task, store, 'xiaohongshu');
    assert.ok(rows.every(row => row.status === 'ready'));
    const pngs = await Promise.all(rows.map(row => repo.download(task, store, row.id)));
    const raster = await Promise.all(pngs.map(png => sharp(png).raw().toBuffer()));
    assert.notDeepEqual(raster[0], raster[1], 'cover and evidence must differ in actual pixels');
    assert.notDeepEqual(raster[1], raster[2], 'evidence and CTA must differ in actual pixels');
    assert.match(rows[1].renderedText.overlayText.join('\n'), /SD卡槽/);
    assert.match(rows[1].renderedText.overlayText.join('\n'), /32 GB/);
    assert.ok(rows[2].renderedText.overlayText.includes(drafts[0].cta));
    const source = await readFile(path.join('public', product.asset));
    for (const [index, row] of rows.entries()) {
      assert.deepEqual(row.renderedText.limitations, drafts[0].limitations);
      const reference = await composeImage({ source, width: row.width, height: row.height, ...row.renderedText });
      assert.deepEqual(await sharp(reference).raw().toBuffer(), raster[index], 'audited plan text must be the text actually rasterized');
    }
    const condition = '外设兼容性须现场核对。';
    drafts[0].evidence = drafts[0].evidence.map((fact, index) => index === 0 ? { ...fact, conditions: condition } : fact);
    assert.equal(repo.list(task, store).find(row => row.id === rows[1].id).status, 'stale', 'rendered fact conditions also participate in the image fingerprint');
    const conditioned = await repo.generate(task, store, drafts[0].id);
    assert.ok(conditioned[1].renderedText.limitations.includes(condition));
    drafts[0].evidence = drafts[0].evidence.map((fact, index) => index === 0 ? { ...fact, conditions: '限时优惠直降999元' } : fact);
    await assert.rejects(repo.generate(task, store, drafts[0].id), error => error.code === 'CONTENT_BLOCKED', 'actual rendered evidence conditions use the same strict content gate');
    const poster = drafts[1];
    const original = (await repo.generate(task, store, poster.id))[0];
    assert.equal(original.status, 'ready');
    const originalPoster = await repo.download(task, store, original.id);
    for (const line of poster.body.split('\n')) assert.ok(original.renderedText.overlayText.includes(line));
    assert.ok(original.renderedText.overlayText.includes(poster.cta));
    poster.body = '右侧SD卡槽\n到店核对自己的接口';
    poster.cta = '带上实际使用的卡与线材到店核对。';
    const updated = (await repo.generate(task, store, poster.id))[0];
    for (const line of poster.body.split('\n')) assert.ok(updated.renderedText.overlayText.includes(line));
    assert.ok(updated.renderedText.overlayText.includes(poster.cta));
    assert.ok(!updated.renderedText.overlayText.includes('内存32 GB'));
    assert.notDeepEqual(await sharp(originalPoster).raw().toBuffer(), await sharp(await repo.download(task, store, updated.id)).raw().toBuffer());
  } finally { await rm(dir, { recursive: true, force: true }); }
});
