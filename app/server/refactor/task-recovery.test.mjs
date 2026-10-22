import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("an interrupted persisted task is requeued and completed on boot", () => {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const runtimeDir = resolve(appDir, "server/data/runtime-recovery-test");
  mkdirSync(runtimeDir, { recursive: true });
  const task = {
    id: "recovery-test-task",
    storeId: "store:test",
    storeName: "测试门店",
    productId: "matebook-pro-s",
    productName: "HUAWEI MateBook Pro S",
    productShortName: "MateBook Pro S",
    productAsset: "/media/matebook-pro-s.jpg",
    taskCardId: "scene-light-carry",
    brief: "",
    audience: "通勤上班族",
    scene: "到店体验 / 通勤随身",
    target: "到店摸一摸",
    realDetail: { text: "通勤路上要一直拎着走", source: "sales_provided", confirmed: true },
    questionAnswers: {},
    status: "running",
    progress: { stage: "writing", label: "写五渠道", percent: 58 },
    generationMode: "rules-v1",
    variants: [],
    evidence: [],
    conflicts: [],
    errors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  writeFileSync(resolve(runtimeDir, "tasks.json"), JSON.stringify([task]));

  const script = `
    import { getTask } from "./server/refactor/tasks.mjs";
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const task = getTask("recovery-test-task");
    console.log(JSON.stringify({ status: task?.status, variants: task?.variants?.length || 0, label: task?.progress?.label }));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: appDir,
    encoding: "utf8",
    env: { ...process.env, HC_RUNTIME_DIR: runtimeDir },
  });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout.trim().split("\n").at(-1));
  assert.equal(result.status, "done");
  assert.equal(result.variants, 11);
  const persisted = JSON.parse(readFileSync(resolve(runtimeDir, "tasks.json"), "utf8"));
  assert.equal(persisted[0].status, "done");
});
