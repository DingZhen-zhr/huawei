// 内容任务：后台执行、SSE 进度、部分成功与单渠道重试。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getProduct, getConflict } from "./ledger.mjs";
import { getTaskCard } from "./task-cards.mjs";
import { generatePlatformVariants, evidenceFor, imagePlanFor, copyTextFor, PLATFORM_LABEL, ANGLE_LABEL } from "./generator.mjs";
import { generateWithModel, modelEnabled, contentModel, repairVariant } from "./model-writer.mjs";
import { verifyContent } from "./verifier.mjs";
import { analyzeCopy } from "./copy-quality.mjs";
import { dbEnabled, dbSaveTask, dbLoadTask, dbListTasks } from "./db.mjs";

const DB = dbEnabled();
const INLINE = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.HC_INLINE_TASKS === "true");
const DATA_DIR = process.env.HC_RUNTIME_DIR
  ? path.resolve(process.env.HC_RUNTIME_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "runtime");
const FILE = path.join(DATA_DIR, "tasks.json");
const tasks = new Map();
const events = new Map();
const subscribers = new Map();
const timers = new Set();

const PLATFORMS = ["xiaohongshu", "moments", "wechat-mp", "poster", "video"];
const STAGES = [
  { stage: "retrieving", label: "翻资料", percent: 18 },
  { stage: "planning", label: "定结构", percent: 34 },
  { stage: "writing", label: "在写五个渠道", percent: 58 },
  { stage: "reviewing", label: "顺口吻", percent: 78 },
  { stage: "verifying", label: "核数字", percent: 92 },
];

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (DB || !existsSync(FILE)) return;
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf-8"));
    for (const row of rows) {
      if (row?.id) {
        tasks.set(row.id, row);
        events.set(row.id, Array.isArray(row.events) ? row.events : []);
      }
    }
  } catch {
    // 运行时文件损坏时不覆盖用户内容，让新任务继续可用。
  }
}

function persist() {
  if (DB) return;
  ensureDir();
  const rows = [...tasks.values()]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 300)
    .map((task) => ({ ...task, events: events.get(task.id)?.slice(-100) || [] }));
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2));
  renameSync(tmp, FILE);
}

export async function persistTask(task) {
  if (!DB) { persist(); return; }
  await dbSaveTask(task, events.get(task.id) || []);
}

function pruneCache() {
  if (tasks.size <= 200) return;
  const keep = [...tasks.values()]
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, 200)
    .map((task) => task.id);
  const allowed = new Set(keep);
  for (const id of tasks.keys()) {
    if (!allowed.has(id)) {
      tasks.delete(id);
      events.delete(id);
    }
  }
}

function broadcast(taskId, event) {
  const list = subscribers.get(taskId);
  if (!list) return;
  for (const res of list) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* subscriber disconnected */
    }
  }
}

function addEvent(taskId, event) {
  const row = { ...event, at: new Date().toISOString() };
  const list = events.get(taskId) || [];
  list.push(row);
  events.set(taskId, list.slice(-200));
  broadcast(taskId, row);
  if (!DB) persist();
  return row;
}

function setStage(task, stageKey) {
  const stage = STAGES.find((s) => s.stage === stageKey);
  if (!stage) return;
  task.progress = { ...stage, updatedAt: new Date().toISOString() };
  task.status = "running";
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, { type: "stage", ...stage });
}

function evidenceForText(product, text) {
  const numbers = new Set(String(text || "").match(/\d+(?:\.\d+)?/g) || []);
  const matched = (product.facts || [])
    .filter((fact) => fact.field !== "price")
    .filter((fact) => [...String(fact.value || "").matchAll(/\d+(?:\.\d+)?/g)].some((m) => numbers.has(m[0])))
    .slice(0, 6);
  return matched.length ? matched : evidenceFor(product);
}

