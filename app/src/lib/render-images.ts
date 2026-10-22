// 确定性配图：官方产品图 + 文字排版；AI 不生成产品外观、不生成二维码。
import type { Fact, Platform, TaskSnapshot, Variant } from "./api";

export interface RenderedImage {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
  filename: string;
}

type TaskMeta = TaskSnapshot["task"];

const FONT = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif`;
const PAPER = "#FBF6EF";
const INK = "#181818";
const MUTED = "#6B6257";
const RED = "#C8102E";

function makeCanvas(width: number, height: number, background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 Canvas");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawProduct(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain",
) {
  if (fit === "contain") {
    ctx.fillStyle = "#F5EFE5";
    ctx.fillRect(x, y, w, h);
    const scale = Math.min((w * 0.86) / image.width, (h * 0.86) / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    ctx.save();
    ctx.shadowColor = "rgba(24,24,24,.16)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    return;
  }
  drawCover(ctx, image, x, y, w, h);
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const chars = [...String(text || "").replace(/\s+/g, " ").trim()];
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) return lines;
    } else {
      line = next;
    }
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

function sentences(text: string) {
  return String(text || "")
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstLines(text: string, count = 2) {
  return sentences(text).slice(0, count).join("。");
}

async function drawQr(
  ctx: CanvasRenderingContext2D,
  task: TaskMeta,
  x: number,
  y: number,
  size: number,
  dark = false,
) {
  const qr = task.storeProfile?.qrAssetUrl ? await loadImage(task.storeProfile.qrAssetUrl) : null;
  if (qr) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(qr, x + 6, y + 6, size - 12, size - 12);
    return;
  }
  ctx.strokeStyle = dark ? "rgba(255,255,255,.28)" : "rgba(24,24,24,.22)";
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 7]);
  roundRect(ctx, x, y, size, size, 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = dark ? "rgba(255,255,255,.55)" : "rgba(24,24,24,.45)";
  ctx.font = `400 ${Math.round(size * 0.085)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("门店二维码", x + size / 2, y + size / 2 - 8);
  ctx.fillText("待配置", x + size / 2, y + size / 2 + Math.round(size * 0.13));
  ctx.textAlign = "left";
}

function footer(ctx: CanvasRenderingContext2D, task: TaskMeta, x: number, y: number, width: number, dark = false) {
  ctx.fillStyle = dark ? "rgba(255,255,255,.55)" : "rgba(24,24,24,.45)";
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText(
    task.productAsset ? "官方图 + 排版，产品外观没动" : "文字模板，官方图还没到",
    x,
    y,
  );
  ctx.textAlign = "right";
  ctx.fillText(task.storeName || "华为门店", x + width, y);
  ctx.textAlign = "left";
}

function priceText(task: TaskMeta) {
  return task.priceStatus === "active" ? task.priceLabel : "";
}

function pickFacts(facts: Fact[], variant: Variant, limit = 3) {
  const wanted = new Set(variant.evidenceIds || []);
  const selected = facts.filter((fact) => !wanted.size || wanted.has(fact.id));
  return (selected.length ? selected : facts).slice(0, limit);
}

