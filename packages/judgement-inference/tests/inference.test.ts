import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  inferJudgementDistribution,
  isJudgementInferenceError,
  JudgementInferenceNoExactSolutionError,
} from "@mai-kit/judgement-inference";
import { calculateAchievement, calculateChartDxScore } from "@mai-kit/utils";
import type { ChartJudgements } from "@mai-kit/utils/judgement";

const tenTaps = { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 };

void test("infers an exact judgement distribution", async () => {
  const judgements = await inferJudgementDistribution(tenTaps, {
    achievement: 90,
    dxScore: 20,
    judgementCounts: { great: 5 },
  });

  assert.equal(calculateAchievement(tenTaps, judgements), 90);
  assert.equal(calculateChartDxScore(judgements).dxScore, 20);
  assert.equal(judgements.tap.great, 5);
});

void test("round-trips a score calculated from a real mixed judgement distribution", async () => {
  const notes = { tap: 676, hold: 102, slide: 82, touch: 116, break: 35 };
  const actualJudgements: ChartJudgements = {
    tap: { criticalPerfect: 650, perfect: 10, great: 10, good: 4, miss: 2 },
    hold: { criticalPerfect: 90, perfect: 5, great: 4, good: 2, miss: 1 },
    slide: { criticalPerfect: 70, perfect: 4, great: 4, good: 2, miss: 2 },
    touch: { criticalPerfect: 100, perfect: 5, great: 5, good: 3, miss: 3 },
    break: {
      criticalPerfect: 20,
      "perfect-1": 4,
      "perfect-2": 3,
      "great-1": 2,
      "great-2": 2,
      "great-3": 1,
      good: 2,
      miss: 1,
    },
  };
  const expectedAchievement = calculateAchievement(notes, actualJudgements);
  const expectedDxScore = calculateChartDxScore(actualJudgements).dxScore;

  const inferredJudgements = await inferJudgementDistribution(notes, {
    achievement: expectedAchievement,
    dxScore: expectedDxScore,
  });

  assert.equal(calculateAchievement(notes, inferredJudgements), expectedAchievement);
  assert.equal(calculateChartDxScore(inferredJudgements).dxScore, expectedDxScore);
});

void test("does not search for a nearest solution unless requested", async () => {
  await assert.rejects(
    inferJudgementDistribution(tenTaps, {
      achievement: 100,
      dxScore: 0,
      judgementCounts: {
        criticalPerfect: 0,
        perfect: 0,
        great: 0,
        good: 0,
        miss: 10,
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof JudgementInferenceNoExactSolutionError);
      assert.equal(error.provenInfeasible, true);
      assert.equal(error.nearestJudgements, undefined);
      assert.equal(isJudgementInferenceError(error), true);
      return true;
    },
  );
});

void test("returns a nearest distribution only after explicit opt-in", async () => {
  await assert.rejects(
    inferJudgementDistribution(
      tenTaps,
      {
        achievement: 100,
        dxScore: 0,
        judgementCounts: {
          criticalPerfect: 0,
          perfect: 0,
          great: 0,
          good: 0,
          miss: 10,
        },
      },
      { findNearestOnFailure: true, timeLimitMs: 1_000 },
    ),
    (error: unknown) => {
      assert.ok(error instanceof JudgementInferenceNoExactSolutionError);
      assert.ok(error.nearestJudgements);
      assert.equal(calculateAchievement(tenTaps, error.nearestJudgements), 100);
      assert.equal(calculateChartDxScore(error.nearestJudgements).dxScore, 20);
      assert.equal(error.nearestJudgements.tap.perfect, 10);
      return true;
    },
  );
});

void test("rejects invalid targets before loading the solver", async () => {
  await assert.rejects(inferJudgementDistribution({}, { achievement: 100 }), /at least one note/u);
  await assert.rejects(
    inferJudgementDistribution(tenTaps, { achievement: 101.1 }),
    /between 0 and 101/u,
  );
  await assert.rejects(
    inferJudgementDistribution(tenTaps, { achievement: 90, dxScore: 31 }),
    /between 0 and 30/u,
  );
  await assert.rejects(
    inferJudgementDistribution(tenTaps, {
      achievement: 90,
      judgementCounts: { criticalPerfect: 6, perfect: 5 },
    }),
    /exceed chart note total/u,
  );
});

void test("no other workspace library depends on the GPL package", async () => {
  const packagesRoot = new URL("../../", import.meta.url);
  const packageNames = await readdir(packagesRoot);
  await Promise.all(
    packageNames
      .filter((packageName) => packageName !== "judgement-inference")
      .map(async (packageName) => {
        const manifestUrl = new URL(`${packageName}/package.json`, packagesRoot);
        const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
        for (const field of [
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
        ]) {
          assert.equal(
            manifest[field]?.["@mai-kit/judgement-inference"],
            undefined,
            `${manifest.name} must not depend on @mai-kit/judgement-inference`,
          );
        }
      }),
  );
});
