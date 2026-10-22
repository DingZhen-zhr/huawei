import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";

import { commitProposedFacts, createProposedFacts } from "./fact-import.mjs";
import { getConflict, getFacts, resetFactSearchRuntime, resolveConflict } from "./ledger.mjs";
import { searchOfficialSources } from "./tavily.mjs";
import { verifyContent } from "./verifier.mjs";
import { router } from "./routes.mjs";

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

test("Tavily fetches the official result page instead of trusting search snippets", async () => {
  let pageWasFetched = false;
  const result = await searchOfficialSources("MateBook 14", {
    apiKey: "test-key",
    fetchImpl: async (url) => {
      if (url === "https://api.tavily.com/search") {
        return new Response(JSON.stringify({ results: [{ url: "https://consumer.huawei.com/cn/laptops/matebook-14/", title: "官方页", raw_content: "Tavily 摘要不可作为正文" }] }), { headers: { "content-type": "application/json" } });
      }
      pageWasFetched = true;
      return new Response("<html><body>这是实际抓取的华为官方正文，长度足够作为候选来源。</body></html>", { headers: { "content-type": "text/html" } });
    },
  });
  assert.equal(pageWasFetched, true);
  assert.equal(result.status, "proposed");
  assert.match(result.sources[0].excerpt, /实际抓取/);
  assert.doesNotMatch(result.sources[0].excerpt, /Tavily 摘要/);
});

test("empty official page returns needs_evidence instead of a candidate", async () => {
  const result = await searchOfficialSources("MateBook 14", {
    apiKey: "test-key",
    fetchImpl: async (url) => url === "https://api.tavily.com/search"
      ? new Response(JSON.stringify({ results: [{ url: "https://consumer.huawei.com/cn/laptops/matebook-14/", title: "官方页", content: "不应使用" }] }), { headers: { "content-type": "application/json" } })
      : new Response("", { headers: { "content-type": "text/html" } }),
  });
  assert.equal(result.status, "needs_evidence");
  assert.equal(result.sources.length, 0);
});

test("runtime regression test never recursively removes the repository-root server directory", () => {
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.doesNotMatch(source, /rmSync\(resolve\(repo, "server"\), \{ recursive: true, force: true \}\)/);
});

test("search timeout is explicit and never exposes the API key", async () => {
  const result = await searchOfficialSources("MateBook 14", {
    apiKey: "super-secret-key",
    fetchImpl: async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; },
  });
  assert.equal(result.status, "needs_evidence");
  assert.match(result.reason, /超时/);
  assert.doesNotMatch(JSON.stringify(result), /super-secret-key/);
});

test("prices older than seven days are stale", () => {
  const result = verifyContent("¥7,999", "matebook-gt-14", { sku: "官网产品页对应版本", now: new Date("2026-10-25T00:00:00.000Z") });
  assert.equal(result.claims[0].status, "stale");
});

test("runtime location is stable when tests start at the repository root", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const wrongRoot = resolve(repo, "server");
  const wrongRuntime = resolve(repo, "server/data/runtime/fact-search.json");
  const correctRuntime = resolve(repo, "app/server/data/runtime/fact-search.json");
  assert.equal(existsSync(wrongRoot), false, "refusing to touch an existing repository-root server directory");
  try {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", "import { resetFactSearchRuntime } from './app/server/refactor/ledger.mjs'; resetFactSearchRuntime();"], { cwd: repo, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(existsSync(wrongRuntime), false, "must never create repository-root server/data runtime files");
    assert.equal(existsSync(correctRuntime), true);
  } finally {
    // The root directory did not exist before this test. If a regression created
    // this exact runtime file, clean only that proven test artifact and empty parents.
    if (existsSync(wrongRuntime)) {
      rmSync(wrongRuntime, { force: true });
      for (const path of [resolve(repo, "server/data/runtime"), resolve(repo, "server/data"), wrongRoot]) {
        try { rmdirSync(path); } catch { /* preserve anything not created solely by this test */ }
      }
    }
  }
});

test("committing a clean proposal persists an active ledger fact", () => {
  const source = { id: "src:commit", url: "https://consumer.huawei.com/cn/laptops/", capturedAt: "2026-10-22T00:00:00.000Z", excerpt: "16GB", trustTier: 1 };
  const [proposal] = createProposedFacts({ productId: "matebook-gt-14", model: "HUAWEI MateBook GT 14", sku: "GT14-16G", field: "memory", value: "16GB", unit: "GB", source });
  const [committed] = commitProposedFacts([proposal.id]);
  assert.equal(committed.committed, true);
  assert.ok(getFacts("matebook-gt-14", { includePrice: true }).some((fact) => fact.id === proposal.id && fact.status === "active"));
});

test("administrator import APIs reject anonymous use and persist a committed proposal", async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${origin}/admin/sources`)).status, 401);
    const login = await fetch(`${origin}/admin/demo`, { method: "POST" });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    const preview = await fetch(`${origin}/admin/import/preview`, {
      method: "POST", headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ productId: "matebook-gt-14", model: "HUAWEI MateBook GT 14", sku: "API-16G", field: "ports", value: "USB-C", unit: "", source: { id: "src:api-test", url: "https://consumer.huawei.com/cn/laptops/", capturedAt: "2026-10-22T00:00:00.000Z", excerpt: "USB-C 接口", trustTier: 1 } }),
    });
    assert.equal(preview.status, 201);
    const proposed = (await preview.json()).facts[0];
    const committed = await fetch(`${origin}/admin/import/commit`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ ids: [proposed.id] }) });
    assert.equal(committed.status, 200);
    assert.equal((await committed.json()).facts[0].status, "active");
    const invalidResolve = await fetch(`${origin}/admin/conflicts/conflict:matebook-14-harmony:price/resolve`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(invalidResolve.status, 400);
  } finally {
    server.close();
  }
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

test("short numeric tokens do not self-verify inside larger specs", () => {
  assert.equal(verifyContent("2GB", productId).status, "blocked");
  assert.equal(verifyContent("49kg", productId).status, "blocked");
  assert.equal(verifyContent("512GB", productId).status, "ready");
});

test("common yuan price formats are treated as price claims", () => {
  for (const text of ["4999元", "￥4999", "RMB4999", "CNY 4,999"]) {
    const result = verifyContent(text, "matebook-gt-14");
    assert.equal(result.status, "blocked", text);
    assert.equal(result.claims[0]?.type, "price", text);
  }
  assert.equal(verifyContent("预算 6000 元", "matebook-gt-14").status, "ready");
});

test("unbacked gift items are blocked instead of passing on the keyword alone", () => {
  const fake = verifyContent("赠品一台汽车", productId);
  assert.equal(fake.status, "blocked");
  assert.equal(fake.claims[0]?.type, "commercial");
  const backed = verifyContent("赠品为FreeBuds SE 2陶瓷白和华为无线鼠标星闪版砚黑", productId);
  assert.equal(backed.status, "ready");
});

test("production auth fails closed without explicit secrets", () => {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", "import('./server/refactor/auth.mjs')"], {
    cwd: appDir,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", HC_SESSION_SECRET: "", ADMIN_PASSCODE: "", HC_DEMO_MODE: "false" },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /HC_SESSION_SECRET/);
});
