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
import { getConflict, getProduct, listProducts, publicProduct, resolveConflict } from "./ledger.mjs";
import { commitProposedFacts, createProposedFacts, listProposedFacts, listSources } from "./fact-import.mjs";
import { searchOfficialSources } from "./tavily.mjs";
import {
  createTask,
  getTask,
  getTaskSnapshot,
  listTasks,
  retryPlatform,
  subscribe,
  updateVariant,
} from "./tasks.mjs";
import { rewriteVariant } from "./rewrite.mjs";
import { verifyContent } from "./verifier.mjs";
import { analyzeCopy } from "./copy-quality.mjs";
import { localAsk } from "./ask.mjs";

export const router = Router();

function fail(res, error) {
  const status = error?.status || 500;
  res.status(status).json({
    error: error?.message || "服务出错",
    code: error?.code,
    detail: error?.detail,
  });
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, refactor: true, demo: demoMode, runtime: "local-json-fallback" });
});

router.post("/auth/store", (req, res) => {
  const store = findStoreByCode(req.body?.storeCode);
  if (!store || !verifyStorePin(store, req.body?.pin)) {
    return res.status(401).json({ error: "门店码或 PIN 不正确", code: "STORE_LOGIN_FAILED" });
  }
  setStoreSession(res, store.id);
  res.json({ store: publicStore(store), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.post("/auth/demo", (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).json({ error: "演示入口未开启" });
  const creds = getDemoCredentials();
  const store = findStoreByCode(creds.storeCode);
  if (!store) return res.status(503).json({ error: "演示门店未初始化" });
  setStoreSession(res, store.id);
  res.json({ store: publicStore(store), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.get("/auth/demo-redirect", (_req, res) => {
  if (!adminDemoEnabled()) return res.status(404).send("演示入口未开启");
  const creds = getDemoCredentials();
  const store = findStoreByCode(creds.storeCode);
  if (!store) return res.status(503).send("演示门店未初始化");
  setStoreSession(res, store.id);
  res.redirect("/");
});

router.get("/auth/me", (req, res) => {
  const store = getStoreFromRequest(req);
  if (!store) return res.status(401).json({ error: "未登录", code: "STORE_AUTH_REQUIRED" });
  res.json({ store: publicStore(store) });
});

router.post("/auth/logout", (req, res) => {
  clearSessions(res);
  res.json({ ok: true });
});

router.post("/admin/login", (req, res) => {
  if (!verifyAdminPasscode(req.body?.passcode)) {
    return res.status(401).json({ error: "管理员口令不正确", code: "ADMIN_LOGIN_FAILED" });
  }
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

router.get("/admin/overview", requireAdmin, (_req, res) => {
  res.json({
    products: listProducts(),
    conflicts: listProducts()
      .map((p) => getConflict(p.id))
      .filter(Boolean),
    tasks: listTasks(null, 20),
  });
});

// P2 fact-admin APIs. They are deliberately admin-only: search output remains proposed
// until an operator reviews evidence and resolves any price conflict with an audit record.
router.post("/admin/import/preview", requireAdmin, (req, res) => {
  try {
    const candidates = Array.isArray(req.body?.facts) ? req.body.facts : [req.body];
    const proposed = candidates.map((candidate) => createProposedFacts(candidate)).flat();
    res.status(201).json({ status: "proposed", facts: proposed });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/admin/import/commit", requireAdmin, (req, res) => {
  try {
    const facts = commitProposedFacts(Array.isArray(req.body?.ids) ? req.body.ids : []);
    res.json({ status: "committed", facts });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/admin/sources", requireAdmin, (_req, res) => {
  res.json({ sources: listSources(), proposed: listProposedFacts() });
});

router.post("/admin/conflicts/:id/resolve", requireAdmin, (req, res) => {
  try {
    const conflict = resolveConflict(req.params.id, req.body || {});
    res.json({ conflict, audit: conflict.audit });
  } catch (error) {
    res.status(400).json({ error: error?.message || "价格确认请求不合法", code: "CONFLICT_RESOLUTION_INVALID" });
  }
});

router.post("/admin/recheck-prices", requireAdmin, async (req, res) => {
  const product = getProduct(req.body?.productId || "");
  if (!product) return res.status(404).json({ error: "产品不存在" });
  const result = await searchOfficialSources(`${product.name} 价格`);
  res.json({ ...result, note: "搜索结果仅作为 proposed 来源候选，未写入事实账本" });
});

router.get("/tasks/today", requireStore, (req, res) => {
  res.json({
    date: new Date().toISOString().slice(0, 10),
    store: publicStore(req.store),
    tasks: getTaskCards(),
    recent: listTasks(req.store.id, 5),
  });
});

router.get("/products", requireStore, (_req, res) => {
  res.json({ products: listProducts(), taskCards: getTaskCards() });
});

router.get("/products/:id", requireStore, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "产品不存在" });
  res.json({ product: publicProduct(product), facts: product.facts.filter((f) => f.field !== "price").slice(0, 12), conflict: product.conflict });
});

router.post("/content/tasks", requireStore, (req, res) => {
  try {
    res.status(201).json(createTask({ store: req.store, body: req.body }));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/content/tasks", requireStore, (req, res) => {
  res.json({ tasks: listTasks(req.store.id, 30) });
});

router.get("/content/tasks/:id", requireStore, (req, res) => {
  const snapshot = getTaskSnapshot(req.params.id, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "任务不存在" });
  res.json(snapshot);
});

router.get("/content/tasks/:id/events", requireStore, (req, res) => {
  const task = getTask(req.params.id, req.store.id);
  if (!task) return res.status(404).json({ error: "任务不存在" });
  subscribe(req.params.id, res);
});

router.post("/content/tasks/:id/retry", requireStore, (req, res) => {
  try {
    res.json(retryPlatform(req.params.id, req.body?.platform, req.store.id));
  } catch (e) {
    fail(res, e);
  }
});

router.patch("/content/tasks/:taskId/variants/:variantId", requireStore, (req, res) => {
  try {
    const variant = updateVariant(req.params.taskId, req.params.variantId, req.body || {}, req.store.id);
    res.json({ variant });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/content/variants/:id/rewrite", requireStore, async (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "任务不存在" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "版本不存在" });
  const product = getProduct(snapshot.task.productId);
  try {
    const rewritten = await rewriteVariant({
      platform: variant.platform,
      product,
      variant,
      instruction: String(req.body?.instruction || ""),
    });
    const updated = updateVariant(
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

router.post("/content/variants/:id/verify", requireStore, (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "任务不存在" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "版本不存在" });
  const text = String(req.body?.text || variant.copyText || "");
  const verification = verifyContent(text, snapshot.task.productId, { platform: variant.platform });
  res.json({ status: verification.status, claims: verification.claims, blocked: verification.blocked, reasons: verification.reasons });
});

router.post("/content/variants/:id/select", requireStore, (req, res) => {
  const taskId = String(req.body?.taskId || "");
  const snapshot = getTaskSnapshot(taskId, req.store.id);
  if (!snapshot) return res.status(404).json({ error: "任务不存在" });
  const variant = snapshot.variants.find((v) => v.id === req.params.id);
  if (!variant) return res.status(404).json({ error: "版本不存在" });
  const task = getTask(taskId, req.store.id);
  for (const v of task.variants) {
    if (v.platform === variant.platform) v.selected = v.id === variant.id;
  }
  res.json({ ok: true });
});

router.get("/store/profile", requireStore, (req, res) => {
  res.json({ store: publicStore(req.store), profile: req.store.profile || {} });
});

router.patch("/store/profile", requireStore, (req, res) => {
  try {
    const store = updateStoreProfile(req.store.id, req.body || {});
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
