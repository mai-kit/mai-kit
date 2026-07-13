import assert from "node:assert/strict";
import test from "node:test";
import { createDivingFishClient } from "@mai-kit/prober";

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
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(input);
    if (url.pathname.endsWith("/dev/player/records")) {
      return jsonResponse({ rating: 15_000, nickname: "Dev", records: [record] });
    }
    if (url.pathname.endsWith("/music_data")) {
      return jsonResponse([{ id: 1, basic_info: { is_new: true } }]);
    }
    if (url.pathname.endsWith("/query/player")) {
      return jsonResponse({ rating: 15_000, nickname: "Public", charts: { dx: [record], sd: [] } });
    }
    if (url.pathname.endsWith("/rating_ranking")) {
      return jsonResponse([{ username: "DivingFish", ra: 16_000 }]);
    }
    throw new Error(`Unexpected request: ${url}`);
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

    const publicPlayer = await createDivingFishClient({
      baseURL: "https://example.test/api/",
    }).getPlayer({ username: "public" });
    assert.equal("getScores" in publicPlayer, false);

    const ranking = await dev.getRatingRanking();
    assert.deepEqual(ranking, [{ username: "DivingFish", ra: 16_000 }]);
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
