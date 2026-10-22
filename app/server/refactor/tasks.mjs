// 内容任务：后台执行、SSE 进度、部分成功与单渠道重试。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getProduct, getConflict } from "./ledger.mjs";
import { getTaskCard } from "./task-cards.mjs";
import { generatePlatformVariants, copyTextFor, PLATFORM_LABEL } from "./generator.mjs";
import { verifyContent } from "./verifier.mjs";
import { analyzeCopy } from "./copy-quality.mjs";

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
  { stage: "retrieving", label: "查官方资料", percent: 18 },
  { stage: "planning", label: "排内容结构", percent: 34 },
  { stage: "writing", label: "写五渠道", percent: 58 },
  { stage: "reviewing", label: "过门店口吻", percent: 78 },
  { stage: "verifying", label: "核数字与承诺", percent: 92 },
];

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (!existsSync(FILE)) return;
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
  ensureDir();
  const rows = [...tasks.values()]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 300)
    .map((task) => ({ ...task, events: events.get(task.id)?.slice(-100) || [] }));
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2));
  renameSync(tmp, FILE);
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
  persist();
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

function createVariant(task, product, input, platform) {
  const variants = generatePlatformVariants({
    product,
    platform,
    realDetail: task.realDetail.text,
    audience: task.audience,
    scene: task.scene,
    target: task.target,
  });
  return variants.map((v) => {
    const copyText = copyTextFor(v);
    const verification = verifyContent(copyText, product.id, { platform });
    const copyQuality = analyzeCopy(copyText);
    const status = verification.blocked ? "blocked" : "ready";
    return {
      ...v,
      id: randomUUID(),
      taskId: task.id,
      copyText,
      status,
      verification,
      copyQuality,
      editBurden: verification.blocked ? "heavy" : copyQuality.issues.length ? "light" : "none",
      verifiedAt: verification.checkedAt,
      recommended: v.angle === "pain",
    };
  });
}

async function runPlatforms(taskId, platforms = PLATFORMS) {
  const task = tasks.get(taskId);
  if (!task) throw new Error("任务不存在");
  const product = getProduct(task.productId);
  if (!product) throw new Error("产品事实不存在");

  task.status = "running";
  task.errors = (task.errors || []).filter((e) => !platforms.includes(e.platform));
  task.updatedAt = new Date().toISOString();
  for (const stage of STAGES.slice(0, 2)) setStage(task, stage.stage);

  const variantMap = new Map((task.variants || []).map((v) => [`${v.platform}:${v.angle}`, v]));
  for (const platform of platforms) {
    setStage(task, "writing");
    try {
      const made = createVariant(task, product, task, platform);
      for (const v of made) variantMap.set(`${v.platform}:${v.angle}`, v);
      addEvent(task.id, {
        type: "variant",
        platform,
        label: PLATFORM_LABEL[platform],
        status: made.some((v) => v.status === "blocked") ? "blocked" : "ready",
        variantIds: made.map((v) => v.id),
        count: made.length,
      });
    } catch (error) {
      const row = {
        platform,
        label: PLATFORM_LABEL[platform],
        stage: "writing",
        code: "PLATFORM_FAILED",
        message: error?.message || "这个渠道生成失败",
        retryable: true,
      };
      task.errors.push(row);
      addEvent(task.id, { type: "error", ...row });
    }
    task.variants = [...variantMap.values()];
    persist();
  }

  setStage(task, "reviewing");
  setStage(task, "verifying");
  const current = [...variantMap.values()];
  const blocked = current.filter((v) => v.status === "blocked");
  const failedPlatforms = new Set(task.errors.map((e) => e.platform));
  task.status = failedPlatforms.size ? "partial" : "done";
  task.progress = {
    stage: "done",
    label: blocked.length ? `已生成，${blocked.length} 个版本被核验拦下` : "内容包已生成",
    percent: 100,
    updatedAt: new Date().toISOString(),
  };
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, {
    type: "done",
    status: task.status,
    blocked: blocked.length,
    errors: task.errors.length,
  });
  persist();
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
        persist();
      }
    }
  }, 60);
  timers.add(timer);
}

