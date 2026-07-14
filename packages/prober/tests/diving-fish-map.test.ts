import assert from "node:assert/strict";
import { test } from "node:test";
import { createDivingFishClient, isDivingFishProberError, type Score } from "@mai-kit/prober";

const sample = {
  achievements: 100.5492,
  ds: 14.7,
  dxScore: 2857,
  fc: "fc",
  fs: "",
  level: "14+",
  level_index: 3,
  ra: 330,
  rate: "sssp",
  song_id: 11810,
  title: "ATLAS RUSH",
  type: "DX",
};

void test("Diving-Fish public B50 maps profile and scores without fabricated fields", async () => {
  const payload = {
    rating: 16_000,
    nickname: "test",
    additional_rating: 17,
    plate: "煌将",
    charts: {
      dx: [sample],
      sd: [{ ...sample, song_id: 9, type: "SD", ra: 200, title: "old" }],
    },
  };

  await withMockedFetch(payload, async () => {
    const player = await createDivingFishClient({
      baseURL: "https://example.test/api/",
    }).getPlayer({ qq: 123 });
    const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);

    assert.equal(profile.name, "test");
    assert.equal(profile.course_rank, 17);
    assert.equal(profile.friend_code, undefined);
    assert.equal(profile.trophy?.name, "煌将");
    assert.equal(profile.trophy?.id, undefined);
    assert.equal(profile.class_rank, undefined);
    assert.equal(profile.star, undefined);
    assert.equal(bests.dx_total, 330);
    assert.equal(bests.standard_total, 200);
    assert.deepEqual(pickMappedScore(bests.dx[0]), {
      id: 11810,
      type: "dx",
      fc: "fc",
      fs: null,
      dx_score: 2857,
      dx_rating: 330,
      rate: "sssp",
      level_index: 3,
    });
  });
});

void test("Diving-Fish preserves an upstream whitespace-only title", async () => {
  const payload = {
    rating: 16_000,
    nickname: "test",
    charts: { dx: [{ ...sample, title: "　" }], sd: [] },
  };

  await withMockedFetch(payload, async () => {
    const player = await createDivingFishClient({
      baseURL: "https://example.test/api/",
    }).getPlayer({ username: "test" });
    assert.equal((await player.getBests()).dx[0]?.song_name, "　");
  });
});

void test("Diving-Fish public B50 rejects malformed required data", async () => {
  const invalidPayloads = [
    { rating: 15_000, charts: { dx: [], sd: [] } },
    { rating: 15_000, nickname: "test" },
    {
      rating: 15_000,
      nickname: "test",
      charts: { dx: [{ ...sample, level_index: 9 }], sd: [] },
    },
    {
      rating: 15_000,
      nickname: "test",
      charts: { dx: [{ ...sample, rate: "unknown" }], sd: [] },
    },
    {
      rating: 15_000,
      nickname: "test",
      charts: { dx: [{ ...sample, type: "utage" }], sd: [] },
    },
  ];

  for (const payload of invalidPayloads) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- fetch mock is process-global
    await withMockedFetch(payload, async () => {
      await assert.rejects(
        createDivingFishClient({ baseURL: "https://example.test/api/" }).getPlayer({
          username: "test",
        }),
        (error: unknown) => isDivingFishProberError(error),
      );
    });
  }
});

void test("Diving-Fish complete records split B50 by music_data is_new", async () => {
  const records = [
    { ...sample, song_id: 1, ra: 100, type: "DX" },
    { ...sample, song_id: 2, ra: 300, type: "DX" },
    { ...sample, song_id: 3, ra: 200, type: "SD" },
    { ...sample, song_id: 4, ra: 400, type: "SD" },
    {
      ...sample,
      song_id: 100508,
      title: "[宴] Song",
      level: "13?",
      level_index: 0,
      level_label: "Utage",
      achievements: 196,
      ra: 0,
      type: "DX",
    },
  ];
  const payload = { rating: 16_000, nickname: "test", records };
  const musicData = [
    { id: "1", basic_info: { is_new: true } },
    { id: "2", basic_info: { is_new: true } },
    { id: "3", basic_info: { is_new: false } },
    { id: "4", basic_info: { is_new: false } },
  ];

  await withMockedEndpointFetch(
    { "player/test_data": payload, music_data: musicData },
    async () => {
      const player = await createDivingFishClient({
        baseURL: "https://example.test/api/",
      }).getTestPlayer();
      const bests = await player.getBests();
      assert.deepEqual(
        bests.dx.map((score) => score.id),
        [2, 1],
      );
      assert.deepEqual(
        bests.standard.map((score) => score.id),
        [4, 3],
      );
      const utage = await player.getScores({ songId: 100508 });
      assert.deepEqual(
        utage.map((score) => [score.id, score.type]),
        [[100508, "utage"]],
      );
    },
  );

  await withMockedEndpointFetch(
    { "player/test_data": payload, music_data: musicData.slice(0, 1) },
    async () => {
      const player = await createDivingFishClient({
        baseURL: "https://example.test/api/",
      }).getTestPlayer();
      await assert.rejects(player.getBests(), (error: unknown) => isDivingFishProberError(error));
    },
  );
});

function pickMappedScore(score: Score | undefined) {
  assert.ok(score);
  return {
    id: score.id,
    type: score.type,
    fc: score.fc,
    fs: score.fs,
    dx_score: score.dx_score,
    dx_rating: score.dx_rating,
    rate: score.rate,
    level_index: score.level_index,
  };
}

async function withMockedFetch(body: unknown, action: () => Promise<void>): Promise<void> {
  await withMockedEndpointFetch({ "query/player": body }, action);
}

async function withMockedEndpointFetch(
  bodies: Readonly<Record<string, unknown>>,
  action: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const pathname = new URL(input instanceof Request ? input.url : input).pathname;
    const endpoint = pathname.split("/").filter(Boolean).slice(-2).join("/");
    const body = bodies[endpoint] ?? bodies[pathname.split("/").filter(Boolean).at(-1) ?? ""];
    return new Response(JSON.stringify(body));
  };
  try {
    await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
