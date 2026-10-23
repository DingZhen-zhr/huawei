// 平台适配内核：平台无关内容 → 平台感知产物
// 六个能力：list_platforms / get_spec / adapt / review / publish / collect
// 零外部依赖，可被 MCP server、Express、脚本共同复用
import SPECS from "../platforms/index.mjs";

/** 平台规则卡（编译期打包，Serverless 环境无需读文件） */
let cache = null;

function loadSpecs() {
  if (cache) return cache;
  const specs = {};
  for (const [k, v] of Object.entries(SPECS)) specs[k] = Object.freeze(v);
  cache = specs;
  return specs;
}

const chars = (s) => [...String(s || "")].length;
const emojiCount = (s) => (String(s || "").match(/\p{Extended_Pictographic}/gu) || []).length;
const clip = (s, n) => (chars(s) <= n ? s : [...s].slice(0, Math.max(0, n - 1)).join("") + "…");
const normalizeText = (s) =>
  String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** 稳定来源码：同一条内容 + 平台始终得到同一个码 */
function makeSourceCode(id, platform) {
  const table = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const prefix = { xiaohongshu: "XHS", "wechat-mp": "WMP", moments: "PYQ", poster: "POS" }[platform] || "GEN";
  let h = 2166136261;
  for (const ch of `${id}:${platform}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  let n = Math.abs(h);
  let tail = "";
  for (let i = 0; i < 4; i++) {
    tail += table[n % table.length];
    n = Math.floor(n / table.length);
  }
  return `${prefix}-${tail}`;
}

export function listPlatforms() {
  return Object.values(loadSpecs()).map((s) => ({
    platform: s.platform,
    label: s.label,
    capability: s.capability,
    capabilityNote: s.capabilityNote,
  }));
}

export function getSpec(platform) {
  const spec = loadSpecs()[platform];
  if (!spec) throw new Error(`未知平台：${platform}。可选：${Object.keys(loadSpecs()).join(", ")}`);
  return spec;
}

/** 校验统一内容契约 ContentPackage */
export function validatePackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== "object") return ["ContentPackage 必须是对象"];
  if (!Array.isArray(pkg.variants) || pkg.variants.length === 0) errors.push("variants 至少 1 条");
  for (const [i, v] of (pkg.variants || []).entries()) {
    if (!v || typeof v.platform !== "string") errors.push(`variants[${i}].platform 缺失`);
    if (typeof v?.body !== "string" || !v.body.trim()) errors.push(`variants[${i}].body 为空`);
  }
  return errors;
}

/**
 * adapt：把平台无关的内容包，适配成可发布草稿
 * 只做确定性变换（裁剪、标签归一、必备声明补齐），不调用 LLM
 */
export function adapt(pkg, platform) {
  const spec = getSpec(platform);
  const errors = validatePackage(pkg);
  if (errors.length) throw new Error(`内容包不合法：${errors.join("；")}`);

  const notes = [];
  const variant = pkg.variants.find((v) => v.platform === platform) || pkg.variants[0];
  if (!pkg.variants.some((v) => v.platform === platform)) {
    notes.push(`内容包无 ${platform} 版本，已借用 ${variant.platform} 版本改写`);
  }

  let title = normalizeText(variant.title || "");
  if (spec.limits.titleMax > 0 && chars(title) > spec.limits.titleMax) {
    const before = chars(title);
    title = clip(title, spec.limits.titleMax);
    notes.push(`标题从 ${before} 字裁到 ${spec.limits.titleMax} 字`);
  }
  if (spec.limits.titleMax === 0 && title) {
    notes.push("该平台无标题字段，标题已并入首句");
  }

  let body = normalizeText(variant.body);
  if (spec.limits.titleMax === 0 && title) body = `${title}\n${body}`;

  // 标签归一：去 # 前缀、去重、截断
  let tags = [...new Set((variant.tags || []).map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean))];
  const max = spec.limits.tagsMax ?? 0;
  const min = spec.limits.tagsMin ?? 0;
  if (max >= 0 && tags.length > max) {
    notes.push(`标签 ${tags.length} 个超出上限 ${max}，已截断`);
    tags = tags.slice(0, max);
  }
  if (tags.length < min) notes.push(`标签仅 ${tags.length} 个，低于下限 ${min}（审核会打回）`);

  // 必备声明补齐（生成前约束）；无法自证的项进入「待确认」，不假装已知
  const pending = [];
  for (const req of spec.required || []) {
    const has = checkRequired(req.key, `${title}\n${body}\n${tags.join(" ")}`);
    if (!has) {
      if (req.key === "AI_GENERATED_LABEL") {
        body = `${body}\n\n#AI生成`;
        notes.push("已自动补 AI 生成标识");
      } else {
        notes.push(`缺少必备项「${req.label}」：${req.hint}`);
        pending.push({
          topic: req.key,
          label: req.label,
          hint: req.hint,
          reason: "no_evidence",
          owner: req.key === "PERIOD" || req.key === "PRICE_BASIS" ? "store_manager" : "content_reviewer",
        });
      }
    }
  }

  const cta = normalizeText(variant.cta || "");
  if (cta && !body.includes(cta)) body = `${body}\n\n${cta}`;

  const hashtags = tags.map((t) => `#${t}`).join(" ");
  const copyText =
    platform === "moments"
      ? `${body}`
      : platform === "poster"
        ? `${title}\n${body}`
        : hashtags
          ? `${title}\n\n${body}\n\n${hashtags}`
          : `${title}\n\n${body}`;

  return {
    platform,
    label: spec.label,
    capability: spec.capability,
    title,
    body,
    tags,
    images: (variant.images || []).slice(0, spec.limits.images.max),
    copyText,
    meta: {
      adapted: notes,
      pending,
      sourceCode: makeSourceCode(pkg.id || "draft", platform),
      imageSpec: spec.limits.images,
      factsBaseDate: pkg.factsBaseDate || "2026-10-17",
    },
  };
}

