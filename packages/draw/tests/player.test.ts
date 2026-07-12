import assert from "node:assert/strict";
import { test } from "node:test";
import { LevelIndex } from "@mai-kit/prober";
import type { Bests, PlayerProfile, Score } from "@mai-kit/prober";
import { Draw, DrawError } from "@mai-kit/draw";
import type { ChartTag, DrawSource } from "@mai-kit/draw";

const player: PlayerProfile = {
  name: "Radar Tester",
  rating: 15_000,
  friend_code: 1,
  course_rank: 0,
  class_rank: 0,
  star: 0,
};

const scores: Score[] = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  song_name: `Song ${index + 1}`,
  type: "dx",
  level_index: LevelIndex.MASTER,
  level: "14+",
  achievements: 1_005_000,
  dx_score: 3_000,
  dx_rating: 300 - index,
  rate: "sssp",
}));

const bests: Bests = {
  standard_total: 0,
  dx_total: 0,
  standard: [],
  dx: scores,
  standard_selections: [],
  dx_selections: [],
};

const tags: ChartTag[] = [
  { id: 1, localized_name: { "zh-Hans": "读谱" }, group_id: 1 },
  { id: 2, localized_name: { "zh-Hans": "体力" }, group_id: 1 },
  { id: 3, localized_name: { "zh-Hans": "纵连" }, group_id: 1 },
  { id: 4, localized_name: { "zh-Hans": "旧框" }, group_id: 2 },
];

void test("Draw.withPlayer creates a renderer with radar axes derived from chart tags", async () => {
  const source: DrawSource = {
    async getAsset() {
      return new Uint8Array();
    },
    async getChartTags() {
      return [
        [tags[0], tags[1], tags[3]],
        [tags[0], tags[1]],
        [tags[0], tags[2]],
        [tags[1], tags[2]],
        [tags[0]],
        [tags[2]],
      ];
    },
  };

  const renderer = await new Draw({ database: source }).withPlayer(player, bests);
  assert.deepEqual(renderer.data.radar, [
    { label: "读谱", value: 100, displayValue: 4 },
    { label: "体力", value: 75, displayValue: 3 },
    { label: "纵连", value: 75, displayValue: 3 },
  ]);
});

void test("Draw.withPlayer rejects insufficient radar data instead of inventing axes", async () => {
  const source: DrawSource = {
    async getAsset() {
      return new Uint8Array();
    },
    async getChartTags(charts) {
      return charts.map(() => [tags[0]]);
    },
  };

  await assert.rejects(
    new Draw({ database: source }).withPlayer(player, bests),
    (error: unknown) => error instanceof DrawError && /insufficient/.test(error.message),
  );
});
