import assert from "node:assert/strict";
import { test } from "node:test";
import { DivingFishMaimaiDatabase } from "@mai-kit/database";
import {
  divingFishCoverId,
  mapDivingFishMusicDataToSongList,
} from "../src/adapters/diving-fish/map-songs.ts";

void test("divingFishCoverId pads and maps 10001-11000", () => {
  assert.equal(divingFishCoverId(38), "00038");
  assert.equal(divingFishCoverId(10038), "00038");
  assert.equal(divingFishCoverId(11235), "11235");
});

void test("mapDivingFishMusicDataToSongList merges SD/DX and notes", () => {
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

  const list = mapDivingFishMusicDataToSongList(entries, { notes: true });
  assert.equal(list.songs.length, 2);
  const sd = list.songs.find((s) => s.id === 8);
  assert.ok(sd);
  assert.equal(sd.difficulties.standard.length, 4);
  assert.equal(sd.difficulties.dx.length, 0);
  assert.equal(sd.difficulties.standard[3]?.notes?.total, 263 + 14 + 19 + 6);

  const dx = list.songs.find((s) => s.id === 10030);
  assert.ok(dx);
  assert.equal(dx.difficulties.dx.length, 4);
  assert.equal(dx.difficulties.dx[3]?.notes?.touch, 41);
  assert.equal(dx.difficulties.dx[3]?.notes?.total, 417 + 8 + 91 + 41 + 74);
  assert.equal(dx.difficulties.dx[3]?.note_designer, "test");
});

void test("DivingFishMaimaiDatabase validates chart stats and maps empty charts to null", async () => {
  const originalFetch = globalThis.fetch;
  let body: unknown = {
    charts: {
      11451: [
        {},
        {
          cnt: 100,
          diff: 1,
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
    assert.equal(result.charts["11451"]?.[1]?.fit_diff, 7.4);
    assert.equal(result.diff_data["1"]?.achievements, 97.2);

    body = { charts: [], diff_data: {} };
    await assert.rejects(database.getChartStats(), /unexpected response structure/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