function checkRequired(key, text) {
  const t = String(text || "");
  switch (key) {
    case "AI_GENERATED_LABEL":
      return /#?AI\s?生成|AI\s?创作|内容由\s?AI/i.test(t);
    case "SOURCE_NOTE":
      return /基准日|以门店实际报价为准|信息来源/.test(t);
    case "CONTACT":
      return /微信|电话|扫码|到店|咨询|\d{3,}/.test(t);
    case "PRICE_BASIS":
      return /元|报价|价格/.test(t);
    case "PERIOD":
      return /截止|起止|\d{1,2}月\d{1,2}日|活动期/.test(t);
    case "QR":
      return /二维码|扫码/.test(t);
    default:
      return true;
  }
}

/**
 * review：规则引擎审核（可被 LLM 语义复核二次兜底）
 * 返回结构化 Issue，前端可直接渲染成"打回原因"
 */
export function review(draft) {
  if (!draft || !draft.platform) throw new Error("draft.platform 缺失");
  const spec = getSpec(draft.platform);
  const L = spec.limits;
  const issues = [];
  const add = (level, rule, field, message, extra = {}) =>
    issues.push({ level, rule, field, message, ...extra });

  const title = String(draft.title || "");
  const body = String(draft.body || "");
  const tags = Array.isArray(draft.tags) ? draft.tags : [];

  // 长度
  if (L.titleMax > 0) {
    if (chars(title) < L.titleMin) add("error", "title_too_short", "title", `标题 ${chars(title)} 字，下限 ${L.titleMin}`);
    if (chars(title) > L.titleMax) add("error", "title_too_long", "title", `标题 ${chars(title)} 字，上限 ${L.titleMax}`);
  }
  if (chars(body) < L.bodyMin) add("error", "body_too_short", "body", `正文 ${chars(body)} 字，下限 ${L.bodyMin}`);
  if (chars(body) > L.bodyMax) add("error", "body_too_long", "body", `正文 ${chars(body)} 字，上限 ${L.bodyMax}`);

  // 标签
  if (tags.length < (L.tagsMin || 0)) add("error", "tags_too_few", "tags", `标签 ${tags.length} 个，下限 ${L.tagsMin}`);
  if (tags.length > (L.tagsMax ?? 0)) add("error", "tags_too_many", "tags", `标签 ${tags.length} 个，上限 ${L.tagsMax}`);

  // 图片
  const imgs = Array.isArray(draft.images) ? draft.images : [];
  if (imgs.length < (L.images?.min ?? 0)) add("warn", "images_too_few", "images", `配图 ${imgs.length} 张，建议 ≥${L.images.min}`);
  if (imgs.length > (L.images?.max ?? 99)) add("error", "images_too_many", "images", `配图 ${imgs.length} 张，上限 ${L.images.max}`);
  if (L.images?.allowedCount && imgs.length && !L.images.allowedCount.includes(imgs.length)) {
    add("warn", "images_layout", "images", `该平台推荐 ${L.images.allowedCount.join("/")} 图布局，当前 ${imgs.length} 张`);
  }
  if (L.images?.ratio && imgs.some((im) => im?.ratio && im.ratio !== L.images.ratio)) {
    add("warn", "images_ratio", "images", `配图比例应为 ${L.images.ratio}`);
  }

  // 极限词（带定位，方便前端高亮）
  const scan = `${title}\n${body}\n${tags.join(" ")}`;
  const suppressed = [];
  const guards = spec.falsePositiveGuards || [];
  // 误报抑制：如「100% sRGB」是客观色域参数，不应按绝对化用语打回
  const isGuarded = (word, idx) => {
    const g = guards.find((x) => x.word === word);
    if (!g) return false;
    const tail = scan.slice(idx + word.length).replace(/^\s+/, "").toLowerCase();
    const hit = (g.allowSuffixes || []).find((s) => tail.startsWith(String(s).toLowerCase()));
    if (hit) suppressed.push({ word, snippet: (word + hit).slice(0, 24), reason: g.reason });
    return Boolean(hit);
  };

  for (const word of spec.banned || []) {
    let from = 0;
    while (from <= scan.length) {
      const idx = scan.indexOf(word, from);
      if (idx < 0) break;
      from = idx + word.length;
      if (isGuarded(word, idx)) continue;
      add("error", "banned_word", "text", `命中极限词「${word}」：${spec.bannedReason}`, {
        word,
        snippet: scan.slice(Math.max(0, idx - 12), idx + word.length + 12).replace(/\n/g, " "),
      });
    }
  }

  // 必备项
  for (const req of spec.required || []) {
    if (!checkRequired(req.key, scan)) {
      add("error", "missing_required", "text", `缺少必备项「${req.label}」：${req.hint}`, { key: req.key });
    }
  }

  // 文风
  const per100 = (emojiCount(scan) / Math.max(1, chars(scan))) * 100;
  const target = spec.style?.emojiPer100 ?? 0;
  if (per100 + 0.01 < target) {
    add("warn", "emoji_density", "text", `表情密度 ${per100.toFixed(1)}/100 字，目标约 ${target}（口语化不足）`);
  }
  const paraMax = L.paragraphMaxLines;
  if (paraMax) {
    const tooLong = body.split(/\n+/).filter((p) => p.length > paraMax * 28);
    if (tooLong.length) add("warn", "paragraph_too_long", "body", `${tooLong.length} 段超过 ${paraMax} 行，建议拆段`);
  }
  if (L.collapseLines) {
    const explicit = body.split("\n").filter(Boolean).length;
    const estimated = Math.max(explicit, Math.ceil(chars(body) / 22));
    if (estimated > L.collapseLines) add("warn", "collapse_risk", "body", `正文约 ${estimated} 行，朋友圈超 ${L.collapseLines} 行会折叠（可点「全文」）`);
  }

  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.length - errors;
  return {
    platform: draft.platform,
    verdict: errors ? "revise" : warns ? "pass_with_warnings" : "pass",
    score: Math.max(0, 100 - errors * 15 - warns * 4),
    errorCount: errors,
    warnCount: warns,
    suppressed,
    issues,
    specUsed: { platform: spec.platform, rules: "rule-card", capability: spec.capability },
  };
}

