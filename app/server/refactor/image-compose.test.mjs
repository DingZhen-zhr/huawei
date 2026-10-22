import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

test('official layout makes real PNG and contains all four fixture edges', async () => {
  const module = await import('./image-compose.mjs').catch(() => ({}));
  assert.equal(typeof module.composeImage, 'function', 'official PNG composer must exist');
  const corners = await Promise.all(['#ffff00', '#00ff00', '#0000ff', '#ff0000'].map(background => sharp({ create: { width: 20, height: 20, channels: 4, background } }).png().toBuffer()));
  const fixture = await sharp({ create: { width: 400, height: 100, channels: 4, background: '#ffffff' } }).composite(corners.map((input, index) => ({ input, left: index % 2 ? 380 : 0, top: index > 1 ? 80 : 0 }))).png().toBuffer();
  const png = await module.composeImage({ source: fixture, width: 900, height: 383, title: '中文 <真实> & 体验', subtitle: '官方产品图片排版' });
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.width, meta.height], [900, 383]);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  // Distinct corner colors would disappear under cover/cropping; all must remain visible.
  for (const [x, y, rgb] of [[60, 155, [255, 255, 0]], [839, 155, [0, 255, 0]], [60, 320, [0, 0, 255]], [839, 320, [255, 0, 0]]]) {
    const offset = (y * info.width + x) * info.channels;
    assert.deepEqual([...data.subarray(offset, offset + 3)], rgb, `corner ${x},${y}`);
  }
  const planned = await module.composeImage({ source: fixture, width: 900, height: 383, title: '核对设备', subtitle: '官方产品图', purpose: 'detail', overlayText: ['SD <卡> & 线材'], limitations: ['实际接口需确认。'] });
  const rawPlan = await sharp(planned).raw().toBuffer({ resolveWithObject: true });
  for (const [x, y, rgb] of [[60, 195, [255, 255, 0]], [400, 195, [0, 255, 0]], [60, 266, [0, 0, 255]], [400, 266, [255, 0, 0]]]) {
    const offset = (y * rawPlan.info.width + x) * rawPlan.info.channels;
    assert.deepEqual([...rawPlan.data.subarray(offset, offset + 3)], rgb, `planned-layout corner ${x},${y}`);
  }
  await assert.rejects(module.composeImage({ source: fixture, width: 900, height: 383, title: '长'.repeat(300), subtitle: '' }), /溢出/);
});

test('planned body text changes real pixels while product area stays intact, and oversized body fails', async () => {
  const { composeImage } = await import('./image-compose.mjs');
  const source = await sharp({ create: { width: 400, height: 100, channels: 4, background: '#f08020' } }).png().toBuffer();
  const input = { source, width: 1080, height: 1440, title: '同一份核验标题', subtitle: 'MateBook GT 14 · 官方产品图', purpose: 'detail', limitations: ['实际兼容性需到店确认。'] };
  const first = await composeImage({ ...input, overlayText: ['右侧SD卡槽，内存32 GB。'] });
  const second = await composeImage({ ...input, overlayText: ['带上实际使用的存储卡核对接口。'] });
  const pixels = async (png, top, height) => sharp(png).extract({ left: 0, top, width: 1080, height }).raw().toBuffer();
  assert.notDeepEqual(await pixels(first, 800, 500), await pixels(second, 800, 500), 'planned text must affect body pixels, not only PNG metadata');
  assert.deepEqual(await pixels(first, 300, 400), await pixels(second, 300, 400), 'text does not overwrite or crop the contained product region');
  await assert.rejects(composeImage({ ...input, overlayText: ['长'.repeat(6000)] }), error => error.code === 'LAYOUT_OVERFLOW');
});

test('existing nonfont, wrong family, and non-CJK font cannot silently fall back', async (t) => {
  const { composeImage } = await import('./image-compose.mjs');
  const beforePath = process.env.HC_CJK_FONT_PATH, beforeFamily = process.env.HC_CJK_FONT_FAMILY;
  const fixture = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#fff' } }).png().toBuffer();
  try {
    for (const [fontPath, family] of [['package.json', 'NotARealFont'], ['C:/Windows/Fonts/msyh.ttc', 'NotARealFont'], ['C:/Windows/Fonts/arial.ttf', 'Arial']]) await t.test(`${fontPath} / ${family}`, async () => {
      process.env.HC_CJK_FONT_PATH = fontPath;
      process.env.HC_CJK_FONT_FAMILY = family;
      await assert.rejects(composeImage({ source: fixture, width: 900, height: 383, title: '中文体验产品图', subtitle: '真实产品' }), /配置中文字体/);
    });
  } finally {
    if (beforePath === undefined) delete process.env.HC_CJK_FONT_PATH; else process.env.HC_CJK_FONT_PATH = beforePath;
    if (beforeFamily === undefined) delete process.env.HC_CJK_FONT_FAMILY; else process.env.HC_CJK_FONT_FAMILY = beforeFamily;
  }
});

test('missing configured CJK font fails clearly instead of delivering tofu glyphs', async () => {
  const { composeImage } = await import('./image-compose.mjs');
  const before = process.env.HC_CJK_FONT_PATH;
  process.env.HC_CJK_FONT_PATH = '/nonexistent/hc-cjk-font.ttf';
  try {
    const fixture = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#fff' } }).png().toBuffer();
    await assert.rejects(composeImage({ source: fixture, width: 900, height: 383, title: '中文', subtitle: '产品' }), /配置中文字体/);
  } finally { if (before === undefined) delete process.env.HC_CJK_FONT_PATH; else process.env.HC_CJK_FONT_PATH = before; }
});

test('explicit valid CJK font path and family render real Chinese PNG', async () => {
  const { composeImage } = await import('./image-compose.mjs');
  const beforePath = process.env.HC_CJK_FONT_PATH, beforeFamily = process.env.HC_CJK_FONT_FAMILY;
  process.env.HC_CJK_FONT_PATH = 'C:/Windows/Fonts/msyh.ttc';
  process.env.HC_CJK_FONT_FAMILY = 'Microsoft YaHei';
  try {
    const source = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#fff' } }).png().toBuffer();
    const png = await composeImage({ source, width: 900, height: 383, title: '中文体验产品图', subtitle: '官方产品' });
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const metadata = await sharp(png).metadata();
    assert.deepEqual([metadata.width, metadata.height], [900, 383]);
  } finally {
    if (beforePath === undefined) delete process.env.HC_CJK_FONT_PATH; else process.env.HC_CJK_FONT_PATH = beforePath;
    if (beforeFamily === undefined) delete process.env.HC_CJK_FONT_FAMILY; else process.env.HC_CJK_FONT_FAMILY = beforeFamily;
  }
});
