import assert from "node:assert/strict";
import { test } from "node:test";
import { LevelIndex, LxnsMaimaiDatabase } from "@mai-kit/database";

void test("MaimaiDatabase.getChartTags matches exact title, type and difficulty", async () => {
  const db = new LxnsMaimaiDatabase();
  const [tags] = await db.getChartTags([
    { song_name: "7 Wonders", type: "dx", level_index: LevelIndex.MASTER },
  ]);
  assert.ok(tags.length >= 1);
  assert.ok(tags.every((tag) => typeof tag.id === "number" && tag.localized_name));
});

void test("unmatched charts return empty tag lists without fuzzy fallback", async () => {
  const db = new LxnsMaimaiDatabase();
  const [tags] = await db.getChartTags([
    { song_name: "__mai_kit_no_such_song__", type: "dx", level_index: LevelIndex.MASTER },
  ]);
  assert.deepEqual(tags, []);
});