/* ---------------- 小红书：封面 / 事实卡 / 到店清单 ---------------- */
function xhsCover(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, fit: "cover" | "contain"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(1080, 1440, PAPER);
  const pad = 84;
  const photoH = image ? 790 : 0;
  if (image) {
    drawProduct(ctx, image, 0, 0, 1080, photoH, fit);
    const gradient = ctx.createLinearGradient(0, photoH - 260, 0, photoH);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, photoH - 260, 1080, 260);
  }
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, 1080, 10);

  let y = photoH + 96;
  ctx.fillStyle = RED;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(task.productAsset ? "官方产品图，店里的话" : "文字模板，官方图还没到", pad, y);
  y += 78;
  ctx.fillStyle = INK;
  ctx.font = `700 66px ${FONT}`;
  for (const line of wrap(ctx, variant.title || "门店里的一台电脑", 1080 - pad * 2, 3)) {
    ctx.fillText(line, pad, y);
    y += 82;
  }
  y += 18;
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${FONT}`;
  for (const line of wrap(ctx, firstLines(variant.body, 2), 1080 - pad * 2, 4)) {
    ctx.fillText(line, pad, y);
    y += 48;
  }
  const price = priceText(task);
  if (price) {
    ctx.fillStyle = INK;
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(price, pad, 1440 - 190);
  }
  footer(ctx, task, pad, 1440 - 96, 1080 - pad * 2);
  return canvas;
}

function xhsFacts(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, facts: Fact[]): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(1080, 1440, PAPER);
  const pad = 84;
  ctx.fillStyle = INK;
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText("这版用到的资料", pad, 150);
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText("每条都能翻到原文。没依据的数字不写。", pad, 196);

  let y = 280;
  pickFacts(facts, variant, 3).forEach((fact, index) => {
    ctx.fillStyle = RED;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(`0${index + 1}`, pad, y);
    ctx.fillStyle = INK;
    ctx.font = `500 31px ${FONT}`;
    for (const line of wrap(ctx, String(fact.value || ""), 1080 - pad * 2 - 70, 3)) {
      ctx.fillText(line, pad + 70, y);
      y += 46;
    }
    ctx.fillStyle = "rgba(24,24,24,.45)";
    ctx.font = `400 19px ${FONT}`;
    ctx.fillText(`${String(fact.sourceTitle || "").split("/").pop()} · ${fact.capturedAt || "2026-10-17"}`, pad + 70, y + 6);
    y += 92;
    ctx.strokeStyle = "rgba(24,24,24,.12)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(1080 - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 46;
  });

  if (image) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    drawCover(ctx, image, 640, 980, 400, 330);
    ctx.restore();
  }
  footer(ctx, task, pad, 1440 - 96, 1080 - pad * 2);
  return canvas;
}

async function xhsChecklist(task: TaskMeta, variant: Variant): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = makeCanvas(1080, 1440, PAPER);
  const pad = 84;
  ctx.fillStyle = RED;
  ctx.fillRect(pad, 118, 18, 18);
  ctx.fillStyle = INK;
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText("到店先看这几件", pad, 220);
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(`${task.productShortName} · ${task.scene || "门店体验"}`, pad, 270);

  let y = 380;
  const items = [
    variant.limitations?.[0] || "价格与配置以门店实际为准",
    variant.limitations?.[1] || "常用接口够不够，把设备带来试",
    variant.target ? `下一步：${variant.target}` : "下一步：到店看实物",
  ];
  items.forEach((item, index) => {
    ctx.fillStyle = INK;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(`0${index + 1}`, pad, y);
    ctx.font = `400 31px ${FONT}`;
    let lineY = y;
    for (const line of wrap(ctx, item, 1080 - pad * 2 - 90, 3)) {
      ctx.fillText(line, pad + 78, lineY);
      lineY += 46;
    }
    y = lineY + 80;
  });

  await drawQr(ctx, task, pad, 1120, 200);
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(task.storeName || "华为门店", pad + 230, 1190);
  ctx.fillText(task.storeProfile?.city || "城市未配置", pad + 230, 1232);
  ctx.fillText(task.storeProfile?.phone || "联系方式未配置", pad + 230, 1274);
  footer(ctx, task, pad, 1440 - 96, 1080 - pad * 2);
  return canvas;
}

/* ---------------- 朋友圈：一张图 + 一句白条 ---------------- */
function momentsCard(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, fit: "cover" | "contain"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(1080, 1080, "#F5F2EC");
  const bar = 250;
  if (image) {
    drawProduct(ctx, image, 0, 0, 1080, 1080 - bar, fit);
  } else {
    ctx.fillStyle = "#EDE7DD";
    ctx.fillRect(0, 0, 1080, 1080 - bar);
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("官方图还没到", 540, 380);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 1080 - bar, 1080, bar);
  ctx.fillStyle = INK;
  ctx.font = `500 32px ${FONT}`;
  let y = 1080 - bar + 70;
  for (const line of wrap(ctx, firstLines(variant.body, 1), 1080 - 160, 2)) {
    ctx.fillText(line, 80, y);
    y += 44;
  }
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(`${task.storeName || "华为门店"} · 到店看实物`, 80, 1080 - 38);
  const price = priceText(task);
  if (price) {
    ctx.fillStyle = RED;
    ctx.font = `600 26px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(price, 1000, 1080 - 38);
    ctx.textAlign = "left";
  }
  return canvas;
}

/* ---------------- 公众号：900×383 封面 ---------------- */
function wechatCover(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, fit: "cover" | "contain"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(900, 383, PAPER);
  const pad = 54;
  const photoW = image ? 360 : 0;
  if (image) drawProduct(ctx, image, 900 - photoW, 0, photoW, 383, fit);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, 10, 383);
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText(`${task.storeName || "华为门店"} · 公众号`, pad, 70);
  ctx.fillStyle = INK;
  ctx.font = `700 38px ${FONT}`;
  let y = 128;
  for (const line of wrap(ctx, variant.title || "门店内容", 900 - photoW - pad * 2, 3)) {
    ctx.fillText(line, pad, y);
    y += 48;
  }
  ctx.fillStyle = MUTED;
  ctx.font = `400 18px ${FONT}`;
  y += 12;
  for (const line of wrap(ctx, firstLines(variant.body, 1), 900 - photoW - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 28;
  }
  ctx.fillStyle = "rgba(24,24,24,.4)";
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText("资料截至 2026-10-17，以门店实际为准", pad, 350);
  return canvas;
}

