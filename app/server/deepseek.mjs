// DeepSeek 调用封装：统一从 .env 读取配置，提供非流式 chat 与流式 chat
// 实测 deepseek-chat 路由到 deepseek-flash（V4.1-Flash），也可用 deepseek-v4-pro
import "dotenv/config";

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

if (!API_KEY) {
  console.warn("[deepseek] 未读取到 DEEPSEEK_API_KEY，请在 app/.env 配置");
}

export async function chat({ messages, temperature = 0.7, maxTokens = 1500, stream = false }) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 300)}`);
  }
  if (stream) return res;
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
