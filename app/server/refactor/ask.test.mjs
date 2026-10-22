import assert from "node:assert/strict";
import test from "node:test";
import { localAsk } from "./ask.mjs";
import { getFacts, getProduct, listProducts } from "./ledger.mjs";
import { generatePlatformVariants } from "./generator.mjs";

const ask = (...turns) => localAsk({ messages: turns.map((content) => ({ role: "user", content })), now: new Date("2026-10-22T00:00:00Z") });

test("later explicit budget overrides the earlier budget and preserves the use", () => {
  const result = ask("预算4000元，主要办公", "预算改为6000元");
  assert.equal(result.slots.budget, 6000);
  assert.equal(result.slots.scenario, "办公");
});

test("reverse budget wording updates the budget and comparison wording preserves it", () => {
  assert.equal(ask("预算6000，办公", "5000预算").slots.budget, 5000);
  assert.equal(ask("预算4000，办公", "预算先不变，只想看看6000左右的差别").slots.budget, 4000);
});

test("budget events apply in textual order within a turn", () => {
  assert.equal(ask("预算4000，办公，预算改为6000").slots.budget, 6000);
  assert.equal(ask("之前预算4000，现在预算6000，办公").slots.budget, 6000);
  assert.equal(ask("预算4000，预算先不变，只想看看8000左右的差别，最终预算改为6000，办公").slots.budget, 6000);
});

for (const phrase of ["预算大约6000", "预算控制在6000", "预算只有6000"]) {
  test(`short budget connector works on first and later turns: ${phrase}`, () => {
    assert.equal(ask(`${phrase}，办公`).slots.budget, 6000, phrase);
    assert.equal(ask("预算4000，办公", phrase).slots.budget, 6000, phrase);
    assert.equal(ask(`${phrase}，办公，预算改为7000`).slots.budget, 7000, phrase);
  });
}

test("nonexclusive OS requirements remain positive Windows constraints", () => {
  for (const inclusive of ["不仅", "不只", "不光"]) {
    const result = ask(`预算10000，办公，${inclusive}要Windows，还要轻一点`);
    assert.equal(result.slots.os, "Windows");
    assert.ok(result.cards.length);
    for (const card of result.cards) {
      assert.ok(getFacts(card.id).some((fact) => /系统.*Windows|Windows.*系统/.test(String(fact.value))));
      assert.equal(card.budgetFit, "unknown");
      assert.equal(card.overBy, null);
    }
  }
});

test("negation ends at a new use and nonexclusive language does not impose constraints", () => {
  assert.equal(ask("预算6000，不做设计只办公").slots.scenario, "办公");
  assert.equal(ask("预算6000，不剪视频只办公").slots.scenario, "办公");
  assert.equal(ask("预算6000，不仅办公还剪视频").slots.scenario, "办公");
  assert.equal(ask("预算6000，办公，不一定非要Windows").slots.os, null);
});

test("negation scopes over coordinated uses until an explicit affirmative contrast", () => {
  for (const join of ["和", "或", "以及", "、"]) {
    assert.equal(ask(`预算6000，不剪视频${join}玩游戏`).slots.scenario, null);
  }
  for (const contrast of ["但", "只", "而是"]) {
    assert.equal(ask(`预算6000，不做设计${contrast}剪视频`).slots.scenario, "剪视频");
  }
});

test("revoking the final positive use never revives a previously coordinated negative use", () => {
  assert.equal(ask("预算6000，不做设计和剪视频，只办公", "不办公了").slots.scenario, null);
});

test("real mixed-OS ledger prices cannot imply the Windows configuration fits the budget", () => {
  const result = ask("预算6000，办公，需要Windows");
  assert.ok(result.cards.some((card) => card.id === "matebook-d-14"));
  assert.ok(result.cards.some((card) => card.id === "matebook-d-16"));
  for (const card of result.cards) {
    assert.equal(card.budgetFit, "unknown");
    assert.equal(card.overBy, null);
    assert.match(card.priceLabel, /Windows配置报价.*确认/);
  }
});