function finalizeVariant(task, product, variant, platform, generatedBy) {
  const copyText = copyTextFor(variant);
  const verification = verifyContent(copyText, product.id, { platform });
  const copyQuality = analyzeCopy(copyText);
  return {
    ...variant,
    id: randomUUID(),
    taskId: task.id,
    platform,
    platformLabel: PLATFORM_LABEL[platform],
    angleLabel: ANGLE_LABEL[variant.angle] || variant.angle,
    audience: variant.audience || task.audience,
    scene: variant.scene || task.scene,
    target: variant.target || task.target,
    model: product.name,
    copyText,
    status: verification.blocked ? "blocked" : "ready",
    verification,
    copyQuality,
    editBurden: verification.blocked ? "heavy" : copyQuality.issues.length ? "light" : "none",
    verifiedAt: verification.checkedAt,
    recommended: variant.angle === "pain",
    generatedBy,
    evidence: variant.evidence?.length ? variant.evidence : evidenceForText(product, copyText),
    evidenceIds: variant.evidenceIds?.length
      ? variant.evidenceIds
      : (variant.evidence?.length ? variant.evidence : evidenceForText(product, copyText)).map((fact) => fact.id),
    imagePlan: variant.imagePlan?.length ? variant.imagePlan : imagePlanFor(product, platform, task.realDetail?.text, task.target),
    priceIncluded: product.price?.status === "active" && /¥\s*[\d,]/.test(copyText),
  };
}

async function repairBlocked(task, product, platform, variants) {
  if (!modelEnabled() || process.env.HC_MODEL_REPAIR === "false") return variants;
  if (INLINE && process.env.HC_MODEL_REPAIR !== "true") return variants;
  const out = [];
  let repaired = 0;
  for (const variant of variants) {
    if (variant.verification.blocked && repaired < 2) {
      try {
        const fixed = await repairVariant({
          product,
          platform,
          variant,
          reasons: variant.verification.reasons.slice(0, 4),
        });
        const merged = {
          ...variant,
          ...fixed,
          title: fixed.title || variant.title,
          body: fixed.body || variant.body,
          evidence: variant.evidence,
          limitations: variant.limitations,
          imagePlan: variant.imagePlan,
        };
        if (!merged.body || String(merged.body).length < 20) {
          out.push(variant);
          continue;
        }
        const next = finalizeVariant(task, product, merged, platform, "model-repaired");
        if (!next.verification.blocked) {
          repaired += 1;
          out.push(next);
          continue;
        }
      } catch {
        // 修复失败就保留被拦版本，不把失败伪装成通过。
      }
    }
    out.push(variant);
  }
  return out;
}

async function buildPlatform(task, product, platform) {
  const input = {
    product,
    platform,
    realDetail: task.realDetail.text,
    audience: task.audience,
    scene: task.scene,
    target: task.target,
  };
  if (modelEnabled()) {
    try {
      const made = await generateWithModel({ ...input, store: task.storeProfile });
      const finalized = made.map((variant) => finalizeVariant(task, product, variant, platform, "model"));
      return await repairBlocked(task, product, platform, finalized);
    } catch (error) {
      task.fallbacks = [
        ...(task.fallbacks || []),
        { platform, message: String(error?.message || "模型写作失败").slice(0, 200), at: new Date().toISOString() },
      ];
      addEvent(task.id, {
        type: "notice",
        platform,
        message: `${PLATFORM_LABEL[platform]} 模型写作未通过，已回退规则稿`,
      });
    }
  }
  return generatePlatformVariants(input).map((variant) => finalizeVariant(task, product, variant, platform, "rules"));
}

