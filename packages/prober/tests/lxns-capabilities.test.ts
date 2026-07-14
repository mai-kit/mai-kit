import assert from "node:assert/strict";
import test from "node:test";
import { createLxnsClient, isLxnsProberError, LevelIndex } from "@mai-kit/prober";

function assertConditionalApi(): void {
  const personal = createLxnsClient({ personalAccessToken: "token" }).me();
  void personal.getScores();
  void personal.getScoreRanking({ songId: 1, songType: "dx", levelIndex: LevelIndex.MASTER });
  void personal.getCollections("icon");
  void personal.exportScores();
  // @ts-expect-error LXNS 个人 API 没有 Recent 50
  personal.getRecents();

  const devClient = createLxnsClient({ devAccessToken: "token" });
  const devPlayer = devClient.getPlayer(1234567890);
  void devPlayer.getRecents();
  void devPlayer.getSimpleScores();
  // @ts-expect-error LXNS 开发者 /scores 只有精简成绩，不是 ScoreListCapability
  devPlayer.getScores();
  // @ts-expect-error 无个人令牌时没有 me()
  devClient.me();
}
void assertConditionalApi;

const score = {
  id: 1,
  song_name: "Song",
  level: "14",
  level_index: 3,
  achievements: 100.5,
  dx_score: 2_800,
  dx_rating: 320,
  rate: "sssp",
  type: "dx",
};

const bests = {
  standard_total: 0,
  dx_total: 320,
  standard: [],
  dx: [score],
  standard_selections: [],
  dx_selections: [],
};