test("OS budget assessment uses the matching configuration price, not the generic minimum", async () => {
  const { budgetAssessment } = await import("./ask.mjs");
  const p = getProduct("matebook-d-14");
  const fact = p.facts.find((item) => item.field === "price");
  const now = new Date("2026-10-22T00:00:00Z");
  const configured = { ...p, facts: [...p.facts, { ...fact, id: "windows-test", sku: "Windows 11 / i5 / 16GB", value: 6299 }] };
  assert.equal(budgetAssessment(p, 6000, now, { os: "Windows" }).budgetFit, "unknown");
  const assessed = budgetAssessment(configured, 6000, now, { os: "Windows" });
  assert.equal(assessed.budgetFit, "over");
  assert.equal(assessed.overBy, 299);
  assert.equal(assessed.price, 6299);
  for (const configuration of ["Windows或Linux对应版本", "不支持Windows", "仅HarmonyOS，Windows不可用"]) {
    const ambiguous = { ...p, facts: [{ ...fact, sku: configuration }] };
    assert.equal(budgetAssessment(ambiguous, 6000, now, { os: "Windows" }).budgetFit, "unknown");
  }
  assert.equal(budgetAssessment({ ...configured, price: { ...p.price, status: "conflict" } }, 6000, now, { os: "Windows" }).overBy, null);
});

test("negated uses and operating system do not become positive requirements", () => {
  assert.equal(ask("预算6000，不剪视频不玩游戏，只办公").slots.scenario, "办公");
  assert.equal(ask("预算8000，不做设计但剪视频").slots.scenario, "剪视频");
  assert.equal(ask("预算8000，办公，不需要Windows").slots.os, null);
  assert.equal(ask("预算8000，剪视频", "现在不剪视频了").slots.scenario, null);
  assert.equal(ask("预算8000，剪视频和设计", "不做设计了").slots.scenario, "剪视频");
});

test("a new explicit use takes precedence while budget and audience persist", () => {
  const result = ask("大学生，预算8000，办公", "主要剪视频");
  assert.equal(result.slots.scenario, "剪视频");
  assert.equal(result.slots.budget, 8000);
  assert.equal(result.slots.segment, "学生");
});

test("14 inch class includes factual 14.2 inch models but excludes 16 inch models", () => {
  const result = ask("预算8000，办公，必须Windows，14寸左右");
  assert.ok(result.cards.length);
  assert.ok(result.cards.every((card) => !card.id.includes("16")));
  assert.ok(result.cards.some((card) => card.id === "matebook-14-ultra"));
});

test("Windows and exact screen cap filter by same-model system and screen facts", () => {
  const result = ask("预算6000，办公，必须Windows，14英寸以内");
  assert.deepEqual(result.cards.map((card) => card.id), ["matebook-d-14"]);
  assert.match(result.cards[0].limitation, /Windows配置/);
});

test("known within-budget products precede overruns and products without images remain eligible", () => {
  const result = ask("预算6000，办公");
  assert.ok(result.cards.some((card) => card.id === "matebook-d-14"));
  assert.ok(result.cards.every((card) => card.budgetFit === "within"));
  const low = ask("预算3000，办公");
  assert.ok(low.cards.every((card) => card.budgetFit === "over" && card.overBy > 0));
  assert.match(low.reply, /备选/);
});

test("conflict, missing and stale prices have unknown budget fit", async () => {
  const { budgetAssessment } = await import("./ask.mjs");
  const now = new Date("2026-10-22T00:00:00Z");
  const p = getProduct("matebook-d-14");
  assert.equal(budgetAssessment(p, 6000, now).budgetFit, "within");
  assert.equal(budgetAssessment(p, 6000, new Date("2026-10-25T00:00:00Z")).overBy, null);
  for (const status of ["conflict", "missing", "stale"]) {
    const assessment = budgetAssessment({ ...p, price: { ...p.price, status } }, 6000, now);
    assert.equal(assessment.budgetFit, "unknown");
    assert.equal(assessment.overBy, null);
  }
  assert.equal(budgetAssessment({ ...p, facts: [] }, 6000, now).budgetFit, "unknown");
});

test("every real ledger model can generate all channels without borrowing another model facts", () => {
  for (const { id } of listProducts()) {
    const product = getProduct(id);
    for (const platform of ["xiaohongshu", "moments", "wechat-mp", "poster", "video"]) {
      const variants = generatePlatformVariants({ product, platform, realDetail: "每天带到办公室", audience: "上班族", scene: "办公", target: "到店看实物" });
      assert.ok(variants.length);
      for (const variant of variants) {
        assert.equal(variant.model, product.name);
        assert.ok(variant.evidenceIds.every((evidenceId) => getFacts(id).some((fact) => fact.id === evidenceId)));
        assert.ok(!variant.body.includes("undefined"));
        if (id === "matebook-d-14") assert.ok(!variant.body.includes("OLED"));
      }
    }
  }
});

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
