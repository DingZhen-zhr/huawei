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

test("later budget overrides the earlier one", () => {
  const result = localAsk({
    messages: [
      { role: "user", content: "预算 4500，剪视频" },
      { role: "assistant", content: "好" },
      { role: "user", content: "预算 9000" },
    ],
  });
  assert.equal(result.slots.budget, 9000);
  assert.equal(result.slots.scenario, "剪视频");
});

test("negated scenario is not treated as a match", () => {
  const result = localAsk({ messages: [{ role: "user", content: "不剪视频，主要办公，预算 6000" }] });
  assert.equal(result.slots.scenario, "办公");
});

test("Windows requirement filters out Harmony models", () => {
  const result = localAsk({ messages: [{ role: "user", content: "要 Windows，预算 6000，办公" }] });
  assert.equal(result.slots.os, "windows");
  assert.ok(result.cards.length > 0);
  for (const card of result.cards) assert.match(card.family || "", /Windows/);
});

test("a later number in the same sentence overrides the earlier budget", () => {
  const result = localAsk({ messages: [{ role: "user", content: "预算 4500 改 9000，剪视频" }] });
  assert.equal(result.slots.budget, 9000);
});
