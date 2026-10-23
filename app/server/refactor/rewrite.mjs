// 只改表达，不补事实；模型失败时退回到本地去套话，不伪装成模型成功。
import { chat } from "../deepseek.mjs";
import { getSpec } from "../mcp/core.mjs";
import { analyzeCopy, humanizeLocally } from "./copy-quality.mjs";
import { copyTextFor } from "./generator.mjs";

const SECTION_MARKS = "一二三四五六七八九十";

function renumberSections(text) {
  let index = 0;
  return String(text || "").split(/\n{2,}/).map((block) => {
    const match = block.match(/^([一二三四五六七八九十]+)[、.．]\s*/);
    if (!match) return block;
    index += 1;
    const mark = SECTION_MARKS[index - 1] || match[1];
    return `${mark}、${block.slice(match[0].length)}`;
  }).join("\n\n");
}

const MODEL = process.env.DEEPSEEK_CONTENT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";

function splitXhs(text) {
  const lines = String(text || "").split("\n");
  const title = (lines.find((l) => l.trim()) || "").trim();
  const rest = lines.slice(lines.indexOf(title) + 1).join("\n").trim();
  const tagLine = rest.split("\n").reverse().find((l) => /^\s*#/.test(l));
  const tags = tagLine ? tagLine.split(/\s+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean) : [];
  const body = tagLine ? rest.replace(tagLine, "").trim() : rest;
  return { title, body, tags };
}

function platformPrompt(platform, product, variant) {
  let spec = null;
  try { spec = getSpec(platform); } catch { /* ignore */ }
  return [
    `你在改一篇${spec?.label || platform}门店文案。`,
    "只改表达、句子顺序和口语程度；不得新增价格、参数、活动、库存、赠品、保修、成交或顾客身份。",
    "保留销售提供的真实场景，不能把它改写成官方事实或具体顾客故事。",
    "不要使用“赋能、打造、引领、重新定义、在这个时代、首先/其次/最后、一站式、生态闭环”。",
    "直接输出改写后的完整内容，不要解释，不要 Markdown 代码块。",
    platform === "xiaohongshu" ? "格式：第一行标题（≤20 字），空行，正文，最后一行 3–5 个 #标签。" : "",
    platform === "moments" ? "格式：只写正文，无标题，≤300 字。" : "",
    platform === "wechat-mp" ? "格式：第一行标题，空行，正文；必须保留 3 个清晰小节和来源说明。" : "",
    platform === "poster" ? "格式：第一行主标题（≤12 字），空行，最多 4 行短句。" : "",
    platform === "video" ? "格式：只输出口播脚本，保留 0–3 秒 / 3–15 秒等时间标记，不输出分镜表。" : "",
    `产品：${product.name}`,
    `当前文案：\n${copyTextFor(variant)}`,
  ].filter(Boolean).join("\n");
}

async function callModel({ platform, product, variant, instruction }) {
  const raw = await chat({
    model: MODEL,
    messages: [
      { role: "system", content: platformPrompt(platform, product, variant) },
      { role: "user", content: instruction || "更像门店销售说话，删掉套话，保留事实和真实细节。" },
    ],
    temperature: 0.45,
    maxTokens: platform === "wechat-mp" ? 2600 : 1200,
  });
  const text = String(raw || "").trim();
  if (!text) throw new Error("模型没有返回有效内容");
  return text;
}

export async function rewriteVariant({ platform, product, variant, instruction = "" }) {
  let fields;
  let mode = "llm";
  let error = "";
  try {
    const raw = await callModel({ platform, product, variant, instruction });
    if (platform === "xiaohongshu") {
      fields = splitXhs(raw);
      if (!fields.title || !fields.body) throw new Error("改写结果缺少标题或正文");
      fields.tags = fields.tags.length ? fields.tags : variant.tags;
    } else if (platform === "moments") {
      fields = { body: raw };
    } else if (platform === "video") {
      fields = { script: raw, body: raw };
    } else {
      const parts = raw.split("\n");
      const title = parts.find((l) => l.trim())?.trim() || variant.title;
      const body = parts.slice(parts.indexOf(title) + 1).join("\n").trim();
      fields = { title, body: platform === "wechat-mp" ? renumberSections(body || raw) : (body || raw) };
    }
  } catch (e) {
    mode = "local";
    error = e?.message || "模型改写失败";
    if (platform === "video") {
      const body = humanizeLocally(variant.script || variant.body);
      fields = { script: body, body };
    } else {
      fields = {
        title: humanizeLocally(variant.title || ""),
        body: humanizeLocally(variant.body || ""),
        tags: variant.tags,
      };
    }
  }

  const copyText = copyTextFor({ ...variant, ...fields });
  const analysis = analyzeCopy(copyText);
  return {
    fields,
    mode,
    error,
    preview: copyText,
    review: analysis,
    model: mode === "llm" ? MODEL : "local-humanize",
  };
}
