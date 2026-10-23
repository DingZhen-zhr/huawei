// 华采智营 · 服务端入口：门店/内容/事实核验全部在 refactor 路由里。
import express from "express";
import cors from "cors";
import "dotenv/config";
import { router as refactorRouter } from "./refactor/routes.mjs";
import { dbEnabled, dbPing } from "./refactor/db.mjs";

const app = express();
app.disable("x-powered-by");
const isProduction = process.env.NODE_ENV === "production";
const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || (!isProduction && corsOrigins.length === 0)) return callback(null, true);
    return callback(null, corsOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  const persistence = dbEnabled() ? await dbPing() : { ok: false, reason: "local-json" };
  res.status(dbEnabled() && !persistence.ok ? 503 : 200).json({
    ok: true,
    service: "huacai-copilot",
    persistence: dbEnabled() ? "supabase" : "local-json",
    database: dbEnabled() ? (persistence.ok ? "up" : "down") : "not-configured",
  });
});

app.use("/api", refactorRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "接口不存在", code: "API_NOT_FOUND" });
});

app.use((error, _req, res, _next) => {
  console.error("[api]", error?.stack || error?.message || error);
  const status = Number(error?.status) || 500;
  res.status(status).json({
    error: status >= 500 ? "服务暂时不可用，请稍后重试" : error?.message || "请求不合法",
    code: error?.code || "API_ERROR",
  });
});

const PORT = process.env.PORT || 8787;

const serverlessRuntime = process.env.VERCEL || process.env.NETLIFY;
if (!serverlessRuntime) {
  const server = app.listen(PORT, () => {
    console.log(`✅ 华采智营服务端运行于 http://localhost:${PORT}`);
    console.log(`   门店登录 / 内容工坊 / 顾客问答 / 管理后台 · 持久化：${process.env.HC_PERSISTENCE || "auto"}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export default app;
