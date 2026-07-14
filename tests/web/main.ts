import {
  getDefaultFontBuffers,
  getRateBadge,
  getResvgWasmBytes,
} from "../../packages/assets/dist/index.js";
import { LevelIndex, LxnsMaimaiDatabase } from "../../packages/database/dist/index.js";
import { Draw } from "../../packages/draw/dist/index.js";
import { inferJudgementDistribution } from "../../packages/judgement-inference/dist/index.js";
import { createLxnsClient } from "../../packages/prober/dist/index.js";
import {
  evaluateJudgementPlan,
  JUDGEMENT_TARGETS,
  solveJudgementLimit,
  solveJudgementLimits,
} from "../../packages/judgement-solver/dist/index.js";
import { calculateAchievement, calculateChartDxScore } from "../../packages/utils/dist/index.js";

declare global {
  interface Window {
    maiKitSmoke: SmokeResult;
  }
}

interface SmokeResult {
  status: "running" | "ok" | "error";
  message?: string;
  badgeLength?: number;
  fontBytes?: number;
  wasmBytes?: number;
  chartTagCount?: number;
  pngBytes?: number;
  solverRemaining?: number;
  solverTargetCount?: number;
  solverMixedSatisfied?: boolean;
  inferenceAchievement?: number;
  inferenceDxScore?: number;
  proberRating?: number;
}

window.maiKitSmoke = { status: "running" };

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after 20 seconds`));
        }, 20_000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

try {
  const proberProfile = await withTimeout(loadMockLxnsProfile(), "prober schema validation");
  const badge = getRateBadge("sssp");
  const [{ notoSansSc, comfortaa }, wasm] = await withTimeout(
    Promise.all([getDefaultFontBuffers(), getResvgWasmBytes()]),
    "asset loading",
  );
  const database = new LxnsMaimaiDatabase();
  const [tags] = await withTimeout(
    database.getChartTags([{ song_name: "7 Wonders", type: "dx", level_index: LevelIndex.MASTER }]),
    "chart tag loading",
  );
  if (!tags || tags.length === 0) throw new Error("bundled chart tags did not load");

  const solverNotes = { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 };
  const solverLimit = solveJudgementLimit(
    solverNotes,
    { noteType: "tap", judgement: "great" },
    {
      minimumAchievement: 90,
      existingJudgements: { tap: { great: 2 } },
    },
  );
  const solverLimits = solveJudgementLimits(solverNotes, { minimumAchievement: 90 });
  const solverMixed = evaluateJudgementPlan(
    solverNotes,
    { tap: { great: 3, good: 1 } },
    { minimumAchievement: 89, minimumFc: "fc" },
  );
  if (solverLimit?.remainingCount !== 3) throw new Error("browser solver limit was incorrect");
  if (solverLimits?.length !== JUDGEMENT_TARGETS.length) {
    throw new Error("browser solver table was incomplete");
  }
  if (!solverMixed.satisfied) throw new Error("browser mixed judgement evaluation failed");

  const inferred = await withTimeout(
    inferJudgementDistribution(solverNotes, {
      achievement: 90,
      dxScore: 20,
      judgementCounts: { great: 5 },
    }),
    "browser judgement inference",
  );
  const inferenceAchievement = calculateAchievement(solverNotes, inferred);
  const inferenceDxScore = calculateChartDxScore(inferred).dxScore;
  if (inferenceAchievement !== 90 || inferenceDxScore !== 20) {
    throw new Error("browser judgement inference was incorrect");
  }

  const draw = new Draw({
    database: {
      async getAsset() {
        throw new Error("embedded cover should avoid asset loading");
      },
    },
  });
  const png = await withTimeout(
    draw.chart(
      {
        id: 1,
        song_name: "Web Smoke",
        type: "dx",
        level_index: LevelIndex.MASTER,
        achievements: 100.5,
        dx_score: 1_000,
        dx_rating: 300,
        rate: "sssp",
        coverDataUri: badge,
      },
      { scale: 0.25 },
    ),
    "browser chart rendering",
  );
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error("browser rasterizer did not return PNG bytes");
  }

  window.maiKitSmoke = {
    status: "ok",
    badgeLength: badge.length,
    fontBytes: notoSansSc.byteLength + comfortaa.byteLength,
    wasmBytes: wasm.byteLength,
    chartTagCount: tags.length,
    pngBytes: png.byteLength,
    solverRemaining: solverLimit.remainingCount,
    solverTargetCount: solverLimits.length,
    solverMixedSatisfied: solverMixed.satisfied,
    inferenceAchievement,
    inferenceDxScore,
    proberRating: proberProfile.rating,
  };
  document.querySelector("#status")?.replaceChildren("ok");
  document.querySelector("#result")?.replaceChildren(JSON.stringify(window.maiKitSmoke));
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  window.maiKitSmoke = { status: "error", message };
  document.querySelector("#status")?.replaceChildren(message);
  document.querySelector("#result")?.replaceChildren(JSON.stringify(window.maiKitSmoke));
}

async function loadMockLxnsProfile() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        code: 200,
        data: {
          name: "Web Smoke",
          rating: 15_000,
          friend_code: 123456789,
          course_rank: 10,
          class_rank: 5,
          star: 2,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  try {
    return await createLxnsClient({
      personalAccessToken: "web-smoke",
      baseURL: "https://example.test/api/v0/",
    })
      .me()
      .getProfile();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
