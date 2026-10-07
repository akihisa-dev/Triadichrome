import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { mechanismImplementations, staleScreens } from "../scripts/data-map.mjs";
import { withNodeBundle } from "../scripts/node-bundle.mjs";
import { projectRoot } from "../scripts/paths.mjs";

test("計算と処理の開示が根拠の実装に追従し、対象漏れと説明の更新漏れを検出する", async () => {
  await withNodeBundle("Triadichrome-extension/src/extension/mechanismModel.ts", async ({ mechanisms }) => {
    const read = file => readFile(path.join(projectRoot, file), "utf8");
    const review = JSON.parse(await read("Triadichrome-extension/src/extension/mechanismReview.json"));
    const implementations = await mechanismImplementations(mechanisms, read);
    const descriptions = mechanisms.map(topic => ({ ...topic, page: topic.id }));
    assert.deepEqual(staleScreens(review, implementations, descriptions), []);
    const changed = await mechanismImplementations(mechanisms, async file => {
      const text = await read(file);
      return file.endsWith("/autoSave.ts") ? text.replace("delay = 600", "delay = 1000") : text;
    });
    assert.ok(staleScreens(review, changed, descriptions).includes("save"));
    const changedCalculation = await mechanismImplementations(mechanisms, async file => {
      const text = await read(file);
      return file.endsWith("/kinds.ts") ? text.replace('manual === undefined', 'manual === null') : text;
    });
    assert.ok(staleScreens(review, changedCalculation, descriptions).includes("inheritance"));
    assert.ok(staleScreens(review, implementations, descriptions.map(item => item.page === "save" ? { ...item, result: "変更" } : item)).includes("save"));
    assert.ok(staleScreens(review, implementations, descriptions.slice(1)).includes(descriptions[0].page));
    await assert.rejects(mechanismImplementations([{ ...mechanisms[0], sources: ["Triadichrome-extension/src/missing.ts"] }]), /ENOENT/);
    assert.equal(new Set(mechanisms.map(topic => topic.id)).size, mechanisms.length);
    for (const topic of mechanisms) {
      assert.ok(topic.inputs.length && topic.steps.length && topic.conditions.length && topic.retention && topic.result);
    }
  });
});
