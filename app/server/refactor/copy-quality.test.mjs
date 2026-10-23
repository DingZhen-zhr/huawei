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
