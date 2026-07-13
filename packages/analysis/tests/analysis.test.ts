import assert from "node:assert/strict";
import test from "node:test";
import { LevelIndex } from "@mai-kit/prober";
import type { Bests } from "@mai-kit/prober";
import {
  analyzeScoreUpgrade,
  compareBests,
  rankBestsUpgradeCandidates,
  rankUpgradeCandidates,
  ratingGapToNextThousand,
  ratingGapToTarget,
  recalculateBests,
  resolveUpgradeTarget,
  summarizeBestsRating,
} from "@mai-kit/analysis";
import type { RatedScore } from "@mai-kit/analysis";

function score(id: number, rating: number, achievements = 100): RatedScore {
  return {
    id,
    level_index: LevelIndex.MASTER,
    achievements,
    dx_score: 2_000 + id,
    dx_rating: rating,
    type: "dx",
  };
}

void test("recalculateBests selects B15/B35 and keeps ordered selections", () => {
  const newScores = Array.from({ length: 17 }, (_, index) => score(index + 1, 300 - index));
  const oldScores = Array.from({ length: 37 }, (_, index) => score(index + 101, 280 - index));

  const bests = recalculateBests([...newScores, ...oldScores], (item) => item.id < 100);

  assert.equal(bests.dx.length, 15);
  assert.equal(bests.standard.length, 35);
  assert.deepEqual(
    bests.dx.map((item) => item.id),
    newScores.slice(0, 15).map((item) => item.id),
  );
  assert.deepEqual(
    bests.dx_selections.map((item) => item.id),
    [16, 17],
  );
  assert.equal(
    bests.dx_total,
    newScores.slice(0, 15).reduce((sum, item) => sum + item.dx_rating, 0),
  );
});

void test("recalculateBests rejects scores without a valid rating", () => {
  assert.throws(
    () => recalculateBests([{ ...score(1, 100), dx_rating: Number.NaN }], () => true),
    /dx_rating/u,
  );
});

void test("recalculateBests rejects duplicate chart keys", () => {
  assert.throws(() => recalculateBests([score(1, 100), score(1, 99)], () => true), /Duplicate/u);
});

void test("resolveUpgradeTarget prefers higher of minRate and targetAchievement", () => {
  assert.equal(resolveUpgradeTarget({ minRate: "sss" }), 100);
  assert.equal(resolveUpgradeTarget({ minRate: "sssp" }), 100.5);
  assert.equal(resolveUpgradeTarget({ targetAchievement: 99.5 }), 99.5);
  assert.equal(resolveUpgradeTarget({ minRate: "sss", targetAchievement: 100.5 }), 100.5);
  assert.equal(resolveUpgradeTarget({ minRate: "sssp", targetAchievement: 100 }), 100.5);
  assert.throws(() => resolveUpgradeTarget({}), /minRate or targetAchievement/u);
});

void test("analyzeScoreUpgrade recalculates current and target rating", () => {
  const result = analyzeScoreUpgrade({ score: score(1, 1, 99), levelValue: 14.7 }, 100.5);

  assert.equal(result.currentRating, 302);
  assert.equal(result.targetRating, 330);
  assert.equal(result.gain, 28);
  assert.equal(result.targetRate, "sssp");
});

void test("rankUpgradeCandidates removes zero-gain entries and sorts by gain", () => {
  const result = rankUpgradeCandidates(
    [
      { score: score(1, 1, 100.4), levelValue: 13 },
      { score: score(2, 1, 97), levelValue: 14.7 },
      { score: score(3, 1, 99.5), levelValue: 14.7 },
    ],
    { minRate: "sssp", limit: 2 },
  );

  assert.deepEqual(
    result.map((item) => item.score.id),
    [2, 3],
  );
  assert.ok(result[0].gain > result[1].gain);
  assert.ok(result.every((item) => item.targetRate === "sssp"));
});

void test("rankUpgradeCandidates with minRate sss excludes already-SSS scores", () => {
  const result = rankUpgradeCandidates(
    [
      { score: score(1, 1, 100), levelValue: 14 }, // 已 SSS
      { score: score(2, 1, 99.5), levelValue: 14 },
    ],
    { minRate: "sss" },
  );
  assert.deepEqual(
    result.map((item) => item.score.id),
    [2],
  );
  assert.equal(result[0].targetAchievement, 100);
  assert.equal(result[0].targetRate, "sss");
});

