import assert from "node:assert/strict";
import { test } from "node:test";
import { DivingFishMaimaiDatabase, isDivingFishDatabaseError } from "@mai-kit/database";

const entries = [
  {
    id: "8",
    title: "True Love Song",
    type: "SD",
    ds: [5, 7.2, 10.2, 12.4],
    level: ["5", "7", "10", "12"],
    charts: [
      { notes: [63, 23, 8, 2] },
      { notes: [85, 27, 6, 4] },
      { notes: [110, 56, 9, 2] },
      { notes: [263, 14, 19, 6] },
    ],
    basic_info: { artist: "Kai", genre: "舞萌", bpm: 150, is_new: false },
  },
  {
    id: "10030",
    title: "ネコ日和。",
    type: "DX",
    ds: [5, 8.2, 11.7, 13.9],
    level: ["5", "8", "11+", "13+"],
    charts: [
      { notes: [1, 0, 0, 0, 0] },
      { notes: [1, 0, 0, 0, 0] },
      { notes: [1, 0, 0, 0, 0] },
      { notes: [417, 8, 91, 41, 74], charter: "test" },
    ],
    basic_info: { artist: "x", genre: "niconico", bpm: 200, is_new: true },
  },
];

void test("Diving-Fish public song list maps SD/DX notes without fabricated metadata", async () => {
  await withMockedFetch(entries, async () => {
    const database = new DivingFishMaimaiDatabase({
      baseURL: "https://example.test/api/",
    });
    const list = await database.getSongList({ notes: true });
    assert.equal(list.songs.length, 2);

    const standard = list.songs.find((song) => song.id === 8);
    assert.ok(standard);
    assert.equal(standard.difficulties.standard.length, 4);
    assert.equal(standard.difficulties.dx.length, 0);
    assert.equal(standard.difficulties.standard[3]?.notes?.total, 263 + 14 + 19 + 6);

    const dx = list.songs.find((song) => song.id === 10030);
    assert.ok(dx);
    assert.equal(dx.difficulties.dx.length, 4);
    assert.equal(dx.difficulties.dx[3]?.notes?.touch, 41);
    assert.equal(dx.difficulties.dx[3]?.notes?.total, 417 + 8 + 91 + 41 + 74);
    assert.equal(dx.difficulties.dx[3]?.note_designer, "test");
    assert.equal(dx.version, undefined);
    assert.equal(list.genres, undefined);
    assert.equal(list.versions, undefined);
  });
});

void test("Diving-Fish public song list preserves a non-empty whitespace title", async () => {
  const title = "　";
  await withMockedFetch(
    [
      {
        id: "11422",
        title,
        type: "DX",
        ds: [3],
        level: ["3"],
        charts: [{ notes: [100, 8, 8, 16, 1] }],
        basic_info: { title, artist: "x0o0x_", genre: "流行&动漫", bpm: 130 },
      },
    ],
    async () => {
      const database = new DivingFishMaimaiDatabase({
        baseURL: "https://example.test/api/",
      });
      const list = await database.getSongList({ notes: true });
      assert.equal(list.songs[0]?.title, title);
    },
  );
});

void test("Diving-Fish public song list rejects malformed fields", async () => {
  const base = {
    id: "8",
    title: "Song",
    type: "DX",
    ds: [14.7],
    level: ["14+"],
    charts: [{ notes: [1, 2, 3, 4, 5] }],
  };
  for (const entry of [
    { ...base, id: "invalid" },
    { ...base, id: "" },
    { ...base, type: "utage" },
    { ...base, level: [] },
    { ...base, title: "" },
    { ...base, title: null },
    { ...base, level: [1] },
    { ...base, charts: [{ notes: [1, 2] }] },
    { ...base, charts: [{ notes: [1, 2, 3, 4, 5], charter: 1 }] },
    null,
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- fetch mock is process-global
    await withMockedFetch([entry], async () => {
      const database = new DivingFishMaimaiDatabase({
        baseURL: "https://example.test/api/",
      });
      await assert.rejects(database.getSongList({ notes: true }), (error: unknown) =>
        isDivingFishDatabaseError(error),
      );
    });
  }
});

void test("Diving-Fish cover requests use the normalized public CDN id", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(new URL(input instanceof Request ? input.url : input).pathname);
    return new Response(new Uint8Array([1, 2, 3]));
  };
  try {
    const database = new DivingFishMaimaiDatabase({
      coverBaseURL: "https://example.test/covers/",
    });
    await database.getAsset("jacket", 38);
    await database.getAsset("jacket", 10038);
    await database.getAsset("jacket", 11235);
    assert.deepEqual(paths, ["/covers/00038.png", "/covers/00038.png", "/covers/11235.png"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("DivingFishMaimaiDatabase validates chart stats and maps empty charts to null", async () => {
  const originalFetch = globalThis.fetch;
  let body: unknown = {
    charts: {
      11451: [
        {},
        {
          cnt: 100,
          diff: "7",
          fit_diff: 7.4,
          avg: 98.5,
          avg_dx: 900,
          std_dev: 2.1,
          dist: [1, 2, 3],
          fc_dist: [70, 20, 8, 2, 0],
        },
      ],
    },
    diff_data: {
      1: {
        achievements: 97.2,
        dist: [0.1, 0.2, 0.7],
        fc_dist: [0.7, 0.2, 0.08, 0.02, 0],
      },
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify(body));

  try {
    const database = new DivingFishMaimaiDatabase({ baseURL: "https://example.test/api/" });
    const result = await database.getChartStats();
    assert.equal(result.charts["11451"]?.[0], null);
    assert.equal(result.charts["11451"]?.[1]?.diff, "7");
    assert.equal(result.charts["11451"]?.[1]?.fit_diff, 7.4);
    assert.equal(result.diff_data["1"]?.achievements, 97.2);

    body = { charts: [], diff_data: {} };
    await assert.rejects(database.getChartStats(), /unexpected response structure/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function withMockedFetch(body: unknown, action: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(body));
  try {
    await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
