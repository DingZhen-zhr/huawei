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
  await assert.rejects(module.composeImage({ source: fixture, width: 900, height: 383, title: '长'.repeat(300), subtitle: '' }), /溢出/);
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
