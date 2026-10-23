import { Router } from "express";
import {
  adminDemoEnabled,
  clearSessions,
  getStoreFromRequest,
  requireAdmin,
  requireStore,
  setAdminSession,
  setStoreSession,
  verifyAdminPasscode,
} from "./auth.mjs";
import { demoMode, findStoreByCode, getDemoCredentials, publicStore, updateStoreProfile, verifyStorePin } from "./store-repo.mjs";
import { getTaskCards } from "./task-cards.mjs";
import { ensureFactRuntime, flushFactRuntime, getConflict, getProduct, listProducts, publicProduct, resolveConflict } from "./ledger.mjs";
import { commitProposedFacts, createProposedFacts, ensureProposals, flushProposals, listProposedFacts, listSources } from "./fact-import.mjs";
import { searchOfficialSources } from "./tavily.mjs";
import {
  createTask,
  ensureTask,
  getTaskSnapshot,
  listTasks,
  persistTask,
  retryPlatform,
  subscribe,
  updateVariant,
} from "./tasks.mjs";
import { rewriteVariant } from "./rewrite.mjs";
import { verifyContent } from "./verifier.mjs";
import { analyzeCopy } from "./copy-quality.mjs";
import { localAsk } from "./ask.mjs";
import { dbEnabled } from "./db.mjs";
import { defaultKbRoot, importKbToDisk } from "./kb-import.mjs";
import { kbMediaPath, kbStatus, reloadKbStore } from "./kb-store.mjs";

export const router = Router();

let runtimeReady = null;
router.use(async (_req, _res, next) => {
  try {
    if (!runtimeReady) {
      runtimeReady = (async () => {
        await ensureFactRuntime();
        await ensureProposals();
      })();
    }
    await runtimeReady;
    next();
  } catch (error) {
    runtimeReady = null;
    next(error);
  }
});

const attempts = new Map();
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
}
function allowAttempt(key, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((time) => now - time < windowMs);
  if (list.length >= limit) return false;
  list.push(now);
  attempts.set(key, list);
  if (attempts.size > 2000) attempts.clear();
  return true;
}

function fail(res, error) {
  const status = error?.status || 500;
  res.status(status).json({
    error: error?.message || "出了点问题，再试一次",
    code: error?.code,
    detail: error?.detail,
  });
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, refactor: true, demo: demoMode, persistence: dbEnabled() ? "supabase" : "local-json" });
});

