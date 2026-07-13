import assert from "node:assert/strict";
import test from "node:test";
import { Draw, isDrawError } from "@mai-kit/draw";
import type { AssetSource } from "@mai-kit/draw";
import type { Bests, Score } from "@mai-kit/prober";

const score: Score = {
  id: 42,
  song_name: "Test Song",
  type: "dx",
  level_index: 3,
  achievements: 100.5,
  dx_score: 1000,
  dx_rating: 300,
  rate: "sssp",
};

const bests: Bests = {
  dx_total: 300,
  standard_total: 0,
  dx: [score],
  standard: [],
  dx_selections: [],
  standard_selections: [],
};

const player = { name: "Tester", rating: 10_000 };

function failingAssets(): AssetSource {
  return {
    async getAsset() {
      throw new Error("cdn down");
    },
  };
}

void test("assetFallback error (default) throws when jacket load fails", async () => {
  const draw = new Draw({ database: failingAssets() });
  await assert.rejects(
    async () => draw.best15Svg(player, bests, { assetFallback: "error" }),
    (error: unknown) => {
      assert.equal(isDrawError(error), true);
      assert.match(String(error), /jacket|42/u);
      return true;
    },
  );
});

void test("assetFallback placeholder continues when jacket load fails", async () => {
  const draw = new Draw({ database: failingAssets() });
  const svg = await draw.best15Svg(player, bests, { assetFallback: "placeholder" });
  assert.ok(svg.startsWith("<svg") || svg.includes("<svg"));
  assert.ok(svg.length > 1000);
});

void test("Best board loads song metadata once per render", async () => {
  let songListCalls = 0;
  const draw = new Draw({
    database: {
      async getAsset() {
        throw new Error("no asset");
      },
      async getSongList() {
        songListCalls += 1;
        return { songs: [] };
      },
    },
  });
  const repeated: Bests = {
    ...bests,
    dx: Array.from({ length: 5 }, (_, index) => ({ ...score, id: index + 1 })),
  };

  await draw.best15Svg(player, repeated, { assetFallback: "placeholder" });
  assert.equal(songListCalls, 1);
});

void test("Best board loads jackets concurrently with a fixed upper bound", async () => {
  let active = 0;
  let assetCalls = 0;
  let maxActive = 0;
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const draw = new Draw({
    database: {
      async getAsset() {
        assetCalls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return png;
      },
      async getSongList() {
        return { songs: [] };
      },
    },
  });
  const charts = Array.from({ length: 15 }, (_, index) => ({
    ...score,
    id: index + 1,
    song_name: `Song ${index + 1}`,
  }));

  const svg = await draw.best15Svg(player, { ...bests, dx: charts });

  assert.ok(maxActive > 1);
  assert.ok(maxActive <= 8);
  assert.equal(assetCalls, 15);
  assert.ok(svg.startsWith("<svg") || svg.includes("<svg"));
});
