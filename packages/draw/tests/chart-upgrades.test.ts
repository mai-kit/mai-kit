import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { LevelIndex } from "@mai-kit/shared";
import { Draw, type ScoreChart, type UpgradeBoardData } from "@mai-kit/draw";

const chart: ScoreChart = {
  id: 8,
  song_name: "True Love Song",
  type: "dx",
  level_index: LevelIndex.MASTER,
  achievements: 100.5234,
  dx_score: 2_100,
  dx_max: 2_283,
  dx_star: 3,
  dx_rating: 312,
  level: "14+",
  level_value: 14.7,
  rate: "sssp",
  fc: "ap",
};

const source = {
  async getAsset(): Promise<Uint8Array> {
    // 强制走占位图，避免假 PNG 字节让 satori 解析失败
    throw new Error("no real asset in unit test");
  },
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

void test("chart renders a PNG with same board size as B50 family", async () => {
  const draw = new Draw({ database: source });
  const png = await draw.chart(chart, {
    scale: 1,
    header: "example.header",
    assetFallback: "placeholder",
  });
  assert.ok(isPng(png));
  assert.deepEqual(Draw.getBoardSize(1), { width: 1920, height: 1080 });
  mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../output/chart-card.png", import.meta.url), png);
});

void test("upgrades renders a PNG from host-provided candidates", async () => {
  const board: UpgradeBoardData = {
    candidates: [
      {
        score: { ...chart, achievements: 99.5, dx_rating: 300 },
        levelValue: 14.7,
        currentRating: 300,
        targetRating: 330,
        targetAchievement: 100.5,
      },
      {
        score: {
          ...chart,
          id: 9,
          song_name: "Another Song",
          achievements: 100,
          dx_rating: 310,
        },
        levelValue: 14.7,
        currentRating: 310,
        targetRating: 325,
        targetAchievement: 100.5,
      },
    ],
  };

  const draw = new Draw({ database: source });
  const png = await draw.upgrades(board, {
    scale: 1,
    header: "example.header",
    assetFallback: "placeholder",
  });
  assert.ok(isPng(png));
  writeFileSync(new URL("../output/upgrades-board.png", import.meta.url), png);
});

void test("upgrades only requests visible jacket assets", async () => {
  const requested: string[] = [];
  const draw = new Draw({
    database: {
      async getAsset(type) {
        requested.push(type);
        throw new Error("no real asset in unit test");
      },
    },
  });
  const data: UpgradeBoardData = {
    candidates: [
      {
        score: chart,
        levelValue: 14.7,
        currentRating: 312,
        targetRating: 330,
        targetAchievement: 100.5,
      },
    ],
  };

  const svg = await draw.upgradesSvg(data, { assetFallback: "placeholder" });
  assert.ok(svg.includes("<svg"));
  assert.deepEqual(requested, ["jacket"]);
});

void test("upgrades rejects candidates with mixed target achievements", async () => {
  const draw = new Draw({ database: source });
  await assert.rejects(
    draw.upgradesSvg({
      candidates: [
        {
          score: chart,
          levelValue: 14.7,
          currentRating: 300,
          targetRating: 320,
          targetAchievement: 100,
        },
        {
          score: chart,
          levelValue: 14.7,
          currentRating: 300,
          targetRating: 330,
          targetAchievement: 100.5,
        },
      ],
    }),
    /same targetAchievement/u,
  );
});

void test("chartSvg includes achievement text path content size", async () => {
  const svg = await new Draw({ database: source }).chartSvg(chart, {
    assetFallback: "placeholder",
  });
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.length > 5_000);
});

void test("chart and upgrades boards render the optional custom header", async () => {
  const draw = new Draw({ database: source });
  const chartWithoutHeader = await draw.chartSvg(chart, { assetFallback: "placeholder" });
  const chartWithHeader = await draw.chartSvg(chart, {
    header: "example.header",
    assetFallback: "placeholder",
  });
  assert.notEqual(chartWithHeader, chartWithoutHeader);

  const upgradesWithoutHeader = await draw.upgradesSvg({ candidates: [] });
  const upgradesWithHeader = await draw.upgradesSvg(
    { candidates: [] },
    { header: "example.header" },
  );
  assert.notEqual(upgradesWithHeader, upgradesWithoutHeader);
});
