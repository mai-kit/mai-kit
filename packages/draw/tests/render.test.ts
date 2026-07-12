import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Draw,
  PlayerDraw,
  BEST_HEIGHT,
  BEST_WIDTH,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  type DrawLayout,
} from "@mai-kit/draw";
import type { PosterData } from "@mai-kit/draw";

/**
 * 固定成绩列表。不含任何外部图片，封面 / 头像由渲染器生成占位图，
 * 保证测试自包含、可重复。字段采用 prober 原始形态（id / song_name /
 * achievements:number / dx_score / dx_max / dx_star / rate / fc / fs），格式化由渲染器完成。
 */
const fixedData: PosterData = {
  player: {
    name: "Amatsuka",
    rating: 15823,
    upload_time: "2026-07-06T12:00:00",
  },
  summary: {
    b50: 15823,
    newSongs: 4821,
    oldSongs: 11002,
    averageAchievement: "100.578%",
    averageRating: 316.5,
    maxDxScore: 3045,
    apPlus: 38,
    syncDxPlus: 26,
    totalCharts: 2731,
  },
  // 固定 50 条，便于 best15/35/50 网格填满自检
  charts: Array.from({ length: 50 }, (_, i) => {
    const seed = [
      { song_name: "PANDORA PARADOXXX", rate: "sssp" as const, fc: "app" as const },
      { song_name: "系ぎて", rate: "sssp" as const, fc: "app" as const },
      { song_name: "Chronomia", rate: "sssp" as const, fc: "fc" as const },
      { song_name: "火焰地獄", rate: "sssp" as const, fc: "fc" as const },
      { song_name: "INFINITE ENERZY -Overdoze-", rate: "sssp" as const, fs: "sync" as const },
      { song_name: "侮る極ステロイド", rate: "sss" as const, fc: "fc" as const },
      { song_name: "封焔の135秒", rate: "sssp" as const, fc: "ap" as const },
      { song_name: "Regulus", rate: "ss" as const, fc: "fcp" as const },
      { song_name: "AMABIE", rate: "sssp" as const },
      { song_name: "超熊猫的周遊記", rate: "ssp" as const, fs: "fsd" as const },
    ][i % 10];
    return {
      id: i + 1,
      song_name: i < 10 ? seed.song_name : `${seed.song_name} #${i + 1}`,
      type: i % 2 === 0 ? ("dx" as const) : ("standard" as const),
      level_index: 3,
      achievements: 100.9 - (i % 17) * 0.05,
      dx_score: 330 - (i % 20),
      dx_max: 339,
      dx_star: (i % 5) + 1,
      level: String(14.9 - (i % 10) * 0.1),
      dx_rating: 320 - (i % 30),
      level_value: 14.5 - (i % 10) * 0.1,
      rate: seed.rate,
      ...(seed.fc ? { fc: seed.fc } : {}),
      ...(seed.fs ? { fs: seed.fs } : {}),
    };
  }),
  ratingDistribution: [
    { label: "14+", value: 18, color: "#9e6df0" },
    { label: "13+", value: 22, color: "#cf57ed" },
    { label: "12+", value: 10, color: "#56dbff" },
  ],
  constantDistribution: [1, 3, 6, 9, 14, 12, 5],
  radar: [
    { label: "体力", value: 82, displayValue: 12 },
    { label: "技术", value: 75, displayValue: 11 },
    { label: "速度", value: 88, displayValue: 13 },
    { label: "精度", value: 70, displayValue: 10 },
    { label: "稳定", value: 65, displayValue: 9 },
  ],
};

const renderer = new PlayerDraw(fixedData);

/** PNG 文件头魔数 `\x89PNG\r\n\x1a\n`（用于断言渲染产物是合法 PNG，不是随机字节） */
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function pngDimensions(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

void test("render poster returns a valid PNG at poster size", async () => {
  const png = await renderer.render("poster");
  assert.ok(png.length > 1000, "PNG should be non-trivial in size");
  assert.ok(isPng(png), "should be a valid PNG (magic header)");
  const { width, height } = pngDimensions(png);
  assert.equal(width, POSTER_WIDTH * 2);
  assert.equal(height, POSTER_HEIGHT * 2);

  // 写出最新渲染结果，便于人工查看（packages/draw/output/，已 gitignore）
  const out = new URL("../output/test.png", import.meta.url);
  mkdirSync(new URL(".", out), { recursive: true });
  writeFileSync(out, png);
});

void test("render honors scale", async () => {
  const png = await renderer.render("poster", { scale: 2 });
  const { width, height } = pngDimensions(png);
  assert.equal(width, POSTER_WIDTH * 2);
  assert.equal(height, POSTER_HEIGHT * 2);
  assert.deepEqual(Draw.getSize("poster", 2), {
    width: POSTER_WIDTH * 2,
    height: POSTER_HEIGHT * 2,
  });
});

void test("renderSvg returns a non-trivial SVG with poster dimensions", async () => {
  const svg = await renderer.renderSvg("poster", {
    footerLeft: "example.left",
    footerRight: "example.right",
  });
  assert.equal(typeof svg, "string");
  assert.ok(svg.trimStart().startsWith("<svg"), "should start with <svg");
  assert.ok(svg.length > 10000, "SVG should contain substantial rendered content");
  assert.ok(svg.includes(`width="${POSTER_WIDTH}"`), "should declare poster width");
  assert.ok(svg.includes(`height="${POSTER_HEIGHT}"`), "should declare poster height");
  assert.ok(svg.includes("<path"), "should render vector content");
  // satori 把文字描成 path，不能用 includes 查原文；用有无 footer 的差异断言
  const withoutFooter = await renderer.renderSvg("poster");
  const onlyLeft = await renderer.renderSvg("poster", { footerLeft: "example.left" });
  const onlyRight = await renderer.renderSvg("poster", { footerRight: "example.right" });
  assert.notEqual(svg, withoutFooter, "should render footers when supplied");
  assert.notEqual(onlyLeft, withoutFooter, "should render footerLeft alone");
  assert.notEqual(onlyRight, withoutFooter, "should render footerRight alone");
  assert.notEqual(onlyLeft, onlyRight, "left-only and right-only footers should differ");
  assert.ok(!svg.includes("maimai.lxns.net"), "should not render a hard-coded footer");
});

const bestLayouts = ["best50", "best15", "best35"] as const satisfies readonly DrawLayout[];

for (const layout of bestLayouts) {
  void test(`render("${layout}") returns 16:9 PNG`, async () => {
    const png = await renderer.render(layout);
    assert.deepEqual(pngDimensions(png), {
      width: BEST_WIDTH * 2,
      height: BEST_HEIGHT * 2,
    });
    writeFileSync(new URL(`../output/${layout}.png`, import.meta.url), png);
    assert.deepEqual(Draw.getSize(layout, 2), {
      width: BEST_WIDTH * 2,
      height: BEST_HEIGHT * 2,
    });
  });
}
