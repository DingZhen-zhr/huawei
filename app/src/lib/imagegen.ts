// 按平台生成配图：每个平台一套排版与配色（Canvas，无外部依赖）
export type PlatformId = "xiaohongshu" | "moments" | "wechat-mp" | "poster";

export interface ImageAsset {
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

export const IMAGE_SPEC: Record<PlatformId, { label: string; width: number; height: number; count: number; note: string }> = {
  xiaohongshu: { label: "小红书", width: 1080, height: 1440, count: 3, note: "3:4 · 3 张" },
  moments: { label: "朋友圈", width: 1080, height: 1080, count: 3, note: "1:1 · 3 张" },
  "wechat-mp": { label: "公众号", width: 900, height: 383, count: 2, note: "封面 900×383 + 正文 16:9" },
  poster: { label: "门店海报", width: 1242, height: 1656, count: 1, note: "3:4 · 1242 宽" },
};

const THEME = {
  xhs: { paper: "#FBF6EF", ink: "#181818", accent: "#C8102E", muted: "#6B6257", line: "rgba(0,0,0,.10)" },
  moments: { paper: "#FFFFFF", ink: "#1F1F1F", accent: "#C8102E", muted: "#8A8A8A", line: "rgba(0,0,0,.08)" },
  wechat: { paper: "#FFFFFF", ink: "#111827", accent: "#C8102E", muted: "#6B7280", line: "rgba(0,0,0,.10)" },
  poster: { paper: "#0E0E0E", ink: "#FFFFFF", accent: "#E11D2E", muted: "#B9B9B9", line: "rgba(255,255,255,.18)" },
};
const FONT = `"PingFang SC", "Hiragino Sans GB", system-ui, sans-serif`;

function makeCanvas(w: number, h: number, bg: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = [...String(text || "").replace(/\s+/g, " ").trim()];
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else line = next;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface CardContent {
  title: string;
  body: string;
  price?: string;
}

const sentences = (body: string) =>
  body
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

const toUrl = (c: HTMLCanvasElement) => c.toDataURL("image/png");

/* ---------------- 小红书：纸面笔记风 ---------------- */
function redbook(bg: HTMLImageElement | undefined, c: CardContent, index: number, total: number): HTMLCanvasElement {
  const t = THEME.xhs;
  const w = 1080;
  const h = 1440;
  const { c: canvas, ctx } = makeCanvas(w, h, t.paper);
  const pad = 84;
  const photoH = bg ? 800 : 0;

  if (bg) {
    drawCover(ctx, bg, 0, 0, w, photoH);
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(0, photoH - 120, w, 120);
  }
  ctx.fillStyle = t.paper;
  ctx.fillRect(0, photoH, w, h - photoH);
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, w, 8);

  // 页码
  ctx.fillStyle = bg ? "#fff" : t.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`${index + 1} / ${total}`, w - pad, bg ? 150 : 60);
  ctx.textAlign = "left";

  let y = photoH + 96;
  ctx.fillStyle = t.accent;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(index === 0 ? "分享笔记" : index === 1 ? "为什么是它" : "到店看看", pad, y);

  y += 84;
  ctx.fillStyle = t.ink;
  ctx.font = `700 68px ${FONT}`;
  for (const line of wrap(ctx, c.title, w - pad * 2, 3)) {
    ctx.fillText(line, pad, y);
    y += 84;
  }

  y += 26;
  ctx.fillStyle = t.muted;
  ctx.font = `400 32px ${FONT}`;
  const bodyLines = wrap(ctx, sentences(c.body).slice(0, 2).join("。"), w - pad * 2, 3);
  for (const line of bodyLines) {
    ctx.fillText(line, pad, y);
    y += 52;
  }

  // 标签
  if (index === 0) {
    const tags = ["#学生党", "#网课日常", "#华为PC"];
    let tx = pad;
    y += 30;
    ctx.font = `500 26px ${FONT}`;
    for (const tag of tags) {
      const tw = ctx.measureText(tag).width + 44;
      ctx.strokeStyle = t.line;
      ctx.lineWidth = 2;
      roundRect(ctx, tx, y - 32, tw, 52, 26);
      ctx.stroke();
      ctx.fillStyle = t.muted;
      ctx.fillText(tag, tx + 22, y + 4);
      tx += tw + 18;
    }
  }

  // 价格
  if (c.price) {
    ctx.fillStyle = t.ink;
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(c.price, pad, h - 210);
  }

  // 页脚
  ctx.fillStyle = t.muted;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText("华为门店 · 到店体验", pad, h - 96);
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText("信息以门店实际为准", pad, h - 56);
  return canvas;
}

/* ---------------- 朋友圈：一张图 + 一句白条 ---------------- */
function moments(bg: HTMLImageElement | undefined, c: CardContent, index: number): HTMLCanvasElement {
  const t = THEME.moments;
  const s = 1080;
  const { c: canvas, ctx } = makeCanvas(s, s, t.paper);
  const bar = 250;

  if (bg) {
    drawCover(ctx, bg, 0, 0, s, s - bar);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, s - bar, s, bar);
  } else {
    ctx.fillStyle = "#F5F2EC";
    ctx.fillRect(0, 0, s, s - bar);
  }

  const parts = sentences(c.body);
  const text = parts[index] || parts[parts.length - 1] || c.title;
  ctx.fillStyle = t.ink;
  ctx.font = `600 34px ${FONT}`;
  const lines = wrap(ctx, text, s - 160, 2);
  let y = s - bar + 70;
  for (const line of lines) {
    ctx.fillText(line, 80, y);
    y += 46;
  }
  ctx.fillStyle = t.muted;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText("华为门店", 80, s - 38);
  if (c.price) {
    ctx.textAlign = "right";
    ctx.fillStyle = t.accent;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(c.price, s - 80, s - 38);
    ctx.textAlign = "left";
  }
  return canvas;
}

