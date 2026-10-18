// AI+华为PC营销软文智能体 · 服务端入口
// 提供：RAG 检索 + DeepSeek 生成的 Agent 编排
import express from "express";
import cors from "cors";
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { retrieve } from "./rag.mjs";
import { chat } from "./deepseek.mjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8787;

// 知识库根目录（仓库内）
const KB_ROOT = path.resolve(process.cwd(), "..", "华为PC全板块深度知识库_v7");

// 加载系统提示词骨架（8 模块），作为 Agent 的 system prompt
const PROMPT_FILE = path.resolve(process.cwd(), "..", "系统提示词骨架.md");
let SYSTEM_PROMPT = "";
try {
  SYSTEM_PROMPT = readFileSync(PROMPT_FILE, "utf-8");
} catch (e) {
  console.warn("[server] 未读取到系统提示词骨架:", e.message);
  SYSTEM_PROMPT = "你是「AI+华为PC营销软文智能体」，服务于华为 PC 门店导购与内容运营。";
}

/** 把模型输出拆成标题与正文 */
function splitArticle(raw) {
  const text = String(raw || "").trim();
  const lines = text.split("\n");
  let title = "";
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const m = lines[i].match(/^#{1,3}\s*(.+)$/) || lines[i].match(/^\*\*(.+?)\*\*$/);
    if (m) {
      title = m[1].trim();
      start = i + 1;
      break;
    }
  }
  const body = lines.slice(start).join("\n").trim();
  if (title) return { title, body: body || text };
  const first = text.split("\n").find((l) => l.trim()) || "软文";
  return { title: first.replace(/^#+\s*/, "").slice(0, 40), body: text };
}

// 组装 RAG 上下文片段
function buildContext(chunks) {
  if (!chunks.length) return "";
  const parts = chunks.map((c, i) => {
    return `【资料${i + 1}｜${c.board}｜${c.file}】\n${c.text}`;
  });
  return parts.join("\n\n---\n\n");
}

/** RAG 检索 */
app.post("/api/retrieve", async (req, res) => {
  try {
    const { query, topK } = req.body || {};
    if (!query) return res.status(400).json({ error: "缺少 query" });
    const result = await retrieve(query, { topK: topK || 8 });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 自由对话：RAG + DeepSeek 生成 */
app.post("/api/free-chat", async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "缺少 messages" });
    }
    // 取最后一条用户消息做检索
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUser?.content || "";
    const { chunks } = await retrieve(query, { topK: 8 });
    const context = buildContext(chunks);

    const sys = [
      SYSTEM_PROMPT,
      "",
      "## 检索到的知识库资料（仅可引用其中事实，不得编造）",
      context || "（未检索到相关知识，需明确说明依据不足）",
    ].join("\n");

    const reply = await chat({
      messages: [
        { role: "system", content: sys },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      maxTokens: 1800,
    });

    res.json({
      reply,
      evidence: chunks.map((c) => ({
        file: c.file,
        board: c.board,
        text: c.text,
        score: c.score,
      })),
    });
  } catch (e) {
    console.error("[free-chat] 出错:", e);
    res.status(500).json({ error: e.message });
  }
});

/** 工作台：模型生成软文（RAG + DeepSeek） */
app.post("/api/pipeline", async (req, res) => {
  try {
    const { modelName, scenario, platform, goal, withPrice, crowd, problem, angle } =
      req.body || {};
    if (!modelName || !platform) {
      return res.status(400).json({ error: "缺少 modelName / platform" });
    }

    const query = [modelName, scenario, platform, goal, crowd, problem, "平台规则", withPrice ? "价格" : ""]
      .filter(Boolean)
      .join(" ");
    const { chunks } = await retrieve(query, { topK: 10 });
    if (!chunks.length) {
      return res.status(503).json({ error: "知识库索引为空，请先运行 npm run vectorize" });
    }
    const context = buildContext(chunks);

    const priceRule = withPrice
      ? "如引用价格，必须写清：精确款式 + 价格类型（页面价/预估到手价/官网参考价）+ 金额 + 核验日期 + 条件，并注明以结算页复核为准。"
      : "本文不写具体金额，价格与权益统一写「以当前官方渠道核验为准」。";

    const sys = [
      SYSTEM_PROMPT,
      "",
      "## 本次任务",
      `- 产品：${modelName}`,
      `- 场景：${scenario || "未指定"}`,
      `- 目标人群：${crowd || "按场景推断，但不得夸大"}`,
      `- 用户问题：${problem || "未指定"}`,
      `- 内容切入点：${angle || "按任务自行判断"}`,
      `- 发布平台：${platform}`,
      `- 内容目标：${goal || "带来咨询"}`,
      `- 价格处理：${priceRule}`,
      "",
      "## 知识库资料（只能使用以下事实，不得编造数字或结论）",
      context,
      "",
      "## 输出格式（严格遵守）",
      "第一行输出：`# 标题`",
      "空一行后输出正文。",
      "不要输出「作为AI」「以下是」「希望对你有帮助」这类开场或收尾套话，不要输出免责声明段落。",
      "正文中的每个事实必须能在上述资料里找到依据；资料没有的参数不写。",
      "不使用绝对化用语、竞品贬低、虚构体验或未记录的销量/评价。",
      "结尾按平台给一句行动引导。",
    ].join("\n");

    const raw = await chat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `请写一篇面向「${platform}」的${scenario || ""}软文。` },
      ],
      temperature: 0.7,
      maxTokens: platform === "公众号" ? 2200 : 1400,
    });

    const { title, body } = splitArticle(raw);

    // 轻量事实核验：正文里的数字能否在检索资料中找到
    const ctxText = chunks.map((c) => c.text).join("\n");
    const nums = [...new Set((title + "\n" + body).match(/\d[\d,]*(?:\.\d+)?/g) || [])].filter(
      (n) => n.replace(/[,\.]/g, "").length >= 2
    );
    const unmatched = nums.filter((n) => !ctxText.includes(n));
    const verify = {
      total: nums.length,
      matched: nums.length - unmatched.length,
      unmatched: unmatched.slice(0, 10),
    };

    res.json({
      article: { title, body },
      evidence: chunks.map((c) => ({ file: c.file, board: c.board, text: c.text, score: c.score })),
      verify,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    });
  } catch (e) {
    console.error("[pipeline] 出错:", e);
    res.status(500).json({ error: e.message });
  }
});