void test("rankBestsUpgradeCandidates uses real B50 floors, not single-chart fluff", () => {
  // B15：15 首，地板 300（id=15）
  const dx = Array.from({ length: 15 }, (_, i) => score(i + 1, 314 - i, 100.5));
  // B35：35 首，地板 280（id=135）
  const standard = Array.from({ length: 35 }, (_, i) => score(i + 101, 314 - i, 100.5));
  const currentBests: Bests = {
    dx,
    standard,
    dx_total: dx.reduce((s, x) => s + x.dx_rating, 0),
    standard_total: standard.reduce((s, x) => s + x.dx_rating, 0),
    dx_selections: [],
    standard_selections: [],
  };

  // 已在 B15 内的曲：99%→100.5%，单曲涨分 = B50 增量
  const inB15 = {
    score: { ...score(1, 310, 99), type: "dx" as const },
    levelValue: 14.5,
  };
  // 未进榜、高定数：目标 Rating 可挤掉地板
  const canEnter = {
    score: { ...score(50, 290, 99), type: "dx" as const },
    levelValue: 14.5,
  };
  // 低定数：目标 Rating 仍低于 B15 地板 300 → 绝不能进
  const fluff = {
    score: { ...score(999, 50, 0), type: "dx" as const },
    levelValue: 10,
  };

  const isNew = (s: { id: number }) => s.id < 100;
  const result = rankBestsUpgradeCandidates([inB15, canEnter, fluff], {
    currentBests,
    isNewSong: isNew,
    minRate: "sssp",
    limit: 10,
  });

  assert.ok(
    result.every((item) => item.score.id !== 999),
    "低定数进不了 B15 的不应入选",
  );
  assert.ok(
    result.some((item) => item.score.id === 1),
    "榜内可抬分应入选",
  );
  assert.ok(result.every((item) => item.targetRate === "sssp"));
  // canEnter: 14.5*22.4=324.8→324，地板 300，gain=24
  const enter = result.find((item) => item.score.id === 50);
  assert.ok(enter, "高于地板的未进榜谱面应入选");
  assert.equal(enter.gain, enter.targetRating - 300);
});

void test("compareBests groups entered, improved, regressed and dropped charts", () => {
  const previous = recalculateBests(
    [score(1, 300, 100), score(2, 290, 99.5), score(3, 280, 100)],
    (item) => item.id < 3,
  );
  const current = recalculateBests(
    [score(1, 305, 100.5), score(2, 285, 99), score(4, 282, 100)],
    (item) => item.id < 3,
  );

  const comparison = compareBests(previous, current);

  assert.deepEqual(
    comparison.entered.map((item) => item.current?.score.id),
    [4],
  );
  assert.deepEqual(
    comparison.improved.map((item) => item.current?.score.id),
    [1],
  );
  assert.deepEqual(
    comparison.regressed.map((item) => item.current?.score.id),
    [2],
  );
  assert.deepEqual(
    comparison.dropped.map((item) => item.previous?.score.id),
    [3],
  );
  assert.equal(comparison.totalDelta, 2);
});

void test("summarizeBestsRating reports section totals, shares and floors", () => {
  const bests = recalculateBests(
    [score(1, 300), score(2, 290), score(101, 280), score(102, 270)],
    (item) => item.id < 100,
  );

  const summary = summarizeBestsRating(bests);
  assert.equal(summary.dxTotal, 590);
  assert.equal(summary.standardTotal, 550);
  assert.equal(summary.total, 1140);
  assert.equal(summary.dxFloor, 290);
  assert.equal(summary.standardFloor, 270);
  assert.ok(Math.abs(summary.dxShare - 590 / 1140) < 1e-12);
  assert.equal(summary.entries.length, 4);
});

void test("ratingGapToNextThousand and ratingGapToTarget", () => {
  assert.deepEqual(ratingGapToNextThousand(15_823), {
    current: 15_823,
    target: 16_000,
    gap: 177,
    reached: false,
  });
  assert.deepEqual(ratingGapToNextThousand(16_000), {
    current: 16_000,
    target: 17_000,
    gap: 1_000,
    reached: false,
  });
  assert.deepEqual(ratingGapToTarget(15_900, 15_800), {
    current: 15_900,
    target: 15_800,
    gap: 0,
    reached: true,
  });
});