async function runPlatforms(taskId, platforms = PLATFORMS) {
  const task = tasks.get(taskId);
  if (!task) throw new Error("这条内容找不到了");
  const product = getProduct(task.productId);
  if (!product) throw new Error("产品事实不存在");

  task.status = "running";
  task.errors = (task.errors || []).filter((e) => !platforms.includes(e.platform));
  task.fallbacks = (task.fallbacks || []).filter((f) => !platforms.includes(f.platform));
  task.updatedAt = new Date().toISOString();
  for (const stage of STAGES.slice(0, 2)) setStage(task, stage.stage);
  setStage(task, "writing");

  const variantMap = new Map((task.variants || []).map((v) => [`${v.platform}:${v.angle}`, v]));
  const results = await Promise.all(
    platforms.map(async (platform) => {
      try {
        return { platform, made: await buildPlatform(task, product, platform) };
      } catch (error) {
        return { platform, error };
      }
    }),
  );

  for (const result of results) {
    const { platform } = result;
    if (result.error) {
      const row = {
        platform,
        label: PLATFORM_LABEL[platform],
        stage: "writing",
        code: "PLATFORM_FAILED",
        message: result.error?.message || "这个渠道没写出来",
        retryable: true,
      };
      task.errors.push(row);
      addEvent(task.id, { type: "error", ...row });
    } else {
      const made = result.made;
      for (const v of made) variantMap.set(`${v.platform}:${v.angle}`, v);
      addEvent(task.id, {
        type: "variant",
        platform,
        label: PLATFORM_LABEL[platform],
        status: made.some((v) => v.status === "blocked") ? "blocked" : "ready",
        variantIds: made.map((v) => v.id),
        count: made.length,
        generatedBy: made[0]?.generatedBy,
      });
    }
    task.variants = [...variantMap.values()];
    if (!DB) persist();
  }

  setStage(task, "reviewing");
  setStage(task, "verifying");
  const current = [...variantMap.values()];
  const blocked = current.filter((v) => v.status === "blocked");
  const failedPlatforms = new Set(task.errors.map((e) => e.platform));
  task.generationMode = (() => {
    const kinds = new Set(current.map((v) => (v.generatedBy === "model-repaired" ? "model" : v.generatedBy)));
    if (kinds.size === 1) return kinds.has("model") ? `model:${contentModel()}` : "rules-v1";
    return "mixed";
  })();
  task.status = failedPlatforms.size ? "partial" : "done";
  task.progress = {
    stage: "done",
    label: blocked.length ? `写完了，${blocked.length} 条要改` : "五个渠道都写好了",
    percent: 100,
    updatedAt: new Date().toISOString(),
  };
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, {
    type: "done",
    status: task.status,
    blocked: blocked.length,
    errors: task.errors.length,
    fallbacks: (task.fallbacks || []).length,
    generationMode: task.generationMode,
  });
  await persistTask(task);
}

function queueRun(taskId, platforms) {
  const timer = setTimeout(async () => {
    timers.delete(timer);
    try {
      await runPlatforms(taskId, platforms);
    } catch (error) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = "failed";
        task.errors = [...(task.errors || []), { code: "TASK_FAILED", message: error.message, retryable: false }];
        task.updatedAt = new Date().toISOString();
        addEvent(taskId, { type: "error", code: "TASK_FAILED", message: error.message, retryable: false });
        addEvent(taskId, { type: "done", status: "failed" });
        await persistTask(task);
      }
    }
  }, 60);
  timers.add(timer);
}

export async function createTask({ store, body = {} }) {
  const card = body.taskCardId ? getTaskCard(body.taskCardId) : null;
  const product = getProduct(body.productId || card?.productId);
  if (!product) throw Object.assign(new Error("没有这个型号的资料"), { status: 400, code: "PRODUCT_NOT_FOUND" });

  const real = body.realDetail || {};
  const detailText = String(real.text || "").trim();
  if (!detailText || real.source !== "sales_provided" || real.confirmed !== true) {
    throw Object.assign(new Error("还差一句店里的事。写一句当时发生了什么，再生成。"), {
      status: 400,
      code: "REAL_DETAIL_REQUIRED",
      detail: { field: "realDetail", hint: card?.requiredDetailHint || "旧电脑哪里不好用？顾客每天怎么带着它？" },
    });
  }

  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    storeId: store.id,
    storeName: store.name,
    productId: product.id,
    productName: product.name,
    productShortName: product.shortName,
    productAsset: product.asset,
    taskCardId: card?.id || null,
    brief: String(body.brief || "").trim(),
    audience: String(body.audience || card?.audience || "").trim(),
    scene: String(body.scene || card?.scene || "").trim(),
    target: String(body.target || card?.target || "到店看实物").trim(),
    realDetail: { text: detailText, source: "sales_provided", confirmed: true },
    questionAnswers: body.questionAnswers || {},
    storeProfile: {
      name: store.name,
      city: store.profile?.city || "",
      phone: store.profile?.phone || "",
      businessHours: store.profile?.businessHours || "",
      voiceTone: store.profile?.voiceTone || "",
    },
    status: "queued",
    progress: { stage: "queued", label: "等着写", percent: 5 },
    generationMode: modelEnabled() ? `queued:${contentModel()}` : "rules-v1",
    fallbacks: [],
    variants: [],
    evidence: product.facts.filter((f) => f.field !== "price").slice(0, 8),
    conflicts: getConflict(product.id) ? [getConflict(product.id)] : [],
    errors: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  tasks.set(task.id, task);
  events.set(task.id, []);
  pruneCache();
  addEvent(task.id, { type: "stage", stage: "queued", label: "等着写", percent: 5 });
  if (DB) await persistTask(task);
  else persist();

  if (INLINE) {
    try {
      await runPlatforms(task.id);
    } catch (error) {
      task.status = "failed";
      task.errors = [...(task.errors || []), { code: "TASK_FAILED", message: error.message, retryable: false }];
      task.updatedAt = new Date().toISOString();
      addEvent(task.id, { type: "error", code: "TASK_FAILED", message: error.message, retryable: false });
      addEvent(task.id, { type: "done", status: "failed" });
      await persistTask(task);
    }
    return { taskId: task.id, status: task.status };
  }
  queueRun(task.id);
  return { taskId: task.id, status: "queued" };
}

