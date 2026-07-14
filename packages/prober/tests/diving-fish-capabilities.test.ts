import assert from "node:assert/strict";
import test from "node:test";
import { createDivingFishClient } from "@mai-kit/prober";

function assertConditionalApi(): void {
  const publicClient = createDivingFishClient();
  // @ts-expect-error 无 Import-Token 时类型上没有 me()
  publicClient.me();

  const importClient = createDivingFishClient({ importToken: "token" });
  importClient.me();
  // @ts-expect-error Import-Token 玩家没有 Developer-Token 专属查询
  importClient.me().getVersionScores(["maimai でらっくす PRiSM"]);

  void (async () => {
    const publicPlayer = await publicClient.getPlayer({ username: "public" });
    // @ts-expect-error 公开 query/player 不提供全量成绩能力
    await publicPlayer.getScores();

    const developerPlayer = await createDivingFishClient({ developerToken: "token" }).getPlayer({
      qq: 123456,
    });
    await developerPlayer.getScores();
    await developerPlayer.getScoresBySongIds([1, 2]);
    await developerPlayer.getVersionScores(["maimai でらっくす PRiSM"]);
  })();
}
void assertConditionalApi;

const record = {
  achievements: 100.5,
  ds: 14.7,
  dxScore: 2_800,
  fc: "ap",
  fs: "fs",
  level: "14+",
  level_index: 3,
  ra: 330,
  rate: "sssp",
  song_id: 1,
  title: "Song",
  type: "DX",
};

void test("Diving-Fish exposes score queries only for complete-record clients", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(input);
    if (url.pathname.endsWith("/dev/player/records")) {
      return jsonResponse({ rating: 15_000, nickname: "Dev", records: [record] });
    }
    if (url.pathname.endsWith("/player/records")) {
      assert.equal(new Headers(init?.headers).get("Import-Token"), "import-token");
      return jsonResponse({ rating: 15_000, nickname: "Import", records: [record] });
    }
    if (url.pathname.endsWith("/dev/player/record")) {
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("Developer-Token"), "dev-token");
      assert.deepEqual(parseJsonBody(init), {
        qq: 123456,
        music_id: ["1", "100508"],
      });
      return jsonResponse({
        1: [record],
        100508: [
          {
            ...record,
            song_id: 100508,
            title: "[宴] Song",
            level: "13?",
            level_index: 0,
            level_label: "Utage",
            ra: 0,
            type: "DX",
          },
        ],
      });
    }
    if (url.pathname.endsWith("/query/plate")) {
      assert.equal(new Headers(init?.headers).get("Developer-Token"), "dev-token");
      assert.deepEqual(parseJsonBody(init), {
        qq: 123456,
        version: ["maimai でらっくす PRiSM"],
      });
      return jsonResponse({
        verlist: [
          {
            id: 1,
            title: "Song",
            level: "14+",
            level_index: 3,
            type: "DX",
            achievements: 100.5,
            fc: "ap",
            fs: "fs",
          },
        ],
      });
    }
    if (url.pathname.endsWith("/music_data")) {
      return jsonResponse([{ id: 1, basic_info: { is_new: true } }]);
    }
    if (url.pathname.endsWith("/query/player")) {
      return jsonResponse({ rating: 15_000, nickname: "Public", charts: { dx: [record], sd: [] } });
    }
    if (url.pathname.endsWith("/rating_ranking")) {
      return jsonResponse([
        { username: "Lower", ra: 15_000 },
        { username: "DivingFish", ra: 16_000 },
      ]);
    }
    throw new Error(`Unexpected request: ${String(url)}`);
  };

  try {
    const dev = createDivingFishClient({
      developerToken: "dev-token",
      baseURL: "https://example.test/api/",
    });
    const scoresPlayer = await dev.getPlayer({ qq: 123456 });
    const scores = await scoresPlayer.getScores({ songId: 1, levelIndex: 3 });
    assert.deepEqual(
      scores.map((score) => score.id),
      [1],
    );
    assert.deepEqual(await scoresPlayer.getScores({ songId: 2 }), []);
    assert.deepEqual(
      (await scoresPlayer.getScoresBySongIds([1, 100508])).map((score) => [score.id, score.type]),
      [
        [1, "dx"],
        [100508, "utage"],
      ],
    );
    assert.deepEqual(await scoresPlayer.getVersionScores(["maimai でらっくす PRiSM"]), [
      {
        id: 1,
        song_name: "Song",
        level: "14+",
        level_index: 3,
        type: "dx",
        achievements: 100.5,
        fc: "ap",
        fs: "fs",
      },
    ]);

    const importPlayer = createDivingFishClient({
      importToken: "import-token",
      baseURL: "https://example.test/api/",
    }).me();
    assert.equal((await importPlayer.getProfile()).name, "Import");
    assert.equal((await importPlayer.getBests()).dx_total, 330);
    assert.equal((await importPlayer.getScores())[0]?.id, 1);

    const publicPlayer = await createDivingFishClient({
      baseURL: "https://example.test/api/",
    }).getPlayer({ username: "public" });
    assert.equal("getScores" in publicPlayer, false);

    const ranking = await dev.getRatingRanking();
    assert.deepEqual(ranking, [
      { username: "DivingFish", ra: 16_000 },
      { username: "Lower", ra: 15_000 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function parseJsonBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") throw new Error("expected a JSON string request body");
  return JSON.parse(init.body);
}