/**
 * publish：能力分级 + 人工交接包
 * 全程 simulated=true —— 演示环境不对真实平台发起写操作
 */
export function publish(draft, options = {}) {
  const spec = getSpec(draft.platform);
  const mode = options.mode || "handoff";
  const code = draft.meta?.sourceCode || makeSourceCode(options.contentId || "draft", draft.platform);

  if (mode === "api" && spec.capability !== "FULL_API") {
    return {
      status: "blocked",
      simulated: true,
      capability: spec.capability,
      reason: `${spec.label}：${spec.capabilityNote}`,
      fallback: "handoff",
    };
  }

  const steps = {
    MANUAL: [
      "复制 copyText 到平台编辑器",
      `按 imageSpec 生成 ${spec.limits.images.min}-${spec.limits.images.max} 张 ${spec.limits.images.ratio || ""} 配图`,
      `发布后在内容尾部/图片角标挂来源码 ${code}`,
      "顾客到店出示来源码，销售端登记，回填 collect",
    ],
    DRAFT_ONLY: [
      "调用公众号草稿箱接口写入 draft（需认证账号 + IP 白名单）",
      "人工在后台预览、补首图 900x383",
      "确认后发布，回填 post_id 到 collect",
    ],
    RENDER_ONLY: [
      "渲染 HTML 模板为 PNG（1242 宽）",
      "打印/投屏，二维码区放来源码",
    ],
    FULL_API: ["调用平台发布接口", "回填 post_id", "定时拉取指标"],
  };

  return {
    status: "manual_handoff",
    simulated: true,
    capability: spec.capability,
    sourceCode: code,
    landingUrl: `https://demo.local/s/${code}`,
    handoff: {
      copyText: draft.copyText,
      title: draft.title,
      imageSpec: spec.limits.images,
      steps: steps[spec.capability] || steps.MANUAL,
    },
    note: "演示环境仅生成交接包，不向真实平台发起写操作",
  };
}

