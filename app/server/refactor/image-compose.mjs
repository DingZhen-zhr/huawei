import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { openSync as openFont } from 'fontkit';

const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

function lines(text, columns, maximum) {
  const rows = [];
  let row = '', width = 0;
  for (const char of String(text)) {
    const size = char.codePointAt(0) > 255 ? 1 : 0.57;
    if (char === '\n' || width + size > columns) {
      rows.push(row); row = ''; width = 0;
    }
    if (char !== '\n') { row += char; width += size; }
  }
  if (row) rows.push(row);
  if (rows.length > maximum) throw Object.assign(new Error('排版文字溢出，请缩短标题后重试'), { status: 422, code: 'LAYOUT_OVERFLOW' });
  return rows;
}

export async function composeImage({ source, width, height, title, subtitle }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 300 || height < 300 || width > 2000 || height > 2000) throw new Error('无效排版尺寸');
  const fontSize = Math.max(22, Math.round(width * 0.035));
  const titleRows = lines(title, 25, 2);
  const subtitleRows = lines(subtitle, 36, 1);
  const fontfile = process.env.HC_CJK_FONT_PATH || [
    'C:/Windows/Fonts/msyh.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  ].find(filename => existsSync(filename));
  if (!fontfile || !existsSync(fontfile)) throw Object.assign(new Error('图片排版暂不可用，请联系管理员配置中文字体'), { status: 503, code: 'CJK_FONT_UNAVAILABLE' });
  let family = process.env.HC_CJK_FONT_FAMILY || (/msyh/i.test(fontfile) ? 'Microsoft YaHei' : /wqy/i.test(fontfile) ? 'WenQuanYi Zen Hei' : 'Noto Sans CJK SC');
  try {
    // Pango can silently replace invalid font files/families. Parse the actual file
    // and require its selected face to provide Chinese glyphs before rendering.
    const loaded = openFont(fontfile);
    const faces = loaded.fonts || [loaded];
    const normalize = value => String(value).toLowerCase().replace(/[\s-]/g, '');
    const face = faces.find(item => [item.familyName, item.fullName, item.postscriptName].some(name => normalize(name) === normalize(family)));
    const chinese = [...new Set([...`中文体验产品图${title}${subtitle}`].filter(char => /\p{Script=Han}/u.test(char)))];
    if (!face || chinese.some(char => !face.hasGlyphForCodePoint(char.codePointAt(0)))) throw new Error('Font face or Chinese glyphs unavailable');
    // Feed Pango the real family rather than an accepted PostScript/full-name alias.
    family = face.familyName;
  } catch {
    throw Object.assign(new Error('图片排版暂不可用，请联系管理员配置中文字体'), { status: 503, code: 'CJK_FONT_UNAVAILABLE' });
  }
  const top = Math.round(height * 0.34), left = Math.round(width * 0.06);
  const product = await sharp(source).resize(width - 2 * left, Math.round(height * 0.56), { fit: 'contain', background: '#f3f5f7' }).png().toBuffer();
  const overlays = [{ input: product, top, left }];
  const ensureFits = async (rendered, textTop) => {
    const metadata = await sharp(rendered).metadata();
    if (metadata.width > width - 2 * left || textTop + metadata.height > top) throw Object.assign(new Error('排版文字溢出，请缩短标题后重试'), { status: 422, code: 'LAYOUT_OVERFLOW' });
  };
  for (const [index, row] of titleRows.entries()) {
    const rendered = await sharp({ text: { text: `<span foreground="#17283c">${xml(row)}</span>`, font: `${family} ${fontSize}`, fontfile, rgba: true } }).png().toBuffer();
    const textTop = Math.round(fontSize * (0.65 + index * 1.25));
    await ensureFits(rendered, textTop);
    overlays.push({ input: rendered, top: textTop, left });
  }
  for (const row of subtitleRows) {
    const rendered = await sharp({ text: { text: `<span foreground="#536276">${xml(row)}</span>`, font: `${family} ${Math.round(fontSize * 0.65)}`, fontfile, rgba: true } }).png().toBuffer();
    const textTop = Math.round(height * 0.25);
    await ensureFits(rendered, textTop);
    overlays.push({ input: rendered, top: textTop, left });
  }
  return sharp({ create: { width, height, channels: 4, background: '#f3f5f7' } }).composite(overlays).png().toBuffer();
}
