/**
 * 从 {@link PosterData} 的权威字段（`charts` / `summary`）派生展示用统计。
 * 不进入 {@link PosterData} 公共模型，避免与 charts 双写。
 */
import { normalizeAchievement, parseLevelString } from "@mai-kit/utils";
import { DrawError } from "./error";
import type {
  MetricItem,
  PosterData,
  PosterSummary,
  RatingDistributionItem,
  ScoreChart,
} from "./types";

const RATING_COLORS = ["#ec654e", "#f2a34b", "#438dcb", "#326fb4"];

/**
 * 由 B50 成绩推导评级分布（饼图）。
 */
export function ratingDistributionFromCharts(
  charts: readonly ScoreChart[],
): RatingDistributionItem[] {
  const groups = [
    { label: "SSS+", match: (score: ScoreChart) => score.rate === "sssp" },
    { label: "SSS", match: (score: ScoreChart) => score.rate === "sss" },
    { label: "SS+", match: (score: ScoreChart) => score.rate === "ssp" },
    {
      label: "SS及以下",
      match: (score: ScoreChart) => !["sssp", "sss", "ssp"].includes(score.rate ?? ""),
    },
  ];
  return groups.map((group, index) => ({
    label: group.label,
    value: charts.filter(group.match).length,
    color: RATING_COLORS[index] ?? RATING_COLORS[0],
  }));
}

/**
 * 由 B50 成绩推导定数分布直方图（16 桶）。
 *
 * @throws {DrawError} 某条成绩既无 `level_value` 也无法解析 `level`
 */
export function constantDistributionFromCharts(charts: readonly ScoreChart[]): number[] {
  const buckets = Array.from({ length: 16 }, () => 0);
  for (const chart of charts) {
    const levelValue = chart.level_value ?? parseLevelString(chart.level);
    if (levelValue === undefined) {
      throw new DrawError(`Score ${chart.id} is missing a parseable level`);
    }
    const index = clamp(Math.floor((levelValue - 13.5) / 0.125), 0, buckets.length - 1);
    buckets[index] += 1;
  }
  return buckets;
}

/**
 * 左栏「个人数据」网格：只读 `summary`（与 charts 已对齐的聚合结果）。
 * 自定义网格请传 {@link PosterData.personalMetrics} 整表覆盖。
 */
export function personalMetricsFromSummary(summary: PosterSummary): MetricItem[] {
  return [
    { label: "平均达成率", value: summary.averageAchievement },
    { label: "平均 Rating", value: summary.averageRating },
    { label: "最高 Rating", value: summary.maxRating },
    { label: "最高 DX 分", value: summary.maxDxScore },
    { label: "AP+ 数量", value: summary.apPlus },
    { label: "SYNC DX+ 数量", value: summary.syncDxPlus },
  ];
}

/**
 * 渲染用指标：有自定义 `personalMetrics` 则用之，否则从 `summary` 派生。
 */
export function resolvePersonalMetrics(data: PosterData): MetricItem[] {
  return data.personalMetrics ?? personalMetricsFromSummary(data.summary);
}

/**
 * 从 charts 聚合 poster 用 {@link PosterSummary}（唯一写入 summary 的路径）。
 *
 * @param charts - 已按 B15+B35 排好的成绩
 * @param sectionTotals - 可选：新/旧曲区合计（优先于切片求和，对齐 prober `dx_total` / `standard_total`）
 */
export function summarizeCharts(
  charts: readonly ScoreChart[],
  sectionTotals?: { newSongs?: number; oldSongs?: number },
): PosterSummary {
  const newCharts = charts.slice(0, 15);
  const oldCharts = charts.slice(15, 50);
  const achievementAverage = average(
    charts.map((score) => normalizeAchievement(score.achievements)),
  );
  const ratings = charts.map(ratingOf);
  const ratingAverage = average(ratings);
  const maxRating = Math.max(...ratings, 0);
  const maxDxScore = Math.max(...charts.map((score) => score.dx_score ?? 0), 0);
  // 与历史一致：源合计为 0 / 缺省时回退到切片求和
  const newSongs = sectionTotals?.newSongs || sumRating(newCharts);
  const oldSongs = sectionTotals?.oldSongs || sumRating(oldCharts);

  return {
    b50: sumRating(charts) || newSongs + oldSongs,
    newSongs,
    oldSongs,
    averageAchievement: `${achievementAverage.toFixed(3)}%`,
    averageRating: round1(ratingAverage),
    maxRating,
    maxDxScore,
    apPlus: charts.filter((score) => score.fc === "app").length,
    syncDxPlus: charts.filter((score) => score.fs === "fsdp").length,
    totalCharts: charts.length,
  };
}

function sumRating(scores: readonly ScoreChart[]): number {
  return scores.reduce((sum, score) => sum + ratingOf(score), 0);
}

function ratingOf(score: ScoreChart): number {
  return Math.floor(score.dx_rating ?? 0);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
