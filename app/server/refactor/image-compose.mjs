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

export async function composeImage({ source, width, height, title, subtitle, purpose, overlayText, limitations = [] }) {
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
    const chinese = [...new Set([...`中文体验产品图${title}${subtitle}${(overlayText || []).join('')}${limitations.join('')}`].filter(char => /\p{Script=Han}/u.test(char)))];
    if (!face || chinese.some(char => !face.hasGlyphForCodePoint(char.codePointAt(0)))) throw new Error('Font face or Chinese glyphs unavailable');
    // Feed Pango the real family rather than an accepted PostScript/full-name alias.
    family = face.familyName;
  } catch {
    throw Object.assign(new Error('图片排版暂不可用，请联系管理员配置中文字体'), { status: 503, code: 'CJK_FONT_UNAVAILABLE' });
  }
  if (overlayText !== undefined) return composePlan({ source, width, height, title, subtitle, purpose, overlayText, limitations, family, fontfile });
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

async function composePlan({ source, width, height, title, subtitle, purpose, overlayText, limitations, family, fontfile }) {
  const overflow = () => Object.assign(new Error('排版文字溢出，请缩短当稿文字后重试'), { status: 422, code: 'LAYOUT_OVERFLOW' });
  if (!Array.isArray(overlayText) || !Array.isArray(limitations)) throw overflow();
  const horizontal = width > height * 1.5;
  const margin = Math.round(width * 0.06);
  const titleSize = Math.max(22, Math.round(width * 0.035));
  const productTop = Math.round(height * (horizontal ? 0.30 : 0.21));
  const productWidth = Math.round(horizontal ? width * 0.39 : width - margin * 2);
  const productHeight = Math.round(height * (horizontal ? 0.61 : 0.32));
  const overlays = [{ input: await sharp(source).resize(productWidth, productHeight, { fit: 'contain', background: '#f3f5f7' }).png().toBuffer(), top: productTop, left: margin }];
  const draw = async (text, { size, left, top, boxWidth, bottom, color = '#17283c', maximum }) => {
    if (!String(text).trim()) return top;
    const leading = Math.ceil(size * 1.5);
    const available = Math.max(0, Math.floor((bottom - top) / leading));
    const rows = lines(text, Math.floor(boxWidth / size), Math.min(maximum ?? available, available));
    let cursor = top;
    for (const row of rows) {
      if (row) {
        const input = await sharp({ text: { text: `<span foreground="${color}">${xml(row)}</span>`, font: `${family} ${size}`, fontfile, rgba: true } }).png().toBuffer();
        const metadata = await sharp(input).metadata();
        if (metadata.width > boxWidth || cursor + metadata.height > bottom) throw overflow();
        overlays.push({ input, top: cursor, left });
      }
      cursor += leading;
    }
    return cursor;
  };
  const titleTop = Math.round(titleSize * 0.65);
  const afterTitle = await draw(title, { size: titleSize, left: margin, top: titleTop, boxWidth: width - margin * 2, bottom: Math.round(height * (horizontal ? 0.22 : 0.16)), maximum: horizontal ? 1 : 2 });
  await draw(subtitle, { size: Math.round(titleSize * 0.65), left: margin, top: afterTitle + Math.round(titleSize * 0.10), boxWidth: width - margin * 2, bottom: productTop - 6, maximum: 1, color: '#536276' });
  const textLeft = horizontal ? Math.round(width * 0.50) : margin;
  const textWidth = width - textLeft - margin;
  const bottom = Math.round(height * 0.95);
  let cursor = Math.round(height * (horizontal ? 0.26 : 0.56));
  const purposeNames = { cover: '封面', detail: '同型号资料', scene: '到店核对', poster: '门店海报', 'video-cover': '视频封面' };
  const labelSize = Math.max(16, Math.round(width * (horizontal ? 0.018 : 0.020)));
  cursor = await draw(purposeNames[purpose] || '官方产品图排版', { size: labelSize, left: textLeft, top: cursor, boxWidth: textWidth, bottom, color: '#536276' });
  cursor += Math.round(labelSize * 0.3);
  const bodySize = Math.max(16, Math.round(width * (horizontal ? 0.020 : 0.027)));
  for (const text of overlayText) {
    cursor = await draw(text, { size: bodySize, left: textLeft, top: cursor, boxWidth: textWidth, bottom });
    cursor += Math.round(bodySize * 0.4);
  }
  const noteSize = Math.max(13, Math.round(width * (horizontal ? 0.015 : 0.0185)));
  for (const text of limitations) {
    cursor = await draw(text, { size: noteSize, left: textLeft, top: cursor, boxWidth: textWidth, bottom, color: '#536276' });
    cursor += Math.round(noteSize * 0.4);
  }
  return sharp({ create: { width, height, channels: 4, background: '#f3f5f7' } }).composite(overlays).png().toBuffer();
}
