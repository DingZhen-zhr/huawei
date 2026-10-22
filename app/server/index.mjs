// 华采智营 · 服务端（对话 / 会话记忆 / 平台规则）
import express from "express";
import cors from "cors";
import "dotenv/config";
import { listPlatforms, getSpec, adapt, review, publish, collect } from "./mcp/core.mjs";
import { converse, gatherFacts } from "./chat/agent.mjs";
import { generateBatch, rewriteOne, verifyText } from "./chat/batch.mjs";
import { addCustomProduct, listCustomFacts } from "./chat/custom-facts.mjs";
import { dbEnabled, loadHistory, saveTurn, clearSession } from "./db.mjs";
import { generateBackground } from "./images.mjs";
import { router as refactorRouter } from "./refactor/routes.mjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/api", refactorRouter);

const PORT = process.env.PORT || 8787;

// 简易限流：每个 IP 每小时 30 次对话请求（单实例内存桶，够挡住误用/爬虫）
const buckets = new Map();
function chatRateLimit(req, res, next) {
  const ip = String(req.headers["x-nf-client-connection-ip"] || req.ip || "unknown");
  const now = Date.now();
  const list = (buckets.get(ip) || []).filter((t) => now - t < 3600_000);
  if (list.length >= 30) {
    return res.status(429).json({ error: "请求太频繁，请一小时后再试" });
  }
  list.push(now);
  buckets.set(ip, list);
  if (buckets.size > 5000) buckets.clear();
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: dbEnabled, model: process.env.DEEPSEEK_MODEL || "deepseek-chat" });
});

/** 平台规则卡（写文案时同源校验） */
app.get("/api/platforms", (_req, res) => {
  res.json({ platforms: listPlatforms() });
});

app.get("/api/platforms/:platform/spec", (req, res) => {
  try {
    res.json(getSpec(req.params.platform));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post("/api/platforms/:platform/adapt", (req, res) => {
  try {
    const draft = adapt(req.body?.package, req.params.platform);
    res.json({ draft, review: review(draft) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/platforms/:platform/review", (req, res) => {
  try {
    res.json(review(req.body?.draft));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/platforms/:platform/publish", (req, res) => {
  try {
    res.json(publish(req.body?.draft, { mode: req.body?.mode || "handoff" }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/platforms/collect", (req, res) => {
  try {
    res.json(collect({ posts: req.body?.posts, baseline: req.body?.baseline }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 对话：多轮 + 知识库事实 + DeepSeek */
app.post("/api/chat", chatRateLimit, async (req, res) => {
  try {
    const { messages, mode, platform, deviceId } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return res.status(400).json({ error: "messages 数量不合法" });
    }
    const total = messages.reduce((n, m) => n + String(m?.content || "").length, 0);
    if (total > 20000) return res.status(413).json({ error: "对话过长" });
    const result = await converse({
      messages,
      mode: mode === "content" ? "content" : "guide",
      platform,
    });

    if (dbEnabled && deviceId) {
      const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user")?.content;
      await saveTurn({ deviceId, userText: lastUser, assistant: result }).catch((e) =>
        console.warn("[db] saveTurn failed:", e.message),
      );
    }

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** AI 背景图：每次一张，前端叠加品牌模板 */
app.post("/api/images", chatRateLimit, async (req, res) => {
  try {
    const { platform, title, body } = req.body || {};
    const img = await generateBackground({ platform, title, body });
    res.json(img);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 一键四平台 */
app.post("/api/batch", chatRateLimit, async (req, res) => {
  try {
    const { brief, persona } = req.body || {};
    const result = await generateBatch({ brief, persona });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 单卡改写：只重写一个平台，不影响其他卡 */
app.post("/api/rewrite", chatRateLimit, async (req, res) => {
  try {
    const { platform, text, instruction, brief } = req.body || {};
    res.json(await rewriteOne({ platform, text, instruction, brief }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 文字核验：编辑后的内容再查一遍数字 */
app.post("/api/verify", async (req, res) => {
  try {
    const { text, brief = "" } = req.body || {};
    const { facts } = gatherFacts([{ role: "user", content: brief || text }]);
    const corpus =
      [...listCustomFacts().map((f) => f.text), ...facts.map((f) => f.text), brief].join("\n") + "\n" + brief;
    res.json(verifyText(text, corpus));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** 新品资料导入 */
app.get("/api/facts", (_req, res) => {
  res.json({ facts: listCustomFacts() });
});

app.post("/api/facts", (req, res) => {
  try {
    const { model, price, points, extra } = req.body || {};
    if (!model) return res.status(400).json({ error: "缺少型号" });
    const rows = addCustomProduct({ model, price, points: points || [], extra: extra || "" });
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/session", async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || "");
    if (!deviceId) return res.status(400).json({ error: "缺少 deviceId" });
    res.json({ db: dbEnabled, ...(await loadHistory(deviceId)) });
  } catch (e) {
    res.status(500).json({ error: e.message, db: dbEnabled });
  }
});

app.delete("/api/session", async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "缺少 deviceId" });
    await clearSession(deviceId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/chat/health", (_req, res) => {
  res.json({
    ok: Boolean(process.env.DEEPSEEK_API_KEY),
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    db: dbEnabled,
  });
});

const serverlessRuntime = process.env.VERCEL || process.env.NETLIFY;
if (!serverlessRuntime) {
  app.listen(PORT, () => {
    console.log(`✅ 服务端运行于 http://localhost:${PORT}`);
    console.log(`   POST /api/chat · GET /api/session · db=${dbEnabled}`);
  });
}

export default app;
