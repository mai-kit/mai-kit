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