async function expireStaleTask(task) {
  if (!DB || !task || !["queued", "running"].includes(task.status)) return task;
  const age = Date.now() - new Date(task.updatedAt || task.createdAt || 0).getTime();
  if (!Number.isFinite(age) || age < 10 * 60 * 1000) return task;
  task.status = "failed";
  task.errors = [
    ...(task.errors || []),
    { code: "TASK_STALE", message: "任务中断（服务重启或超时），可以单渠道重试或重新生成。", retryable: true },
  ];
  task.progress = { stage: "failed", label: "写了一半，断了，重试一下", percent: 100, updatedAt: new Date().toISOString() };
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, { type: "error", code: "TASK_STALE", message: "写了一半，断了，重试一下", retryable: true });
  await persistTask(task);
  return task;
}

export async function ensureTask(taskId, storeId) {
  const cached = getTask(taskId, storeId);
  if (cached) return expireStaleTask(cached);
  if (!DB) return null;
  const row = await dbLoadTask(taskId);
  if (!row) return null;
  if (storeId && row.task.storeId !== storeId) return null;
  tasks.set(taskId, row.task);
  events.set(taskId, row.events || []);
  pruneCache();
  return expireStaleTask(row.task);
}

export function getTask(taskId, storeId) {
  const task = tasks.get(taskId);
  if (!task) return null;
  if (storeId && task.storeId !== storeId) return null;
  return task;
}

export async function getTaskSnapshot(taskId, storeId) {
  const task = await ensureTask(taskId, storeId);
  if (!task) return null;
  const current = task.variants || [];
  const byPlatform = Object.fromEntries(
    PLATFORMS.map((platform) => {
      const list = current.filter((v) => v.platform === platform);
      return [
        platform,
        {
          platform,
          label: PLATFORM_LABEL[platform],
          variants: list,
          recommended: list.find((v) => v.recommended) || list[0] || null,
          status: list.length ? (list.some((v) => v.status === "blocked") ? "blocked" : "ready") : "waiting",
        },
      ];
    }),
  );
  const product = getProduct(task.productId);
  const blocked = current.filter((v) => v.status === "blocked");
  return {
    task: {
      id: task.id,
      status: task.status,
      progress: task.progress,
      productId: task.productId,
      productName: task.productName,
      productShortName: task.productShortName,
      productAsset: task.productAsset,
      productAssetFit: product?.assetFit || "cover",
      productFamily: product?.family || "",
      hasAssets: Boolean(product?.hasAssets),
      priceLabel: product?.price?.label || "",
      priceStatus: product?.price?.status || "missing",
      snapshotDate: product?.snapshotDate || "2026-10-17",
      audience: task.audience,
      scene: task.scene,
      target: task.target,
      realDetail: task.realDetail,
      brief: task.brief,
      storeName: task.storeName,
      storeProfile: task.storeProfile || {},
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      generationMode: task.generationMode,
      fallbacks: task.fallbacks || [],
    },
    variants: current,
    channels: byPlatform,
    assets: [],
    evidence: task.evidence || [],
    conflicts: task.conflicts || [],
    progress: task.progress,
    errors: task.errors || [],
    blockedCount: blocked.length,
  };
}

