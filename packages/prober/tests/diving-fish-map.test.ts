import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapDivingFishBestsFromCharts,
  mapDivingFishBestsFromRecords,
  mapDivingFishProfile,
  mapDivingFishRecord,
  mapDivingFishSongType,
} from "@mai-kit/prober";

type DivingFishRecord = Parameters<typeof mapDivingFishRecord>[0];

const sample: DivingFishRecord = {
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

void test("mapDivingFishSongType maps DX/SD", () => {
  assert.equal(mapDivingFishSongType("DX"), "dx");
  assert.equal(mapDivingFishSongType("SD"), "standard");
});

void test("mapDivingFishRecord maps fields for draw", () => {
  const score = mapDivingFishRecord(sample);
  assert.equal(score.id, 11810);
  assert.equal(score.type, "dx");
  assert.equal(score.fc, "fc");
  assert.equal(score.fs, null);
  assert.equal(score.dx_score, 2857);
  assert.equal(score.dx_rating, 330);
  assert.equal(score.rate, "sssp");
  assert.equal(score.level_index, 3);
});

void test("mapDivingFishBestsFromCharts uses dx/sd lists", () => {
  const payload = {
    rating: 16000,
    nickname: "test",
    additional_rating: 17,
    plate: "煌将",
    charts: {
      dx: [sample],
      sd: [{ ...sample, song_id: 9, type: "SD", ra: 200, title: "old" }],
    },
  };
  const bests = mapDivingFishBestsFromCharts(payload);
  assert.equal(bests.dx.length, 1);
  assert.equal(bests.standard.length, 1);
  assert.equal(bests.dx_total, 330);
  assert.equal(bests.standard_total, 200);
  const profile = mapDivingFishProfile(payload, 123);
  assert.equal(profile.name, "test");
  assert.equal(profile.course_rank, 17);
  assert.equal(profile.friend_code, 123);
  assert.equal(profile.trophy?.name, "煌将");
});

void test("mapDivingFishBestsFromRecords splits by is_new and ranks by ra", () => {
  const records: DivingFishRecord[] = [
    { ...sample, song_id: 1, ra: 100, type: "DX" },
    { ...sample, song_id: 2, ra: 300, type: "DX" },
    { ...sample, song_id: 3, ra: 200, type: "SD" },
    { ...sample, song_id: 4, ra: 400, type: "SD" },
  ];
  const isNew = new Map<number, boolean>([
    [1, true],
    [2, true],
    [3, false],
    [4, false],
  ]);
  const bests = mapDivingFishBestsFromRecords(records, isNew);
  assert.deepEqual(
    bests.dx.map((s) => s.id),
    [2, 1],
  );
  assert.deepEqual(
    bests.standard.map((s) => s.id),
    [4, 3],
  );
});
