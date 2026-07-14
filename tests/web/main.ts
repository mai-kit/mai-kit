import {
  getDefaultFontBuffers,
  getRateBadge,
  getResvgWasmBytes,
} from "../../packages/assets/dist/index.js";
import { LevelIndex, LxnsMaimaiDatabase } from "../../packages/database/dist/index.js";
import { Draw } from "../../packages/draw/dist/index.js";
import {
  evaluateJudgementPlan,
  JUDGEMENT_TARGETS,
  solveJudgementLimit,
  solveJudgementLimits,
} from "../../packages/judgement-solver/dist/index.js";
import { createDivingFishClient, createLxnsClient } from "../../packages/prober/dist/index.js";

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
  proberRating?: number;
  proberScoreCount?: number;
  proberUtageType?: string;
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
  const prober = await withTimeout(loadMockProberData(), "prober schema validation");
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
    proberRating: prober.rating,
    proberScoreCount: prober.scoreCount,
    proberUtageType: prober.utageType,
  };
  document.querySelector("#status")?.replaceChildren("ok");
  document.querySelector("#result")?.replaceChildren(JSON.stringify(window.maiKitSmoke));
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  window.maiKitSmoke = { status: "error", message };
  document.querySelector("#status")?.replaceChildren(message);
  document.querySelector("#result")?.replaceChildren(JSON.stringify(window.maiKitSmoke));
}

async function loadMockProberData(): Promise<{
  rating: number;
  scoreCount: number;
  utageType: string;
}> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.endsWith("/user/maimai/player")) {
      return lxnsResponse({
        name: "Web Smoke",
        rating: 15_000,
        friend_code: 123456789,
        course_rank: 10,
        class_rank: 5,
        star: 2,
      });
    }
    if (url.pathname.endsWith("/user/maimai/player/scores")) {
      return lxnsResponse([
        {
          id: 1,
          song_name: "Web Score",
          level: "14",
          level_index: 3,
          achievements: 100.5,
          dx_score: 2_800,
          rate: "sssp",
          type: "dx",
        },
      ]);
    }
    if (url.pathname.endsWith("/dev/player/record")) {
      return new Response(
        JSON.stringify({
          100508: [
            {
              achievements: 196,
              ds: 13,
              dxScore: 3_000,
              fc: "",
              fs: "sync",
              level: "13?",
              level_index: 0,
              level_label: "Utage",
              ra: 0,
              rate: "sssp",
              song_id: 100508,
              title: "[宴] Web Score",
              type: "DX",
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected prober smoke request: ${url.href}`);
  };

  try {
    const lxnsPlayer = createLxnsClient({
      personalAccessToken: "web-token",
      baseURL: "https://example.test/api/v0/",
    }).me();
    const profile = await lxnsPlayer.getProfile();
    const scoreCount = (await lxnsPlayer.getScores({ songName: "Web Score" })).length;
    const divingFishPlayer = await createDivingFishClient({
      developerToken: "web-token",
      baseURL: "https://example.test/api/",
    }).getPlayer({ qq: 123456 });
    const utageType = (await divingFishPlayer.getScoresBySongIds(100508))[0]?.type ?? "";
    if (scoreCount !== 1) throw new Error("browser LXNS score filtering failed");
    if (utageType !== "utage") throw new Error("browser Diving-Fish utage mapping failed");
    return { rating: profile.rating, scoreCount, utageType };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function lxnsResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, code: 200, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