export function createTask({ store, body = {} }) {
  const card = body.taskCardId ? getTaskCard(body.taskCardId) : null;
  const product = getProduct(body.productId || card?.productId);
  if (!product) throw Object.assign(new Error("未找到真实产品资料"), { status: 400, code: "PRODUCT_NOT_FOUND" });

  const real = body.realDetail || {};
  const detailText = String(real.text || "").trim();
  if (!detailText || real.source !== "sales_provided" || real.confirmed !== true) {
    throw Object.assign(new Error("还差一个真实场景：请写下顾客或门店里实际发生的情况"), {
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
    status: "queued",
    progress: { stage: "queued", label: "排队中", percent: 5 },
    generationMode: "rules-v1",
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
  addEvent(task.id, { type: "stage", stage: "queued", label: "排队中", percent: 5 });
  persist();
  queueRun(task.id);
  return { taskId: task.id, status: "queued" };
}

export function getTask(taskId, storeId) {
  const task = tasks.get(taskId);
  if (!task) return null;
  if (storeId && task.storeId !== storeId) return null;
  return task;
}

export function getTaskSnapshot(taskId, storeId) {
  const task = getTask(taskId, storeId);
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
  return {
    task: {
      id: task.id,
      status: task.status,
      progress: task.progress,
      productId: task.productId,
      productName: task.productName,
      productShortName: task.productShortName,
      productAsset: task.productAsset,
      audience: task.audience,
      scene: task.scene,
      target: task.target,
      realDetail: task.realDetail,
      brief: task.brief,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      generationMode: task.generationMode,
    },
    variants: current,
    channels: byPlatform,
    assets: [],
    evidence: task.evidence || [],
    conflicts: task.conflicts || [],
    progress: task.progress,
    errors: task.errors || [],
  };
}

export function listTasks(storeId, limit = 12) {
  return [...tasks.values()]
    .filter((t) => !storeId || t.storeId === storeId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      productName: t.productName,
      productShortName: t.productShortName,
      status: t.status,
      progress: t.progress,
      createdAt: t.createdAt,
      blockedCount: (t.variants || []).filter((v) => v.status === "blocked").length,
      readyCount: (t.variants || []).filter((v) => v.status === "ready").length,
    }));
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

export function retryPlatform(taskId, platform, storeId) {
  const task = getTask(taskId, storeId);
  if (!task) throw Object.assign(new Error("任务不存在"), { status: 404 });
  if (!PLATFORMS.includes(platform)) throw Object.assign(new Error("未知渠道"), { status: 400 });
  task.variants = (task.variants || []).filter((v) => v.platform !== platform);
  task.errors = (task.errors || []).filter((e) => e.platform !== platform);
  task.status = "queued";
  task.progress = { stage: "queued", label: "重试这一个渠道", percent: 10 };
  task.updatedAt = new Date().toISOString();
  addEvent(task.id, { type: "stage", stage: "queued", label: `重试${PLATFORM_LABEL[platform]}`, percent: 10 });
  queueRun(task.id, [platform]);
  return { taskId, platform, status: "queued" };
}

export function updateVariant(taskId, variantId, patch, storeId) {
  const task = getTask(taskId, storeId);
  if (!task) throw Object.assign(new Error("任务不存在"), { status: 404 });
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
  persist();
  return variant;
}

function recoverInterruptedTasks() {
  const interrupted = [...tasks.values()].filter((task) => ["queued", "running"].includes(task.status));
  if (!interrupted.length) return;
  for (const task of interrupted) {
    const existingPlatforms = new Set((task.variants || []).map((variant) => variant.platform));
    const missing = PLATFORMS.filter((platform) => !existingPlatforms.has(platform));
    if (!missing.length) {
      task.status = "done";
      task.progress = { stage: "done", label: "内容包已生成", percent: 100, updatedAt: new Date().toISOString() };
      task.updatedAt = new Date().toISOString();
      addEvent(task.id, { type: "done", status: "done", recovered: true });
      continue;
    }
    task.status = "queued";
    task.progress = { stage: "queued", label: "服务重启，继续未完成渠道", percent: 5, updatedAt: new Date().toISOString() };
    task.updatedAt = new Date().toISOString();
    addEvent(task.id, { type: "stage", stage: "queued", label: "服务重启，继续未完成渠道", percent: 5, recovered: true });
    queueRun(task.id, missing);
  }
  persist();
}

load();
recoverInterruptedTasks();

export { PLATFORMS, PLATFORM_LABEL };
