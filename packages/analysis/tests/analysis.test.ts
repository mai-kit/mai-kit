import assert from "node:assert/strict";
import test from "node:test";
import { LevelIndex } from "@mai-kit/prober";
import {
  analyzeScoreUpgrade,
  compareBests,
  rankUpgradeCandidates,
  recalculateBests,
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

void test("analyzeScoreUpgrade recalculates current and target rating", () => {
  const result = analyzeScoreUpgrade({ score: score(1, 1, 99), levelValue: 14.7 }, 100.5);

  assert.equal(result.currentRating, 302);
  assert.equal(result.targetRating, 330);
  assert.equal(result.gain, 28);
});

void test("rankUpgradeCandidates removes zero-gain entries and sorts by gain", () => {
  const result = rankUpgradeCandidates(
    [
      { score: score(1, 1, 100.4), levelValue: 13 },
      { score: score(2, 1, 97), levelValue: 14.7 },
      { score: score(3, 1, 99.5), levelValue: 14.7 },
    ],
    100.5,
    2,
  );

  assert.deepEqual(
    result.map((item) => item.score.id),
    [2, 3],
  );
  assert.ok(result[0].gain > result[1].gain);
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