router.post("/auth/store", async (req, res) => {
  const key = `store:${clientIp(req)}:${String(req.body?.storeCode || "").toUpperCase()}`;
  if (!allowAttempt(key)) return res.status(429).json({ error: "尝试次数过多，请稍后再试", code: "LOGIN_RATE_LIMITED" });
  const store = await findStoreByCode(req.body?.storeCode);
  if (!store || !verifyStorePin(store, req.body?.pin)) {
    return res.status(401).json({ error: "门店码或 PIN 不正确", code: "STORE_LOGIN_FAILED" });
  }
  attempts.delete(key);
  setStoreSession(res, store.id);
  res.json({ store: publicStore(store), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.post("/auth/demo", async (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).json({ error: "演示入口未开启" });
  const creds = getDemoCredentials();
  const store = await findStoreByCode(creds.storeCode);
  if (!store) return res.status(503).json({ error: "演示门店还没建好" });
  setStoreSession(res, store.id);
  res.json({ store: publicStore(store), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.get("/auth/demo-redirect", async (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).send("演示入口未开启");
  const creds = getDemoCredentials();
  const store = await findStoreByCode(creds.storeCode);
  if (!store) return res.status(503).send("演示门店还没建好");
  setStoreSession(res, store.id);
  res.redirect("/");
});

router.get("/auth/me", async (req, res) => {
  const store = await getStoreFromRequest(req);
  if (!store) return res.status(401).json({ error: "还没登录", code: "STORE_AUTH_REQUIRED" });
  res.json({ store: publicStore(store) });
});

router.post("/auth/logout", (req, res) => {
  clearSessions(res);
  res.json({ ok: true });
});

router.post("/admin/login", (req, res) => {
  if (!allowAttempt(`admin:${clientIp(req)}`)) return res.status(429).json({ error: "尝试次数过多，请稍后再试", code: "ADMIN_RATE_LIMITED" });
  if (!verifyAdminPasscode(req.body?.passcode)) {
    return res.status(401).json({ error: "管理员口令不正确", code: "ADMIN_LOGIN_FAILED" });
  }
  attempts.delete(`admin:${clientIp(req)}`);
  setAdminSession(res);
  res.json({ ok: true, demo: demoMode });
});

router.post("/admin/demo", (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).json({ error: "演示入口未开启" });
  setAdminSession(res);
  res.json({ ok: true, demo: true });
});

router.get("/admin/demo-redirect", (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).send("演示入口未开启");
  setAdminSession(res);
  res.redirect("/admin");
});

router.get("/admin/conflicts", requireAdmin, (_req, res) => {
  const conflicts = listProducts()
    .map((p) => getConflict(p.id))
    .filter(Boolean);
  res.json({ conflicts });
});

router.get("/admin/overview", requireAdmin, async (_req, res) => {
  res.json({
    products: listProducts(),
    conflicts: listProducts()
      .map((p) => getConflict(p.id))
      .filter(Boolean),
    tasks: await listTasks(null, 20),
  });
});

let kbImporting = false;
router.get("/admin/kb/status", requireAdmin, (_req, res) => {
  res.json(kbStatus());
});

router.post("/admin/kb/import", requireAdmin, (req, res) => {
  if (kbImporting) return res.status(409).json({ error: "知识库正在导入，等这次完成", code: "KB_IMPORT_BUSY" });
  kbImporting = true;
  try {
    const result = importKbToDisk({ root: defaultKbRoot() });
    reloadKbStore();
    res.json({ status: "imported", ...result, kb: kbStatus() });
  } catch (error) {
    fail(res, error);
  } finally {
    kbImporting = false;
  }
});

router.get("/kb/media/:file", (req, res) => {
  const full = kbMediaPath(req.params.file);
  if (!full) return res.status(404).json({ error: "图片不存在", code: "KB_MEDIA_NOT_FOUND" });
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(full, (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

// P2 fact-admin APIs. They are deliberately admin-only: search output remains proposed
// until an operator reviews evidence and resolves any price conflict with an audit record.
router.post("/admin/import/preview", requireAdmin, async (req, res) => {
  try {
    const candidates = Array.isArray(req.body?.facts) ? req.body.facts : [req.body];
    const proposed = candidates.map((candidate) => createProposedFacts(candidate)).flat();
    await flushProposals();
    res.status(201).json({ status: "proposed", facts: proposed });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/admin/import/commit", requireAdmin, async (req, res) => {
  try {
    const facts = commitProposedFacts(Array.isArray(req.body?.ids) ? req.body.ids : []);
    await flushFactRuntime();
    await flushProposals();
    res.json({ status: "committed", facts });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/admin/sources", requireAdmin, (_req, res) => {
  res.json({ sources: listSources(), proposed: listProposedFacts() });
});

router.post("/admin/conflicts/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const conflict = resolveConflict(req.params.id, req.body || {});
    await flushFactRuntime();
    res.json({ conflict, audit: conflict.audit });
  } catch (error) {
    res.status(400).json({ error: error?.message || "价格确认的信息不完整", code: "CONFLICT_RESOLUTION_INVALID" });
  }
});

router.post("/admin/recheck-prices", requireAdmin, async (req, res) => {
  const product = getProduct(req.body?.productId || "");
  if (!product) return res.status(404).json({ error: "没有这个型号的资料" });
  const result = await searchOfficialSources(`${product.name} 价格`);
  res.json({ ...result, note: "搜到的只是候选来源，确认前不会写进事实库" });
});

router.get("/tasks/today", requireStore, async (req, res) => {
  res.json({
    date: new Date().toISOString().slice(0, 10),
    store: publicStore(req.store),
    tasks: getTaskCards(),
    recent: await listTasks(req.store.id, 5),
  });
});

router.get("/products", requireStore, (_req, res) => {
  res.json({ products: listProducts(), taskCards: getTaskCards() });
});

router.get("/products/:id", requireStore, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "没有这个型号的资料" });
  res.json({ product: publicProduct(product), facts: product.facts.filter((f) => f.field !== "price").slice(0, 12), conflict: product.conflict });
});

router.post("/content/tasks", requireStore, async (req, res) => {
  try {
    res.status(201).json(await createTask({ store: req.store, body: req.body }));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/content/tasks", requireStore, async (req, res) => {
  res.json({ tasks: await listTasks(req.store.id, 30) });
});

router.get("/content/tasks/:id", requireStore, async (req, res) => {
  const snapshot = await getTaskSnapshot(req.params.id, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "这条内容找不到了" });
  res.json(snapshot);
});

router.get("/content/tasks/:id/events", requireStore, async (req, res) => {
  const task = await ensureTask(req.params.id, req.store.id);
  if (!task) return res.status(404).json({ error: "这条内容找不到了" });
  subscribe(req.params.id, res);
});

router.post("/content/tasks/:id/retry", requireStore, async (req, res) => {
  try {
    res.json(await retryPlatform(req.params.id, req.body?.platform, req.store.id));
  } catch (e) {
    fail(res, e);
  }
});

router.patch("/content/tasks/:taskId/variants/:variantId", requireStore, async (req, res) => {
  try {
    const variant = await updateVariant(req.params.taskId, req.params.variantId, req.body || {}, req.store.id);
    res.json({ variant });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/content/variants/:id/rewrite", requireStore, async (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = await getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "这条内容找不到了" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "这条稿子找不到了" });
  const product = getProduct(snapshot.task.productId);
  try {
    const rewritten = await rewriteVariant({
      platform: variant.platform,
      product,
      variant,
      instruction: String(req.body?.instruction || ""),
    });
    const updated = await updateVariant(
      taskId,
      variant.id,
      {
        title: rewritten.fields.title,
        body: rewritten.fields.body,
        tags: rewritten.fields.tags,
        script: rewritten.fields.script,
      },
      req.store.id,
    );
    res.json({
      variant: updated,
      review: updated.copyQuality,
      verification: updated.verification,
      rewriteMode: rewritten.mode,
      rewriteError: rewritten.error || undefined,
      model: rewritten.model,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/content/variants/:id/verify", requireStore, async (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = await getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "这条内容找不到了" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "这条稿子找不到了" });
  const text = String(req.body?.text || variant.copyText || "");
  const verification = verifyContent(text, snapshot.task.productId, { platform: variant.platform });
  res.json({ status: verification.status, claims: verification.claims, blocked: verification.blocked, reasons: verification.reasons });
});

router.post("/content/variants/:id/select", requireStore, async (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = await getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "这条内容找不到了" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "这条稿子找不到了" });
  const task = await ensureTask(taskId, req.store.id);
  for (const v of task.variants) {
    if (v.platform === variant.platform) v.selected = v.id === variant.id;
  }
  await persistTask(task);
  res.json({ ok: true });
});

router.get("/store/profile", requireStore, (req, res) => {
  res.json({ store: publicStore(req.store), profile: req.store.profile || {} });
});

router.patch("/store/profile", requireStore, async (req, res) => {
  try {
    const store = await updateStoreProfile(req.store.id, req.body || {});
    res.json({ store });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/ask", requireStore, (req, res) => {
  try {
    res.json(localAsk({ messages: req.body?.messages }));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/ask/to-content", requireStore, (req, res) => {
  const p = req.body || {};
  const product = getProduct(p.productId || "");
  res.json({
    prefill: {
      productId: product?.id || p.productId || "",
      audience: String(p.audience || ""),
      scene: String(p.scene || ""),
      target: String(p.target || "到店看实物"),
      facts: Array.isArray(p.factIds) ? p.factIds : [],
      realDetail: p.realDetail?.text
        ? { text: String(p.realDetail.text), source: "sales_provided", confirmed: true }
        : null,
    },
  });
});

router.get("/quality/preview", requireStore, (req, res) => {
  const text = String(req.query.text || "");
  res.json(analyzeCopy(text));
});
