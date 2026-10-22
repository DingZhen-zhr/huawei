import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAssetRepository } from './content-assets.mjs';
import { getProduct } from './ledger.mjs';
import { generatePlatformVariants } from './generator.mjs';

function fixture() {
  const product = getProduct('matebook-pro-s');
  const store = { id: 'store:lifecycle', name: '测试门店', profile: {} };
  const variant = { ...generatePlatformVariants({ product, platform: 'moments', realDetail: '带上自己的包到店试一试', audience: '通勤', scene: '通勤', target: '到店体验' })[0], id: 'moments-test' };
  return { store, variant, task: { id: 'lifecycle-task', storeId: store.id, productId: product.id, expiresAt: new Date(Date.now() + 86400000).toISOString(), variants: [variant] } };
}

test('same fingerprint reuses bytes and concurrent requests retain one bounded PNG set', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-reuse-'));
  try {
    const { store, variant, task } = fixture();
    const repo = createAssetRepository({ runtimeDir: dir });
    const first = await repo.generate(task, store, variant.id);
    for (let count = 0; count < 3; count++) assert.equal((await repo.generate(task, store, variant.id))[0].id, first[0].id, 'same request must return the existing ready PNG');
    variant.title = '带上电脑包试一试';
    const reopened = createAssetRepository({ runtimeDir: dir });
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? reopened : repo).generate(task, store, variant.id)));
    assert.ok(concurrent.every(rows => rows[0].id === concurrent[0][0].id));
    assert.notEqual(concurrent[0][0].id, first[0].id);
    const files = await readdir(path.join(dir, 'content-media'));
    assert.equal(files.filter(name => name.endsWith('.png')).length, 1);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'content-media/assets.json'), 'utf8')).length, 1);
    assert.equal(files.filter(name => name.endsWith('.tmp')).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('complete media payload edits become stale and invalid media still fails its gate', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-fingerprint-'));
  try {
    const { store, variant, task } = fixture();
    const repo = createAssetRepository({ runtimeDir: dir });
    await repo.generate(task, store, variant.id);
    variant.cta = '带上自己的包过来比较';
    assert.equal(repo.list(task, store)[0].status, 'stale', 'CTA is part of verified media payload');
    await repo.generate(task, store, variant.id);
    variant.shotList = ['拿起自己的电脑包比较'];
    assert.equal(repo.list(task, store)[0].status, 'stale', 'non-video shot list is part of verified media payload');
    variant.cta = '限时优惠直降999元';
    await assert.rejects(repo.generate(task, store, variant.id), error => error.code === 'CONTENT_BLOCKED');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('on-demand expiry and restart remove only owned media files and crash orphans', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-clean-'));
  try {
    const { store, variant, task } = fixture();
    let repo = createAssetRepository({ runtimeDir: dir });
    const rows = await repo.generate(task, store, variant.id);
    const media = path.join(dir, 'content-media');
    await writeFile(path.join(media, 'unrelated-note.txt'), 'keep');
    await writeFile(path.join(media, 'unrelated.png'), 'keep');
    await writeFile(path.join(media, '11111111-1111-4111-8111-111111111111.png'), 'orphan');
    await writeFile(path.join(media, '22222222-2222-4222-8222-222222222222.png.tmp'), 'incomplete');
    repo = createAssetRepository({ runtimeDir: dir });
    assert.ok(!(await readdir(media)).includes('11111111-1111-4111-8111-111111111111.png'));
    assert.ok(!(await readdir(media)).includes('22222222-2222-4222-8222-222222222222.png.tmp'));
    assert.equal(repo.list(task, store)[0].id, rows[0].id);
    task.expiresAt = '2000-01-01';
    assert.throws(() => repo.list(task, store), error => error.status === 410);
    assert.equal((await readdir(media)).filter(name => /^[0-9a-f-]{36}\.png$/.test(name)).length, 0);
    assert.equal(JSON.parse(await readFile(path.join(media, 'assets.json'), 'utf8')).length, 0);
    assert.equal(await readFile(path.join(media, 'unrelated-note.txt'), 'utf8'), 'keep');
    assert.equal(await readFile(path.join(media, 'unrelated.png'), 'utf8'), 'keep');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('failed metadata commit removes new PNG and temporary orphans without deleting directories', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-commit-'));
  try {
    const { store, variant, task } = fixture();
    const repo = createAssetRepository({ runtimeDir: dir });
    const generating = repo.generate(task, store, variant.id);
    // A real filesystem failure while Sharp is awaiting its raster work.
    const metadataDirectory = path.join(dir, 'content-media/assets.json');
    mkdirSync(metadataDirectory);
    await assert.rejects(generating);
    assert.deepEqual(await readdir(path.join(dir, 'content-media')), ['assets.json']);
    assert.deepEqual(await readdir(metadataDirectory), [], 'cleanup never recursively removes a directory');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a concurrent edit is bounded and failed in-flight generation leaves the previous durable set', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hc-media-edit-'));
  try {
    const { store, variant, task } = fixture();
    const repo = createAssetRepository({ runtimeDir: dir });
    const original = await repo.generate(task, store, variant.id);
    variant.title = '带上自己的电脑包';
    const pending = repo.generate(task, store, variant.id);
    variant.title = '到店比较自己的电脑包';
    await assert.rejects(repo.generate(task, store, variant.id), error => error.status === 409);
    await assert.rejects(pending, error => error.status === 409);
    const files = await readdir(path.join(dir, 'content-media'));
    assert.deepEqual(files.filter(name => name.endsWith('.png')), [`${original[0].id}.png`]);
    assert.equal(files.filter(name => name.endsWith('.tmp')).length, 0);
    const stored = JSON.parse(await readFile(path.join(dir, 'content-media/assets.json'), 'utf8'));
    assert.equal(stored[0].id, original[0].id);
    assert.equal(repo.list(task, store)[0].status, 'stale');
    await repo.generate(task, store, variant.id);
    assert.equal((await readdir(path.join(dir, 'content-media'))).filter(name => name.endsWith('.png')).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
