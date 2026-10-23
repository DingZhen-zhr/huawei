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
  assert.ok(result.askBack.some((question) => question.includes("系统")));
  assert.ok(result.askBack.some((question) => question.includes("屏幕")));
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

const NOW = new Date("2026-10-22T12:00:00.000Z");

test("negated purposes do not become a segment", () => {
  const result = localAsk({ messages: [{ role: "user", content: "不剪视频不玩游戏" }], now: NOW });
  assert.equal(result.slots.segment, null);
  assert.equal(result.slots.scenario, null);
});

test("budget recommendations skip conflict prices and do not treat reference prices as current", () => {
  const result = localAsk({ messages: [{ role: "user", content: "预算 6000，通勤" }], now: NOW });
  assert.ok(result.cards.length > 0);
  assert.ok(!result.cards.some((card) => card.id === "matebook-14-harmony"));
  assert.ok(!/5,899|6,599/.test(result.reply));
  for (const card of result.cards) {
    assert.notEqual(card.priceKind, "conflict");
    assert.equal(card.overBy, 0);
  }
  assert.ok(result.cards.some((card) => card.id === "matebook-d-14" || card.id === "matebook-d-16"));
});

test("screen size cap filters larger models", () => {
  const result = localAsk({ messages: [{ role: "user", content: "14 英寸以内，预算 6000，办公" }], now: NOW });
  assert.equal(result.slots.screenMax, 14);
  assert.ok(result.cards.length > 0);
  for (const card of result.cards) assert.ok(card.screenSize !== null && card.screenSize <= 14);
});

test("prices older than seven days are not treated as current for budget matching", () => {
  const result = localAsk({ messages: [{ role: "user", content: "预算 9000，办公" }], now: new Date("2026-11-01T12:00:00.000Z") });
  assert.ok(!result.cards.some((card) => card.priceKind === "within"));
});
