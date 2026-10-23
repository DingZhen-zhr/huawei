import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCopy } from "./copy-quality.mjs";

test("标题里的定义句会被标出来", () => {
  const result = analyzeCopy("轻，是拿在手里的。\n\n这台标准屏版 798 克。");
  assert.ok(result.issues.some((issue) => issue.type === "金句式定义"));
});

test("补出来的顾客对白会被标出来", () => {
  const result = analyzeCopy("顾客把旧电脑放下。他拎着没说话，又拎了一下自己包里那台。");
  assert.ok(result.issues.some((issue) => issue.type === "疑似补了对白/动作"));
});

test("正常的门店描述不会被误报成对白", () => {
  const result = analyzeCopy("顾客把旧电脑放在桌上，按了按肩膀。标准屏版 798 克。");
  assert.equal(result.issues.length, 0);
});

import { trimDataDensity } from "./copy-quality.mjs";

test("小红书正文会自动删掉参数堆叠", () => {
  const dense = `每天地铁来回一个半小时，肩上那台旧电脑接近两公斤。

到店先摸这台，标准屏版 798 g。

屏幕 14.2 英寸，3120 × 2080，264 ppi，120 Hz，电池 54 Wh。

系统 HarmonyOS 6.1，处理器麒麟 XE90，内存 16/24/32 GB，存储 512 GB/1 TB。

官方商城价 ¥7,999 起，以门店实际报价为准。`;
  const out = trimDataDensity(dense, "xiaohongshu");
  assert.ok((out.match(/\d+(?:\.\d+)?/g) || []).length <= 4);
  assert.ok(out.split(/\n{2,}/).length <= 4);
  assert.ok(out.includes("798"));
});

test("公众号保留的规格比小红书多", () => {
  const dense = "第一段。\n\n14.2 英寸，3120 × 2080，120 Hz，54 Wh，16/24/32 GB，512 GB/1 TB。\n\n到店看实物。";
  const social = trimDataDensity(dense, "xiaohongshu");
  const article = trimDataDensity(dense, "wechat-mp");
  assert.ok((article.match(/\d+(?:\.\d+)?/g) || []).length >= (social.match(/\d+(?:\.\d+)?/g) || []).length);
});
