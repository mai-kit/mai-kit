import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateJudgementPlan,
  JUDGEMENT_TARGETS,
  solveJudgementLimit,
  solveJudgementLimits,
} from "@mai-kit/judgement-solver";
import { calculateAchievement, calculateChartDxScore } from "@mai-kit/utils";

const tenTaps = { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 };

void test("solves a theoretical single-judgement limit", () => {
  const solution = solveJudgementLimit(
    tenTaps,
    { noteType: "tap", judgement: "great" },
    { minimumAchievement: 90 },
  );

  assert.ok(solution);
  assert.equal(solution.remainingCount, 5);
  assert.equal(solution.achievement, 90);
  assert.equal(solution.dxScore, 20);
  assert.equal(solution.dxMax, 30);
  assert.equal(solution.fc, "fcp");
  assert.equal(solution.judgements.tap.great, 5);
  assert.equal(solution.judgements.tap.criticalPerfect, 5);
});

void test("solves remaining tolerance after existing judgements", () => {
  const solution = solveJudgementLimit(
    tenTaps,
    { noteType: "tap", judgement: "great" },
    {
      minimumAchievement: 90,
      existingJudgements: { tap: { great: 2 } },
    },
  );

  assert.ok(solution);
  assert.equal(solution.remainingCount, 3);
  assert.equal(solution.judgements.tap.great, 5);
  assert.equal(solution.judgements.tap.criticalPerfect, 5);
});

void test("combines existing mixed mistakes with a new target", () => {
  const solution = solveJudgementLimit(
    { tap: 5, hold: 2, slide: 3, touch: 0, break: 0 },
    { noteType: "slide", judgement: "great" },
    {
      minimumAchievement: 88,
      existingJudgements: { tap: { great: 2 }, hold: { good: 1 } },
    },
  );

  assert.ok(solution);
  assert.equal(solution.remainingCount, 1);
  assert.equal(solution.judgements.tap.great, 2);
  assert.equal(solution.judgements.hold.good, 1);
  assert.equal(solution.judgements.slide.great, 1);
});

void test("evaluates arbitrary mixed judgement plans and reports violations", () => {
  const notes = { tap: 8, hold: 0, slide: 0, touch: 0, break: 2 };
  const judgements = {
    tap: { great: 2, good: 1 },
    break: { "perfect-1": 1 },
  } as const;
  const accepted = evaluateJudgementPlan(notes, judgements, {
    minimumAchievement: 80,
    minimumFc: "fc",
  });
  const rejected = evaluateJudgementPlan(notes, judgements, {
    minimumAchievement: 100,
    minimumFc: "fcp",
  });

  assert.equal(accepted.satisfied, true);
  assert.equal(accepted.fc, "fc");
  assert.deepEqual(accepted.violations, []);
  assert.equal(rejected.satisfied, false);
  assert.deepEqual(rejected.violations, ["achievement", "fc"]);
});

void test("generates an independent tolerance table for every target", () => {
  const limits = solveJudgementLimits(tenTaps, { minimumAchievement: 90 });
  assert.ok(limits);
  assert.equal(limits.length, JUDGEMENT_TARGETS.length);

  const find = (judgement: "great" | "good" | "miss") =>
    limits.find(({ target }) => target.noteType === "tap" && target.judgement === judgement);
  assert.equal(find("great")?.remainingCount, 5);
  assert.equal(find("good")?.remainingCount, 2);
  assert.equal(find("miss")?.remainingCount, 1);
});

void test("combines achievement, DX score, and FC constraints", () => {
  const solution = solveJudgementLimit(
    tenTaps,
    { noteType: "tap", judgement: "great" },
    { minimumAchievement: 80, minimumDxScore: 24, minimumFc: "fcp" },
  );

  assert.ok(solution);
  assert.equal(solution.remainingCount, 3);
  assert.equal(solution.achievement, 94);
  assert.equal(solution.dxScore, 24);
  assert.equal(solution.fc, "fcp");
});

void test("FC constraints reject lower judgement grades without changing the baseline", () => {
  assert.equal(
    solveJudgementLimit(
      tenTaps,
      { noteType: "tap", judgement: "miss" },
      { minimumAchievement: 0, minimumFc: "fc" },
    )?.remainingCount,
    0,
  );
  assert.equal(
    solveJudgementLimit(
      tenTaps,
      { noteType: "tap", judgement: "good" },
      { minimumAchievement: 0, minimumFc: "fcp" },
    )?.remainingCount,
    0,
  );
  assert.equal(
    solveJudgementLimit(
      tenTaps,
      { noteType: "tap", judgement: "great" },
      { minimumAchievement: 0, minimumFc: "ap" },
    )?.remainingCount,
    0,
  );
});

void test("supports detailed Break judgement budgets", () => {
  const solution = solveJudgementLimit(
    { tap: 0, hold: 0, slide: 0, touch: 0, break: 4 },
    { noteType: "break", judgement: "perfect-1" },
    {
      minimumAchievement: 100.8,
      existingJudgements: { break: { "perfect-1": 1 } },
    },
  );

  assert.ok(solution);
  assert.equal(solution.remainingCount, 2);
  assert.equal(solution.achievement, 100.8125);
  assert.equal(solution.judgements.break["perfect-1"], 3);
  assert.equal(solution.fc, "ap");
});

void test("returns null when existing judgements already violate constraints", () => {
  assert.equal(
    solveJudgementLimit(
      tenTaps,
      { noteType: "tap", judgement: "great" },
      {
        minimumAchievement: 95,
        existingJudgements: { tap: { good: 2 } },
      },
    ),
    null,
  );
  assert.equal(
    solveJudgementLimits(tenTaps, {
      minimumAchievement: 95,
      existingJudgements: { tap: { good: 2 } },
    }),
    null,
  );
});

void test("returns results consistent with @mai-kit/utils", () => {
  const notes = { tap: 3, hold: 2, slide: 1, touch: 1, break: 3 };
  const solution = solveJudgementLimit(
    notes,
    { noteType: "break", judgement: "great-2" },
    { minimumAchievement: 80, minimumDxScore: 20 },
  );

  assert.ok(solution);
  assert.equal(calculateAchievement(notes, solution.judgements), solution.achievement);
  assert.deepEqual(calculateChartDxScore(solution.judgements), {
    dxScore: solution.dxScore,
    dxMax: solution.dxMax,
  });
});

void test("rejects over-assigned judgements and invalid constraints", () => {
  assert.throws(
    () =>
      solveJudgementLimit({}, { noteType: "tap", judgement: "great" }, { minimumAchievement: 100 }),
    /at least one note/,
  );
  assert.throws(
    () =>
      solveJudgementLimit(
        tenTaps,
        { noteType: "tap", judgement: "great" },
        {
          minimumAchievement: 90,
          existingJudgements: { tap: { great: 11 } },
        },
      ),
    /exceeds chart count/,
  );
  assert.throws(
    () =>
      solveJudgementLimit(
        tenTaps,
        { noteType: "tap", judgement: "great" },
        { minimumAchievement: 101.1 },
      ),
    /between 0 and 101/,
  );
  assert.throws(
    () =>
      solveJudgementLimit(
        tenTaps,
        { noteType: "tap", judgement: "great" },
        { minimumAchievement: 0, minimumDxScore: 31 },
      ),
    /between 0 and 30/,
  );
});
