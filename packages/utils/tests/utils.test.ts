import assert from "node:assert/strict";
import { test } from "node:test";
import * as publicUtils from "@mai-kit/utils";
import {
  calculateAchievement,
  calculateChartDxScore,
  calculateDxRating,
  dxMaxFromNoteTotal,
  dxRatingCoefficient,
  dxScorePercentage,
  dxStarFromScore,
  minimumAchievementForRate,
  normalizeAchievement,
  parseLevelString,
  rateFromAchievement,
  requiredLevelValue,
} from "@mai-kit/utils";
import {
  buildSongDxMaxMap,
  buildSongLevelMap,
  chartMapKey,
  findSongDifficulty,
  scoreMapKey,
} from "@mai-kit/utils/song";

void test("package root exposes only common stable utilities", () => {
  assert.deepEqual(Object.keys(publicUtils).sort(), [
    "calculateAchievement",
    "calculateChartDxScore",
    "calculateDxRating",
    "dxMaxFromNoteTotal",
    "dxRatingCoefficient",
    "dxScorePercentage",
    "dxStarFromScore",
    "minimumAchievementForRate",
    "normalizeAchievement",
    "parseLevelString",
    "rateFromAchievement",
    "requiredLevelValue",
  ]);
});

void test("dxMaxFromNoteTotal is notes × 3", () => {
  assert.equal(dxMaxFromNoteTotal(1000), 3000);
  assert.equal(dxMaxFromNoteTotal(761), 2283);
});

void test("normalizeAchievement handles percent and 1/10000 units", () => {
  assert.equal(normalizeAchievement(100.8621), 100.8621);
  assert.equal(normalizeAchievement(1_008_621), 100.8621);
});

void test("scoreMapKey / chartMapKey stay aligned", () => {
  assert.equal(scoreMapKey({ id: 1, type: "dx", level_index: 3 }), chartMapKey(1, "dx", 3));
});

void test("parseLevelString", () => {
  assert.equal(parseLevelString("14"), 14);
  assert.equal(parseLevelString("14+"), 14.7);
  assert.equal(parseLevelString(undefined), undefined);
  assert.equal(parseLevelString("MASTER"), undefined);
});

void test("DX Rating calculation and reverse level lookup", () => {
  assert.equal(dxRatingCoefficient(100.5), 22.4);
  assert.equal(dxRatingCoefficient(100), 21.6);
  assert.equal(dxRatingCoefficient(99.5), 21.1);
  assert.equal(calculateDxRating(14, 100.5), 315);
  assert.equal(calculateDxRating(14, 100), 302);
  assert.equal(requiredLevelValue(315, 100.5), 14);
  assert.equal(requiredLevelValue(1, 9.9999), undefined);
});

void test("achievement rank and DX stars are derived at exact thresholds", () => {
  assert.equal(rateFromAchievement(1_005_000), "sssp");
  assert.equal(rateFromAchievement(99.5), "ssp");
  assert.equal(minimumAchievementForRate("ss"), 99);
  assert.equal(dxStarFromScore(1_593, 1_722), 2);
  assert.equal(dxStarFromScore(970, 1_000), 5);
  assert.equal(dxScorePercentage(1_593, 1_722), (1_593 / 1_722) * 100);
});

void test("achievement and DX score match a real judgement sample", () => {
  const noteCounts = { tap: 676, hold: 102, slide: 82, touch: 116, break: 35 };
  const judgements = {
    tap: { criticalPerfect: 420, perfect: 233, great: 20, good: 1, miss: 2 },
    hold: { criticalPerfect: 71, perfect: 26, great: 5, good: 0, miss: 0 },
    slide: { criticalPerfect: 82, perfect: 0, great: 0, good: 0, miss: 0 },
    touch: { criticalPerfect: 113, perfect: 1, great: 1, good: 1, miss: 0 },
    break: {
      criticalPerfect: 28,
      "perfect-1": 7,
      "perfect-2": 0,
      "great-1": 0,
      "great-2": 0,
      "great-3": 0,
      good: 0,
      miss: 0,
    },
  };

  assert.equal(calculateAchievement(noteCounts, judgements), 100.3007);
  assert.deepEqual(calculateChartDxScore(judgements), { dxScore: 2_702, dxMax: 3_033 });
});

void test("buildSongDxMaxMap / buildSongLevelMap index difficulties", () => {
  const songs = [
    {
      id: 10,
      difficulties: {
        dx: [
          { difficulty: 3, level_value: 14.5, notes: { total: 100 } },
          { difficulty: 4, level_value: 14.9, notes: { total: 200 } },
        ],
        standard: [{ difficulty: 3, level_value: 13.8 }],
      },
    },
  ];
  const dxMax = buildSongDxMaxMap(songs);
  assert.equal(dxMax.get("10:dx:3"), 300);
  assert.equal(dxMax.get("10:dx:4"), 600);
  assert.equal(dxMax.has("10:standard:3"), false);

  const levels = buildSongLevelMap(songs);
  assert.equal(levels.get("10:dx:3"), 14.5);
  assert.equal(levels.get("10:standard:3"), 13.8);
  assert.equal(findSongDifficulty(songs[0], "dx", 4)?.level_value, 14.9);
  assert.equal(findSongDifficulty(songs[0], "standard", 4), undefined);
});