/* ---------------- 公众号：左文右图 ---------------- */
function wechat(bg: HTMLImageElement | undefined, c: CardContent, w: number, h: number, kicker: string): HTMLCanvasElement {
  const t = THEME.wechat;
  const { c: canvas, ctx } = makeCanvas(w, h, t.paper);
  const pad = Math.round(w * 0.06);
  const photoW = bg ? Math.round(w * 0.38) : 0;

  if (bg) drawCover(ctx, bg, w - photoW, 0, photoW, h);
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, 10, h);

  ctx.fillStyle = t.muted;
  ctx.font = `500 ${Math.round(w * 0.017)}px ${FONT}`;
  ctx.fillText(kicker, pad, pad + w * 0.014);

  const textW = w - photoW - pad * 2;
  let y = pad + w * 0.075;
  ctx.fillStyle = t.ink;
  ctx.font = `700 ${Math.round(w * 0.045)}px ${FONT}`;
  for (const line of wrap(ctx, c.title, textW, 3)) {
    ctx.fillText(line, pad, y);
    y += w * 0.052;
  }

  ctx.fillStyle = t.muted;
  ctx.font = `400 ${Math.round(w * 0.022)}px ${FONT}`;
  for (const line of wrap(ctx, sentences(c.body)[0] || "", textW, 2)) {
    ctx.fillText(line, pad, y + w * 0.01);
    y += w * 0.032;
  }

  if (c.price) {
    ctx.fillStyle = t.accent;
    ctx.font = `700 ${Math.round(w * 0.028)}px ${FONT}`;
    ctx.fillText(c.price, pad, h - pad * 0.9);
  }
  return canvas;
}

/* ---------------- 门店海报：深色 + 红块 ---------------- */
function poster(bg: HTMLImageElement | undefined, c: CardContent): HTMLCanvasElement {
  const t = THEME.poster;
  const w = 1242;
  const h = 1656;
  const { c: canvas, ctx } = makeCanvas(w, h, t.paper);
  const pad = 96;

  if (bg) {
    drawCover(ctx, bg, 0, 0, w, 980);
    const g = ctx.createLinearGradient(0, 520, 0, 980);
    g.addColorStop(0, "rgba(14,14,14,0)");
    g.addColorStop(1, "rgba(14,14,14,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 520, w, 460);
  }

  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 940, w, 26);

  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("HUAWEI STORE · 限时到店", pad, 1060);

  let y = 1160;
  ctx.fillStyle = t.ink;
  ctx.font = `700 92px ${FONT}`;
  for (const line of wrap(ctx, c.title, w - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 108;
  }

  if (c.price) {
    ctx.fillStyle = t.accent;
    ctx.font = `700 118px ${FONT}`;
    ctx.fillText(c.price, pad, y + 40);
    y += 100;
  }

  ctx.fillStyle = t.muted;
  ctx.font = `400 34px ${FONT}`;
  for (const line of wrap(ctx, sentences(c.body).slice(0, 2).join("。"), w - pad * 2 - 300, 2)) {
    ctx.fillText(line, pad, y + 60);
    y += 52;
  }

  ctx.fillStyle = t.muted;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText("活动以门店当日公示为准", pad, h - 90);

  // 二维码只能来自门店真实资产；这里留白，不用程序画假码。
  const qr = 260;
  const qx = w - pad - qr;
  const qy = h - pad - qr;
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  roundRect(ctx, qx, qy, qr, qr, 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = t.muted;
  ctx.font = `400 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("门店二维码待配置", qx + qr / 2, qy + qr / 2 - 8);
  ctx.fillText("请上传真实素材", qx + qr / 2, qy + qr / 2 + 30);
  ctx.textAlign = "left";
  return canvas;
}

export function renderPlatformImages(platform: PlatformId, content: CardContent, bg?: HTMLImageElement): ImageAsset[] {
  if (platform === "wechat-mp") {
    return [
      {
        label: "封面 900×383",
        dataUrl: toUrl(wechat(bg, content, 900, 383, "华为门店 · 公众号")),
        width: 900,
        height: 383,
      },
      {
        label: "正文配图 1080×608",
        dataUrl: toUrl(wechat(bg, content, 1080, 608, "正文配图 · 16:9")),
        width: 1080,
        height: 608,
      },
    ];
  }

  if (platform === "poster") {
    return [{ label: "海报 1242×1656", dataUrl: toUrl(poster(bg, content)), width: 1242, height: 1656 }];
  }

  if (platform === "moments") {
    return [0, 1, 2].map((i) => ({
      label: `朋友圈 ${i + 1} · 1080×1080`,
      dataUrl: toUrl(moments(bg, content, i)),
      width: 1080,
      height: 1080,
    }));
  }

  return [0, 1, 2].map((i) => ({
    label: `小红书 ${i + 1} · 1080×1440`,
    dataUrl: toUrl(redbook(bg, content, i, 3)),
    width: 1080,
    height: 1440,
  }));
}

export function downloadAsset(a: ImageAsset, index: number) {
  const link = document.createElement("a");
  link.href = a.dataUrl;
  link.download = `huacai-${Date.now()}-${index + 1}.png`;
  link.click();
}
