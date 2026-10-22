import assert from "node:assert/strict";
import test from "node:test";
import { listProducts } from "./ledger.mjs";
import { getTaskCards } from "./task-cards.mjs";

test("Create resolves D14 from the complete product catalog and never falls back for invalid IDs", async () => {
  const { createChoices, selectCreateChoice } = await import("../../src/lib/create-selection.ts");
  const choices = createChoices(listProducts(), getTaskCards());
  assert.equal(choices.length, listProducts().length);
  const d14 = selectCreateChoice(choices, "matebook-d-14", "scene-editing");
  assert.equal(d14.productId, "matebook-d-14");
  assert.equal(d14.productAsset, null);
  assert.equal(selectCreateChoice(choices, "nonexistent", "scene-editing"), null);
  assert.equal(selectCreateChoice(choices, "", "nonexistent"), null);
});
