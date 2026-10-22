// 冒烟测试：内核行为 + MCP stdio 协议握手
// 运行：node server/mcp/smoke.mjs
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listPlatforms, getSpec, adapt, review, publish, collect } from "./core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
const assert = (cond, label, detail = "") => {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` → ${detail}` : ""}`);
  }
};

const BAD = {
  id: "demo-bad",
  factsBaseDate: "2026-10-17",
  variants: [
    {
      platform: "xiaohongshu",
      title: "这台笔记本是全网最好的轻薄本",
      body: "真的很轻，很好用。",
      tags: ["轻薄本"],
    },
  ],
};

const GOOD_BODY = `每天通勤两小时，背包里那台老笔记本一开盖就发烫🔥
做设计的同学应该懂，风扇一响，导出视频要等到怀疑人生😮‍💨
上周有位做短视频的顾客来店里，预算 6000 左右，主要剪 4K 素材。
我们现场跑了同一条时间线，半小时出片，机身只是温温的✨
轻薄本不是越轻越好，要看散热和屏幕色准能不能扛住你的活。
这台 1.29kg，单手拎着走一下午也不累💼
屏幕 100% sRGB，修图不用来回对色🎨
接口也够用，读卡器、移动硬盘都能直连，不用拖个扩展坞🔌
续航实测剪片 6 小时左右，咖啡店坐一下午不慌☕
如果你也在纠结，评论区说下你的场景，我按预算帮你挑。
到店可以直接上手试，素材我们准备好👌`;

const GOOD = {
  id: "demo-good",
  factsBaseDate: "2026-10-17",
  variants: [
    {
      platform: "xiaohongshu",
      title: "剪4K不烫手的轻薄本怎么挑",
      body: GOOD_BODY,
      tags: ["轻薄本推荐", "剪辑党", "开学季", "华为PC"],
      images: [
        { ratio: "3:4", caption: "机身厚度实拍" },
        { ratio: "3:4", caption: "时间线导出对比" },
        { ratio: "3:4", caption: "色准测试图" },
        { ratio: "3:4", caption: "门店体验位" },
      ],
      cta: "到店报暗号「小红书」，可约 30 分钟剪辑实测。",
    },
  ],
};

console.log("\n[1] 平台注册表");
const list = listPlatforms();
assert(list.length === 4, "接入 4 个平台", JSON.stringify(list.map((x) => x.platform)));
assert(list.every((x) => x.capability), "每个平台都声明了发布能力");

console.log("\n[2] 规则卡读取");
const spec = getSpec("xiaohongshu");
assert(spec.limits.titleMax === 20, "小红书标题上限 20 字");
assert(spec.banned.includes("最好"), "极限词表含「最好」");

console.log("\n[3] adapt：坏稿应被裁剪并补齐必备项");
const badDraft = adapt(BAD, "xiaohongshu");
assert([...badDraft.title].length <= 20, "标题被裁到 20 字内", badDraft.title);
assert(badDraft.body.includes("#AI生成"), "自动补 AI 生成标识");
assert(badDraft.meta.sourceCode.startsWith("XHS-"), "生成来源码", badDraft.meta.sourceCode);

console.log("\n[4] review：坏稿必须打回且原因可定位");
const badReview = review(badDraft);
assert(badReview.verdict === "revise", "结论为 revise", badReview.verdict);
const rules = new Set(badReview.issues.map((i) => i.rule));
assert(rules.has("banned_word"), "命中极限词规则");
assert(rules.has("body_too_short"), "命中正文过短规则");
assert(rules.has("tags_too_few"), "命中标签不足规则");
assert(badReview.issues.find((i) => i.rule === "banned_word")?.snippet, "极限词带上下文片段");
console.log(`     示例打回：${badReview.issues[0].message}`);

console.log("\n[5] review：好稿应通过");
const goodDraft = adapt(GOOD, "xiaohongshu");
const goodReview = review(goodDraft);
assert(goodReview.verdict !== "revise", "结论非 revise", `${goodReview.verdict} / score ${goodReview.score}`);
assert(!goodReview.issues.some((i) => i.level === "error"), "无 error 级问题", JSON.stringify(goodReview.issues.map((i) => i.rule)));
console.log(`     评分 ${goodReview.score}，warn ${goodReview.warnCount} 条`);

console.log("\n[6] publish：能力分级 + 人工交接");
const pub = publish(goodDraft);
assert(pub.simulated === true, "明确标注 simulated");
assert(pub.status === "manual_handoff", "小红书走人工交接");
assert(pub.handoff.copyText.includes(goodDraft.title), "交接包含可粘贴全文");
assert(pub.landingUrl.includes(pub.sourceCode), "来源码进入落地页");
const blocked = publish(goodDraft, { mode: "api" });
assert(blocked.status === "blocked", "无 API 能力的平台拒绝 api 模式");

console.log("\n[7] collect：归因与权重");
const metrics = collect({
  posts: [
    { postId: "p1", platform: "xiaohongshu", topic: "剪辑性能", views: 12000, leads: 96, consults: 61, deals: 9 },
    { postId: "p2", platform: "moments", topic: "开学季", views: 3000, leads: 8, consults: 5, deals: 1 },
    { postId: "p3", platform: "wechat-mp", topic: "剪辑性能", views: 2000, leads: 22, consults: 14, deals: 2 },
  ],
  baseline: { 剪辑性能: 50, 开学季: 50 },
});
assert(metrics.weightSuggestion[0].topic === "剪辑性能", "高转化主题权重排第一");
assert(metrics.weightSuggestion[0].delta > 0, "权重相对基线上升");
assert(metrics.disclaimer.includes("示意数据"), "明确标注示意数据");

console.log("\n[8] MCP stdio 协议");
const child = spawn(process.execPath, [path.join(HERE, "server.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
let seq = 0;
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => pending.has(id) && reject(new Error(`timeout: ${method}`)), 4000);
  });

try {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  assert(!!init.result?.protocolVersion, "initialize 返回协议版本", init.result?.protocolVersion);
  assert(init.result?.capabilities?.tools, "声明 tools 能力");

  const tools = await rpc("tools/list", {});
  assert(tools.result.tools.length === 6, "暴露 6 个工具", String(tools.result?.tools?.length));

  const call = await rpc("tools/call", { name: "platform_get_spec", arguments: { platform: "moments" } });
  const payload = call.result.structuredContent;
  assert(payload.platform === "moments", "tools/call 返回结构化结果");
  assert(call.result.content[0].text.includes("朋友圈"), "同时返回 text 内容");

  const adaptCall = await rpc("tools/call", {
    name: "platform_adapt",
    arguments: { platform: "xiaohongshu", package: GOOD },
  });
  assert(adaptCall.result.structuredContent.review.verdict !== "revise", "adapt 内联返回审核结论");

  const bad = await rpc("tools/call", { name: "platform_review", arguments: { draft: badDraft } });
  assert(bad.result.isError === false && bad.result.structuredContent.verdict === "revise", "坏稿经协议层也判 revise");
} catch (e) {
  failed++;
  console.log(`  ❌ 协议测试异常：${e.message}`);
} finally {
  child.stdin.end();
  child.kill();
}

console.log(failed ? `\n❌ 失败 ${failed} 项` : "\n✅ 全部通过");
process.exit(failed ? 1 : 0);
