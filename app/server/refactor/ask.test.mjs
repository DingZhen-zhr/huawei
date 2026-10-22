import assert from "node:assert/strict";
import test from "node:test";
import { localAsk } from "./ask.mjs";

test("quick budget ranges are parsed as a midpoint", () => {
  const cases = [
    ["预算 4000–5000", 4500],
    ["预算 5000–6000", 5500],
    ["预算 6000–8000", 7000],
    ["预算 8000 以上", 8000],
  ];
  for (const [text, expected] of cases) {
    const result = localAsk({ messages: [{ role: "user", content: text }] });
    assert.equal(result.slots.budget, expected, text);
  }
});

test("budget plus scenario returns candidate cards and one next question", () => {
  const result = localAsk({ messages: [{ role: "user", content: "预算 8000，主要剪视频" }] });
  assert.ok(result.cards.length > 0);
  assert.ok(result.reply.includes("MateBook GT 14"));
  assert.equal((result.reply.match(/[？?]/g) || []).length, 1);
});
