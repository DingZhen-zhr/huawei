import assert from "node:assert/strict";
import test from "node:test";

import { createProposedFacts } from "./fact-import.mjs";
import { getConflict, resetFactSearchRuntime, resolveConflict } from "./ledger.mjs";
import { searchOfficialSources } from "./tavily.mjs";
import { verifyContent } from "./verifier.mjs";

const productId = "matebook-14-harmony";

test("unknown price is blocked with its precise span", () => {
  const result = verifyContent("今日到手 ¥4,999", productId);
  const claim = result.claims.find((item) => item.type === "price");
  assert.equal(result.status, "blocked");
  assert.equal(claim.status, "blocked");
  assert.deepEqual(claim.span, { start: 5, end: 11 });
});

test("open price conflict remains blocked", () => {
  const result = verifyContent("官方参考 ¥5,899 起", productId);
  assert.equal(result.claims[0].status, "blocked");
  assert.match(result.claims[0].reason, /冻结/);
});

test("Tavily candidates accept only official sources and never become facts", async () => {
  const rejected = await searchOfficialSources("MateBook 14", {
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ results: [{ url: "https://example.com/a", title: "第三方", content: "内容足够长" }] }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(rejected.status, "needs_evidence");
  assert.equal(rejected.sources.length, 0);

  const proposed = createProposedFacts({
    productId,
    model: "HUAWEI MateBook 14（鸿蒙版）",
    sku: "MB14-TEST",
    field: "price",
    value: 6999,
    unit: "CNY",
    source: { id: "src:official", url: "https://consumer.huawei.com/cn/laptops/", capturedAt: "2026-10-22T00:00:00.000Z", excerpt: "¥6999", trustTier: 1 },
  });
  assert.equal(proposed[0].status, "proposed");
  assert.equal(proposed[0].conflict, true);
  assert.equal(proposed[0].committed, false);
});

test("only confirmed SKU is unfrozen and creates audit history", () => {
  resetFactSearchRuntime();
  const before = getConflict(productId);
  assert.equal(before.status, "open");
  assert.throws(() => resolveConflict(before.id, { sku: "", region: "CN", effectiveFrom: "2026-10-22", sourceId: "src:one", conclusion: "确认" }), /SKU/);
  const resolved = resolveConflict(before.id, { sku: "MB14-TEST", region: "CN", effectiveFrom: "2026-10-22", sourceId: "src:one", value: 6599, conclusion: "确认 6599 为该 SKU 的官方参考价" });
  assert.equal(resolved.status, "partially_resolved");
  assert.equal(resolved.audit.length, 1);
  assert.equal(verifyContent("¥6,599", productId, { sku: "MB14-TEST" }).claims[0].status, "supported");
  assert.equal(verifyContent("¥5,899", productId, { sku: "ANOTHER-SKU" }).claims[0].status, "blocked");
  resetFactSearchRuntime();
});
