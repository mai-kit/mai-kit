import assert from "node:assert/strict";
import { test } from "node:test";
import { getChartTagSnapshot, getLocalChartTags, LevelIndex } from "@mai-kit/database";

void test("bundled DXRating snapshot contains tags and chart relations", async () => {
  const snapshot = await getChartTagSnapshot();
  assert.equal(snapshot.schema_version, 1);
  assert.ok(snapshot.tags.length >= 20);
  assert.ok(snapshot.tag_groups.length >= 3);
  assert.ok(snapshot.charts.length >= 100);
});

void test("chart tags are matched by exact title, type and difficulty", async () => {
  const [tags] = await getLocalChartTags([
    {
      song_name: "ウミユリ海底譚",
      type: "standard",
      level_index: LevelIndex.MASTER,
    },
  ]);
  assert.ok(tags.some((tag) => tag.localized_name["zh-Hans"] === "错位"));
});

void test("unmatched charts do not use fuzzy fallback", async () => {
  const [tags] = await getLocalChartTags([
    {
      song_name: "不存在的曲目",
      type: "dx",
      level_index: LevelIndex.MASTER,
    },
  ]);
  assert.deepEqual(tags, []);
});
