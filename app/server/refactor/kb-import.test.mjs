import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { importKbToDisk, importKb } from "./kb-import.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hc-kb-"));
  const modelDir = path.join(root, "P1-产品参数库", "01-鸿蒙电脑", "HUAWEI MateBook Pro");
  fs.mkdirSync(path.join(modelDir, "images"), { recursive: true });
  fs.mkdirSync(path.join(root, "P1-产品参数库", "00-全库横向索引"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "P1-产品参数库", "00-全库横向索引", "全型号参数联合矩阵.csv"),
    "型号,本地事实源,操作系统\nHUAWEI MateBook Pro,P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook Pro/产品事实.md,HarmonyOS\n",
  );
  fs.writeFileSync(path.join(modelDir, "images", "hero.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  fs.writeFileSync(
    path.join(modelDir, "图片索引.csv"),
    "文件名,官网图片说明,建议用途,来源页面\nhero.jpg,HUAWEI MateBook Pro 创拍图,产品介绍配图,https://consumer.huawei.com/\n",
  );
  fs.mkdirSync(path.join(root, "P6-营销素材库", "02-平台模板"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "P6-营销素材库", "02-平台模板", "小红书图文模板.md"),
    "# 小红书图文\n\n开头写具体场景，正文分点，结尾留一个动作。\n",
  );
  return root;
}

test("只导入型号、图片索引和平台指南，并写入媒体目录", () => {
  const root = fixture();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hc-kb-out-"));
  const result = importKbToDisk({ root, outDir: out });
  assert.equal(result.models, 1);
  assert.equal(result.images, 1);
  assert.equal(result.guides, 1);
  const index = JSON.parse(fs.readFileSync(path.join(out, "index.json"), "utf8"));
  assert.equal(index.models[0].full, "HUAWEI MateBook Pro");
  assert.equal(index.models[0].images[0].hero, true);
  assert.ok(fs.existsSync(path.join(out, "media", index.models[0].images[0].file)));
  assert.equal(index.platformGuides[0].title, "小红书图文");
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
});

test("不是知识库根目录时给出可读错误", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hc-kb-empty-"));
  assert.throws(() => importKb({ root }), /全型号参数联合矩阵/);
  fs.rmSync(root, { recursive: true, force: true });
});