function taskSummary(t) {
  return {
    id: t.id,
    productName: t.productName,
    productShortName: t.productShortName,
    status: t.status,
    progress: t.progress,
    createdAt: t.createdAt,
    blockedCount: (t.variants || []).filter((v) => v.status === "blocked").length,
    readyCount: (t.variants || []).filter((v) => v.status === "ready").length,
  };
}

export async function listTasks(storeId, limit = 12) {
  if (DB) {
    const rows = await dbListTasks(storeId, limit);
    return rows.map(taskSummary);
  }
  return [...tasks.values()]
    .filter((t) => !storeId || t.storeId === storeId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(taskSummary);
}

export function subscribe(taskId, res) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  for (const event of events.get(taskId) || []) send(event);
  const list = subscribers.get(taskId) || new Set();
  list.add(res);
  subscribers.set(taskId, list);
  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      /* ignore */
    }
  }, 15000);
  res.on("close", () => {
    clearInterval(heartbeat);
    list.delete(res);
    if (!list.size) subscribers.delete(taskId);
  });
}

export async function retryPlatform(taskId, platform, storeId) {
  const task = await ensureTask(taskId, storeId);
  if (!task) throw Object.assign(new Error("这条内容找不到了"), { status: 404 });
  if (!PLATFORMS.includes(platform)) throw Object.assign(new Error("未知渠道"), { status: 400 });
  task.variants = (task.variants || []).filter((v) => v.platform !== platform);
  task.errors = (task.errors || []).filter((e) => e.platform !== platform);
  task.status = "queued";
  task.progress = { stage: "queued", label: "重写这个渠道", percent: 10 };
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, { type: "stage", stage: "queued", label: `重试${PLATFORM_LABEL[platform]}`, percent: 10 });
  if (DB) await persistTask(task);
  if (INLINE) {
    await runPlatforms(task.id, [platform]);
    return { taskId, platform, status: task.status };
  }
  queueRun(task.id, [platform]);
  return { taskId, platform, status: "queued" };
}

export async function updateVariant(taskId, variantId, patch, storeId) {
  const task = await ensureTask(taskId, storeId);
  if (!task) throw Object.assign(new Error("这条内容找不到了"), { status: 404 });
  const variant = (task.variants || []).find((v) => v.id === variantId);
  if (!variant) throw Object.assign(new Error("版本不存在"), { status: 404 });
  for (const key of ["title", "body", "tags", "cta", "script", "shotList"]) {
    if (patch[key] !== undefined) variant[key] = patch[key];
  }
  variant.copyText = copyTextFor(variant);
  variant.verification = verifyContent(variant.copyText, task.productId, { platform: variant.platform });
  variant.copyQuality = analyzeCopy(variant.copyText);
  variant.status = variant.verification.blocked ? "blocked" : "ready";
  variant.editBurden = variant.verification.blocked ? "heavy" : variant.copyQuality.issues.length ? "light" : "none";
  variant.updatedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, { type: "variant", platform: variant.platform, status: variant.status, variantIds: [variant.id] });
  await persistTask(task);
  return variant;
}

function recoverInterruptedTasks() {
  if (DB) return;
  const interrupted = [...tasks.values()].filter((task) => ["queued", "running"].includes(task.status));
  if (!interrupted.length) return;
  for (const task of interrupted) {
    const existingPlatforms = new Set((task.variants || []).map((variant) => variant.platform));
    const missing = PLATFORMS.filter((platform) => !existingPlatforms.has(platform));
    if (!missing.length) {
      task.status = "done";
      task.progress = { stage: "done", label: "五个渠道都写好了", percent: 100, updatedAt: new Date().toISOString() };
      task.updatedAt = new Date().toISOString();
      addEvent(task.id, { type: "done", status: "done", recovered: true });
      continue;
    }
    task.status = "queued";
    task.progress = { stage: "queued", label: "服务重启了，接着写没写完的", percent: 5, updatedAt: new Date().toISOString() };
    task.updatedAt = new Date().toISOString();
    addEvent(task.id, { type: "stage", stage: "queued", label: "服务重启了，接着写没写完的", percent: 5, recovered: true });
    queueRun(task.id, missing);
  }
  persist();
}

load();
recoverInterruptedTasks();

export { PLATFORMS, PLATFORM_LABEL };