/** 知识库文件读取（跨平台，替代前端 /@fs/ 硬编码路径） */
app.get("/api/kb-file", (req, res) => {
  try {
    const rel = String(req.query.path || "");
    if (!rel) return res.status(400).json({ error: "缺少 path" });
    // 防目录穿越：禁止 ..、绝对路径
    if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) {
      return res.status(400).json({ error: "非法路径" });
    }
    const full = path.resolve(KB_ROOT, rel);
    if (!full.startsWith(KB_ROOT)) return res.status(400).json({ error: "非法路径" });
    if (!existsSync(full)) return res.status(404).json({ error: "文件不存在" });
    res.type("text/plain; charset=utf-8").send(readFileSync(full, "utf-8"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 系统提示词全文 */
app.get("/api/prompt", (req, res) => {
  res.type("text/plain; charset=utf-8").send(SYSTEM_PROMPT);
});

/** 健康检查 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: process.env.DEEPSEEK_MODEL || "deepseek-chat" });
});

app.listen(PORT, () => {
  console.log(`✅ 智能体服务端运行于 http://localhost:${PORT}`);
  console.log(`   RAG 索引就绪后：POST /api/free-chat / /api/retrieve`);
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn("   ⚠️ 未配置 DEEPSEEK_API_KEY（app/.env）");
  }
});
