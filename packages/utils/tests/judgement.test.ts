import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateAchievement,
  calculateDxScore,
  calculateSingleNotePenaltyPercent,
  dxMaxFromNoteCounts,
  normalizeChartJudgements,
  noteTotalFromCounts,
  noteTotalFromJudgements,
} from "@mai-kit/utils/judgement";

void test("judgement normalization fills explicit zero values", () => {
  assert.deepEqual(normalizeChartJudgements({ tap: { perfect: 2 } }).tap, {
    criticalPerfect: 0,
    perfect: 2,
    great: 0,
    good: 0,
    miss: 0,
  });
  assert.throws(() => normalizeChartJudgements({ tap: { miss: -1 } }), /non-negative integer/);
});

void test("note totals and DX max accept database-compatible note counts", () => {
  const counts = { total: 10, tap: 3, hold: 2, slide: 1, touch: 1, break: 3 };
  assert.equal(noteTotalFromCounts(counts), 10);
  assert.equal(dxMaxFromNoteCounts(counts), 30);
});

void test("aggregate judgements calculate DX score", () => {
  assert.deepEqual(
    calculateDxScore({ criticalPerfect: 5, perfect: 2, great: 1, good: 1, miss: 1 }),
    { dxScore: 20, dxMax: 30 },
  );
});

void test("achievement rejects judgement totals that do not match the chart", () => {
  assert.throws(
    () => calculateAchievement({ tap: 1 }, { tap: { criticalPerfect: 2 } }),
    /does not match/,
  );
});

void test("single-note penalties preserve judgement ordering", () => {
  const penalties = calculateSingleNotePenaltyPercent({ tap: 1, break: 1 });
  assert.equal(penalties.tap.criticalPerfect, 0);
  assert.equal(penalties.tap.perfect, 0);
  assert.ok(penalties.tap.great > 0);
  assert.ok(penalties.tap.miss > penalties.tap.good);
  assert.ok(penalties.break["perfect-1"] < penalties.break["perfect-2"]);
});

void test("judgement totals include detailed break outcomes", () => {
  assert.equal(
    noteTotalFromJudgements({
      tap: { criticalPerfect: 2 },
      break: { criticalPerfect: 1, "perfect-1": 1, "great-3": 1, miss: 1 },
    }),
    6,
  );
});
