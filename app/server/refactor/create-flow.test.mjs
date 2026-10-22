import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import express from "express";

test("D14 HTTP creation keeps model and brief through generation, refresh and process reload", async () => {
  const runtime = mkdtempSync(join(tmpdir(), "aix-create-flow-"));
  process.env.HC_RUNTIME_DIR = runtime;
  const { router } = await import("./routes.mjs");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const login = await fetch(`${origin}/auth/demo`, { method: "POST" });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = { cookie, "content-type": "application/json" };
    const catalog = await (await fetch(`${origin}/products`, { headers })).json();
    assert.equal(catalog.products.find((product) => product.id === "matebook-d-14").asset, null);
    const body = { productId: "matebook-d-14", audience: "大学生", scene: "办公", target: "先收藏对比", realDetail: { text: "每天背去图书馆", source: "sales_provided", confirmed: true }, questionAnswers: { budget: "6000" } };
    const invalid = await fetch(`${origin}/content/tasks`, { method: "POST", headers, body: JSON.stringify({ ...body, productId: "invalid" }) });
    assert.equal(invalid.status, 400);
    const response = await fetch(`${origin}/content/tasks`, { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    const { taskId } = await response.json();
    let snapshot;
    for (let i = 0; i < 100; i++) {
      snapshot = await (await fetch(`${origin}/content/tasks/${taskId}`, { headers })).json();
      if (["done", "partial", "failed"].includes(snapshot.task.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.variants.length, 11);
    assert.deepEqual(snapshot.errors, []);
    for (let i = 0; i < 2; i++) {
      const refreshed = await (await fetch(`${origin}/content/tasks/${taskId}`, { headers })).json();
      assert.equal(refreshed.task.productId, body.productId);
      assert.equal(refreshed.task.productAsset, null);
      for (const key of ["audience", "scene", "target"]) assert.equal(refreshed.task[key], body[key]);
    }
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `import { getTask } from './app/server/refactor/tasks.mjs'; const task = getTask(${JSON.stringify(taskId)}); console.log(JSON.stringify({ productId: task.productId, budget: task.questionAnswers.budget, status: task.status }));`], { cwd: new URL("../../../", import.meta.url), encoding: "utf8", env: { ...process.env, HC_RUNTIME_DIR: runtime } });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout.trim()), { productId: body.productId, budget: "6000", status: "done" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(runtime, { recursive: true, force: true });
  }
});