/* ---------------- 门店海报：深色 + 红块 ---------------- */
async function posterCard(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, fit: "cover" | "contain"): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = makeCanvas(1242, 1656, "#0E0E0E");
  const pad = 96;
  if (image) {
    drawProduct(ctx, image, 0, 0, 1242, 980, fit);
    const gradient = ctx.createLinearGradient(0, 520, 0, 980);
    gradient.addColorStop(0, "rgba(14,14,14,0)");
    gradient.addColorStop(1, "rgba(14,14,14,1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 520, 1242, 460);
  } else {
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, 0, 1242, 980);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.font = `400 30px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("官方图还没到", 621, 500);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = RED;
  ctx.fillRect(0, 940, 1242, 26);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText("门店实拍 / 官方图", pad, 1050);

  let y = 1150;
  ctx.fillStyle = "#fff";
  ctx.font = `700 86px ${FONT}`;
  for (const line of wrap(ctx, variant.title || "", 1242 - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 102;
  }
  const price = priceText(task);
  if (price) {
    ctx.fillStyle = RED;
    ctx.font = `700 82px ${FONT}`;
    ctx.fillText(price, pad, y + 44);
    y += 92;
  }
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = `400 30px ${FONT}`;
  for (const line of wrap(ctx, variant.body || "", 1242 - pad * 2 - 300, 4)) {
    ctx.fillText(line, pad, y + 50);
    y += 44;
  }
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(`${task.storeName || "华为门店"} · ${task.storeProfile?.city || "城市未配置"}`, pad, 1600);
  await drawQr(ctx, task, 1242 - pad - 230, 1320, 230, true);
  return canvas;
}

/* ---------------- 视频号：9:16 封面 ---------------- */
function videoCover(image: HTMLImageElement | null, task: TaskMeta, variant: Variant, fit: "cover" | "contain"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(1080, 1920, "#0E0E0E");
  const pad = 84;
  const photoH = image ? 1080 : 0;
  if (image) {
    drawProduct(ctx, image, 0, 0, 1080, photoH, fit);
    const gradient = ctx.createLinearGradient(0, photoH - 420, 0, photoH + 120);
    gradient.addColorStop(0, "rgba(14,14,14,0)");
    gradient.addColorStop(1, "rgba(14,14,14,1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, photoH - 420, 1080, 540);
  }
  let y = photoH + 110;
  ctx.fillStyle = RED;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText("视频号 · 45–60 秒", pad, y);
  y += 90;
  ctx.fillStyle = "#fff";
  ctx.font = `700 78px ${FONT}`;
  for (const line of wrap(ctx, variant.title || "", 1080 - pad * 2, 3)) {
    ctx.fillText(line, pad, y);
    y += 94;
  }
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = `400 30px ${FONT}`;
  y += 20;
  for (const line of wrap(ctx, firstLines(variant.body, 2), 1080 - pad * 2, 4)) {
    ctx.fillText(line, pad, y);
    y += 46;
  }
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(`${task.storeName || "华为门店"} · 到店看实物`, pad, 1800);
  return canvas;
}

function toImage(canvas: HTMLCanvasElement, platform: Platform, angle: string, index: number, label: string): RenderedImage {
  return {
    id: `${platform}-${angle}-${index}`,
    label,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    filename: `${platform}-${angle}-${index}.png`,
  };
}

export async function renderImages({
  platform,
  variant,
  task,
  facts,
}: {
  platform: Platform;
  variant: Variant;
  task: TaskMeta;
  facts: Fact[];
}): Promise<RenderedImage[]> {
  const image = await loadImage(task.productAsset || "");
  const fit = task.productAssetFit || "cover";
  if (platform === "xiaohongshu") {
    return [
      toImage(xhsCover(image, task, variant, fit), platform, variant.angle, 1, "封面 1080×1440"),
      toImage(xhsFacts(image, task, variant, facts), platform, variant.angle, 2, "事实卡 1080×1440"),
      toImage(await xhsChecklist(task, variant), platform, variant.angle, 3, "到店清单 1080×1440"),
    ];
  }
  if (platform === "moments") {
    return [toImage(momentsCard(image, task, variant, fit), platform, variant.angle, 1, "朋友圈 1080×1080")];
  }
  if (platform === "wechat-mp") {
    return [toImage(wechatCover(image, task, variant, fit), platform, variant.angle, 1, "封面 900×383")];
  }
  if (platform === "poster") {
    return [toImage(await posterCard(image, task, variant, fit), platform, variant.angle, 1, "海报 1242×1656")];
  }
  return [toImage(videoCover(image, task, variant, fit), platform, variant.angle, 1, "视频封面 1080×1920")];
}

export function downloadImage(image: RenderedImage, prefix = "huacai") {
  const link = document.createElement("a");
  link.href = image.dataUrl;
  link.download = `${prefix}-${image.filename}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
