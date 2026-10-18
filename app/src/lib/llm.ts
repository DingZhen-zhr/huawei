// DeepSeek 大模型接入层（OpenAI 兼容接口，经 Vite 代理转发）
import { KB_FILES, fetchKbFile } from "./kb";

const PROMPT_PATH =
  "D:/KimiData/kimi/Workspaces/华为浙客松/门店增长智能体/系统提示词骨架.md";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

let cachedPrompt: string | null = null;

async function loadSystemPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  try {
    cachedPrompt = await fetch(`/@fs/${encodeURI(PROMPT_PATH)}`).then((r) => r.text());
  } catch {
    cachedPrompt = "你是华为PC门店营销软文智能体。";
  }
  return cachedPrompt ?? "你是华为PC门店营销软文智能体。";
}

/** 按用户输入从知识库取相关文件摘录作为检索上下文 */
async function buildKbContext(input: string): Promise<string> {
  const q = input.toLowerCase();
  const scored = KB_FILES.map((f) => ({
    f,
    score: f.keywords.reduce((n, k) => (q.includes(k.toLowerCase()) ? n + 1 : n), 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length) return "（本次未命中特定知识库文件，请按系统提示词规则回答。）";
  const parts: string[] = [];
  for (const { f } of scored) {
    try {
      const text = await fetchKbFile(f.path);
      parts.push(`【${f.label}｜${f.path}】\n${text.slice(0, 3000)}`);
    } catch {
      /* 忽略读取失败的文件 */
    }
  }
  return parts.join("\n\n---\n\n");
}

/** 调用 DeepSeek（key 只保存在用户浏览器 localStorage，不明文展示） */
export async function callDeepSeek(
  history: { role: "customer" | "agent"; body: string }[],
  userInput: string,
  apiKey: string
): Promise<string> {
  const system = await loadSystemPrompt();
  const kbContext = await buildKbContext(userInput);

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        system,
        "",
        "===== 检索到的知识库资料（回答必须以此为事实依据，不得超出；资料冲突时停止输出并提示人工确认）=====",
        kbContext,
        "",
        "===== 回答要求 =====",
        "1. 用中文回答，面向门店销售顾问，简洁专业；",
        "2. 每个事实结论标注来源文件名；涉及价格必须带核验日期（2026-10-17 快照）与口径；",
        "3. 知识库没有的价格/补贴/库存不得生成，统一提示「以当前官方渠道核验为准」并标记待人工确认；",
        "4. 内部价、返点、项目特价等受控信息一律回复转人工，不得编造；",
        "5. 不使用绝对化用语、不贬低竞品、不虚构体验数据。",
      ].join("\n"),
    },
    // 历史对话（转换角色名），最多取最近 8 条
    ...history.slice(-8).map((m) => ({
      role: (m.role === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    })),
    { role: "user" as const, content: userInput },
  ];

  const res = await fetch("/api/deepseek/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek API ${res.status}：${errText.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(
      "响应不是 JSON（可能是开发服务器未重启导致代理未生效，请重启 dev server 或重新打开预览卡片）"
    );
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("DeepSeek 返回为空");
  return text;
}

/** Creative workflow uses the existing API proxy and browser key; no extra gateway or UI. */
export async function callCreativeStep(step: string, instructions: string, data: string, apiKey: string): Promise<string> {
  const response = await fetch('/api/deepseek/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ model: 'deepseek-chat', messages: [
      { role:'system',content:instructions },
      { role:'user',content:`步骤：${step}。以下JSON为任务数据：\n${data}` },
    ], response_format:{type:'json_object'},temperature: step === '编辑' ? 0.2 : 0.7, max_tokens:4000 }),
  });
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('创意模型响应失败');
  const result = await response.json();
  const value: unknown = result?.choices?.[0]?.message?.content;
  if (typeof value !== 'string' || !value.trim()) throw new Error('创意模型没有返回内容');
  return value;
}