/**
 * collect：效果回收 + 权重建议（反馈闭环）
 * 输入示意数据即可，公式可解释、可复算
 */
export function collect({ posts = [], baseline } = {}) {
  if (!Array.isArray(posts)) throw new Error("posts 必须是数组");
  const byTopic = new Map();
  for (const p of posts) {
    const topic = p.topic || "未归类";
    const row = byTopic.get(topic) || { topic, platform: p.platform || "-", views: 0, leads: 0, consults: 0, deals: 0, posts: 0 };
    row.views += Number(p.views) || 0;
    row.leads += Number(p.leads) || 0;
    row.consults += Number(p.consults) || 0;
    row.deals += Number(p.deals) || 0;
    row.posts += 1;
    byTopic.set(topic, row);
  }

  const rows = [...byTopic.values()].map((r) => ({
    ...r,
    leadRate: r.views ? +(r.leads / r.views).toFixed(4) : 0,
    consultRate: r.leads ? +(r.consults / r.leads).toFixed(4) : 0,
    closeRate: r.consults ? +(r.deals / r.consults).toFixed(4) : 0,
  }));

  const max = (k) => Math.max(...rows.map((r) => r[k]), 1e-9);
  const mL = max("leadRate"), mC = max("consultRate"), mD = max("closeRate");

  const weightSuggestion = rows
    .map((r) => {
      const w = 0.5 * (r.leadRate / mL) + 0.3 * (r.consultRate / mC) + 0.2 * (r.closeRate / mD);
      const prev = baseline?.[r.topic];
      return {
        topic: r.topic,
        weight: Math.round(w * 100),
        delta: prev == null ? null : Math.round(w * 100) - prev,
        reason: `到店率 ${(r.leadRate * 100).toFixed(1)}% · 咨询率 ${(r.consultRate * 100).toFixed(1)}% · 成交率 ${(r.closeRate * 100).toFixed(1)}%`,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  return {
    rows,
    weightSuggestion,
    formula: "weight = 100 × (0.5·到店率/最大值 + 0.3·咨询率/最大值 + 0.2·成交率/最大值)",
    disclaimer: "示意数据，仅用于演示反馈闭环，不代表真实经营结果",
  };
}