void test("LXNS personal player exposes actual read-only personal endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    requests.push(url);
    assert.equal(request.headers.get("X-User-Token"), "personal-token");

    if (url.pathname.endsWith("/player/scores/export/csv")) {
      assert.equal(request.headers.get("Accept"), "*/*");
      return new Response("id,title\n1,Song\n", { headers: { "Content-Type": "text/csv" } });
    }
    assert.equal(request.headers.get("Accept"), "application/json");
    if (url.pathname.endsWith("/player/scores")) {
      return lxnsResponse([score, { ...score, id: 2, song_name: "Other", type: "standard" }]);
    }
    if (url.pathname.endsWith("/player/bests")) {
      return lxnsResponse(url.search ? [score] : bests);
    }
    if (url.pathname.endsWith("/player/score/history")) return lxnsResponse([score]);
    if (url.pathname.endsWith("/player/score/ranking")) {
      return lxnsResponse([{ ranking: 1, player_name: "Alice", upload_time: "2026-01-01" }]);
    }
    if (url.pathname.endsWith("/player/trend")) {
      return lxnsResponse([
        { total: 15_000, standard_total: 10_000, dx_total: 5_000, date: "2026-01-01" },
      ]);
    }
    if (url.pathname.endsWith("/player/heatmap")) return lxnsResponse({ "2026-01-01": 3 });
    if (url.pathname.endsWith("/player/icons")) {
      return lxnsResponse([{ id: 42, name: "Icon" }]);
    }
    if (url.pathname.endsWith("/player/icon/42")) {
      return lxnsResponse({ id: 42, name: "Icon", required: [] });
    }
    if (url.pathname.endsWith("/player/year-in-review/2025")) {
      return lxnsResponse({
        game: "maimai",
        year: 2025,
        latest_version: 25500,
        player_name: "Player",
        player_avatar_id: 42,
      });
    }
    if (url.pathname.endsWith("/player")) {
      return lxnsResponse({ name: "Player", rating: 15_000, friend_code: 1234567890 });
    }
    throw new Error(`Unexpected request: ${url.href}`);
  };

  try {
    const player = createLxnsClient({
      personalAccessToken: "personal-token",
      baseURL: "https://example.test/api/v0/",
    }).me();

    assert.equal((await player.getProfile()).name, "Player");
    assert.equal((await player.getBests()).dx_total, 320);
    assert.deepEqual(
      (await player.getScores({ songName: "Other", songType: "standard" })).map((item) => item.id),
      [2],
    );
    assert.equal(requests.at(-1)?.searchParams.get("song_type"), "standard");
    assert.equal(requests.at(-1)?.searchParams.has("song_name"), false);
    assert.deepEqual(
      (await player.getScores({ songId: 1, songType: "dx", levelIndex: LevelIndex.MASTER })).map(
        (item) => item.id,
      ),
      [1],
    );
    assert.equal(requests.at(-1)?.searchParams.get("song_id"), "1");
    assert.equal(requests.at(-1)?.searchParams.get("song_type"), "dx");
    assert.equal(requests.at(-1)?.searchParams.get("level_index"), "3");
    assert.deepEqual(await player.getBests({ songName: "Song" }), [score]);
    assert.equal(requests.at(-1)?.searchParams.get("song_name"), "Song");
    assert.equal(
      (await player.getScoreRanking({ songId: 1, songType: "dx", levelIndex: 3 }))[0]?.ranking,
      1,
    );
    assert.equal(
      (await player.getScoreHistory({ songId: 1, songType: "dx", levelIndex: 3 }))?.[0]?.id,
      1,
    );
    assert.equal((await player.getTrend(25500))[0]?.total, 15_000);
    assert.equal(requests.at(-1)?.searchParams.get("version"), "25500");
    assert.equal((await player.getHeatmap())["2026-01-01"], 3);
    assert.equal((await player.getCollections("icon"))[0]?.id, 42);
    assert.equal((await player.getCollectionProgress("icon", 42)).id, 42);
    assert.match(new TextDecoder().decode(await player.exportScores()), /Song/u);
    assert.equal((await player.getYearInReview(2025, { agree: true })).year, 2025);
    assert.equal(requests.at(-1)?.searchParams.get("agree"), "true");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("LXNS developer client binds players and preserves endpoint capabilities", async () => {
  const originalFetch = globalThis.fetch;
  const requestedPaths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    requestedPaths.push(`${url.pathname}${url.search}`);
    assert.equal(request.headers.get("Authorization"), "dev-token");

    if (url.pathname.endsWith("/player/qq/123")) {
      return lxnsResponse({ name: "QQ", rating: 15_000, friend_code: 9876543210 });
    }
    if (url.pathname.endsWith("/player/qq/456")) {
      return lxnsResponse({ name: "Invalid QQ", rating: 15_000 });
    }
    if (url.pathname.endsWith("/player/9876543210")) {
      throw new Error("getPlayerByQQ should reuse the resolved profile");
    }
    if (url.pathname.endsWith("/player/1234567890")) {
      return lxnsResponse({ name: "FC", rating: 15_000, friend_code: 1234567890 });
    }
    if (url.pathname.endsWith("/player/1234567890/best")) return lxnsResponse(score);
    if (url.pathname.endsWith("/player/1234567890/bests/ap")) return lxnsResponse(bests);
    if (url.pathname.endsWith("/player/1234567890/bests")) {
      return lxnsResponse(url.search ? [score] : bests);
    }
    if (url.pathname.endsWith("/player/1234567890/recents")) return lxnsResponse([score]);
    if (url.pathname.endsWith("/player/1234567890/scores")) {
      return lxnsResponse([
        {
          id: 1,
          song_name: "Song",
          level: "14",
          level_index: 3,
          rate: "sssp",
          type: "dx",
        },
      ]);
    }
    if (url.pathname.endsWith("/player/1234567890/heatmap")) {
      return lxnsResponse({ "2026-01-01": 2 });
    }
    if (url.pathname.endsWith("/player/1234567890/trend")) {
      return lxnsResponse([
        { total: 15_000, standard_total: 10_000, dx_total: 5_000, date: "2026-01-01" },
      ]);
    }
    if (url.pathname.endsWith("/player/1234567890/score/history")) {
      return lxnsResponse([score]);
    }
    if (url.pathname.endsWith("/player/1234567890/plate/7")) {
      return lxnsResponse({ id: 7, name: "Plate", required: [] });
    }
    throw new Error(`Unexpected request: ${url.href}`);
  };

  try {
    const client = createLxnsClient({
      devAccessToken: "dev-token",
      baseURL: "https://example.test/api/v0/",
    });
    const player = client.getPlayer(1234567890);
    assert.equal((await player.getProfile()).name, "FC");
    assert.equal((await player.getBest({ songId: 1, songType: "dx", levelIndex: 3 })).id, 1);
    assert.equal((await player.getBests()).dx_total, 320);
    assert.deepEqual(await player.getBests({ songId: 1 }), [score]);
    assert.equal(requestedPaths.at(-1), "/api/v0/maimai/player/1234567890/bests?song_id=1");
    assert.equal((await player.getRecents())[0]?.id, 1);
    assert.equal((await player.getSimpleScores())[0]?.song_name, "Song");
    assert.equal((await player.getApBests()).dx_total, 320);
    assert.equal((await player.getHeatmap())["2026-01-01"], 2);
    assert.equal((await player.getTrend())[0]?.total, 15_000);
    assert.equal(
      (await player.getScoreHistory({ songId: 1, songType: "dx", levelIndex: 3 }))?.[0]?.id,
      1,
    );
    assert.equal((await player.getCollectionProgress("plate", 7)).id, 7);

    const byQQ = await client.getPlayerByQQ(123);
    assert.equal((await byQQ.getProfile()).friend_code, 9876543210);
    await assert.rejects(
      client.getPlayerByQQ(456),
      (error) =>
        isLxnsProberError(error) &&
        error.message === "Lxns player binding requires a valid friend_code",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("LXNS developer player validates bindings and retries a failed profile request", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (!url.pathname.endsWith("/player/1234567890")) {
      throw new Error(`Unexpected request: ${url.href}`);
    }
    attempts += 1;
    if (attempts === 1) throw new Error("temporary network failure");
    return lxnsResponse({ name: "FC", rating: 15_000, friend_code: 1234567890 });
  };

  try {
    const client = createLxnsClient({
      devAccessToken: "dev-token",
      baseURL: "https://example.test/api/v0/",
    });
    assert.throws(
      () => client.getPlayer(Number.NaN),
      (error) =>
        isLxnsProberError(error) &&
        error.message === "Lxns player binding requires a valid friend_code",
    );
    assert.throws(
      () => client.getPlayer(Number.POSITIVE_INFINITY),
      (error) =>
        isLxnsProberError(error) &&
        error.message === "Lxns player binding requires a valid friend_code",
    );

    const player = client.getPlayer(1234567890);
    await assert.rejects(
      player.getProfile(),
      (error) => isLxnsProberError(error) && error.message.includes("temporary network failure"),
    );
    assert.equal((await player.getProfile()).friend_code, 1234567890);
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("LXNS binary requests reject +json error responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.equal(request.headers.get("Accept"), "*/*");
    return new Response(
      JSON.stringify({ success: false, code: 422, message: "export unavailable" }),
      {
        status: 200,
        headers: { "Content-Type": "application/problem+json; charset=utf-8" },
      },
    );
  };

  try {
    const player = createLxnsClient({
      personalAccessToken: "personal-token",
      baseURL: "https://example.test/api/v0/",
    }).me();
    await assert.rejects(
      player.exportScores(),
      (error) =>
        isLxnsProberError(error) && error.code === 422 && error.message === "export unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function lxnsResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, code: 200, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
