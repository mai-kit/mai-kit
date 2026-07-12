import type { Bests, PlayerProfile, Score } from "@mai-kit/prober";
import { normalizeAchievement, parseLevelString } from "@mai-kit/utils";
import { buildSongDxMaxMap, buildSongLevelMap, scoreMapKey } from "@mai-kit/utils/song";
import { DrawError } from "./error";
import type {
  MetricItem,
  PosterData,
  PosterDataSource,
  RadarItem,
  RatingDistributionItem,
} from "./types";

const RATING_COLORS = ["#ec654e", "#f2a34b", "#438dcb", "#326fb4"];

/**
 * 将 prober 档案 + Best50 与标签 / 曲目源聚合成 {@link PosterData}。
 *
 * 由 {@link Draw.withPlayer} 调用；一般用户无需直接使用。
 *
 * - `source.getChartTags`：谱面倾向雷达（必选）
 * - `source.getSongList`（可选）：自动填 `dx_max` / `level_value`
 *
 * 封面 / 头像在 {@link PlayerDraw} 渲染阶段解析。
 *
 * @throws {DrawError} 可用配置类标签少于 3 个等
 */
export async function buildPlayerData(
  player: PlayerProfile,
  bests: Bests,
  source: PosterDataSource,
): Promise<PosterData> {
  const newScores = bests.dx.slice(0, 15);
  const oldScores = bests.standard.slice(0, 35);
  const b50 = [...newScores, ...oldScores];

  const { songDxMaxMap, songLevelMap } = await loadSongMaps(source);

  const charts = b50.map((score) => {
    const key = scoreMapKey(score);
    const dx_max = songDxMaxMap?.get(key);
    const level_value = songLevelMap?.get(key);
    const chart = Object.assign({}, score);
    if (dx_max != null) Object.assign(chart, { dx_max });
    if (level_value != null) Object.assign(chart, { level_value });
    return chart;
  });

  const achievementAverage = average(b50.map((score) => normalizeAchievement(score.achievements)));
  const ratingAverage = average(b50.map(ratingOf));
  const maxRating = Math.max(...b50.map(ratingOf), 0);
  const maxDxScore = Math.max(...b50.map((score) => score.dx_score ?? 0), 0);
  const newTotal = bests.dx_total || sumRating(newScores);
  const oldTotal = bests.standard_total || sumRating(oldScores);
  const radar = await buildTagRadar(b50, source);

  return {
    player,
    charts,
    summary: {
      b50: sumRating(b50) || newTotal + oldTotal,
      newSongs: newTotal,
      oldSongs: oldTotal,
      averageAchievement: `${achievementAverage.toFixed(3)}%`,
      averageRating: round1(ratingAverage),
      maxDxScore,
      apPlus: b50.filter((score) => score.fc === "app").length,
      syncDxPlus: b50.filter((score) => score.fs === "fsdp").length,
      totalCharts: b50.length,
    },
    ratingDistribution: buildRatingDistribution(b50),
    constantDistribution: buildConstantDistribution(b50, songLevelMap),
    radar,
    personalMetrics: buildPersonalMetrics(
      b50,
      achievementAverage,
      ratingAverage,
      maxRating,
      maxDxScore,
    ),
  };
}

async function loadSongMaps(source: PosterDataSource): Promise<{
  songDxMaxMap?: Map<string, number>;
  songLevelMap?: Map<string, number>;
}> {
  if (typeof source.getSongList !== "function") {
    return {};
  }
  const { songs } = await source.getSongList({ notes: true });
  return {
    songDxMaxMap: buildSongDxMaxMap(songs),
    songLevelMap: buildSongLevelMap(songs),
  };
}

function buildRatingDistribution(scores: Score[]): RatingDistributionItem[] {
  const groups = [
    { label: "SSS+", match: (score: Score) => score.rate === "sssp" },
    { label: "SSS", match: (score: Score) => score.rate === "sss" },
    { label: "SS+", match: (score: Score) => score.rate === "ssp" },
    {
      label: "SS及以下",
      match: (score: Score) => !["sssp", "sss", "ssp"].includes(score.rate ?? ""),
    },
  ];
  return groups.map((group, index) => ({
    label: group.label,
    value: scores.filter(group.match).length,
    color: RATING_COLORS[index],
  }));
}

function buildConstantDistribution(scores: Score[], songLevelMap?: Map<string, number>): number[] {
  const buckets = Array.from({ length: 16 }, () => 0);
  for (const score of scores) {
    const levelValue = songLevelMap?.get(scoreMapKey(score)) ?? parseLevelString(score.level);
    if (levelValue === undefined) {
      throw new DrawError(`Score ${score.id} is missing a parseable level`);
    }
    const index = clamp(Math.floor((levelValue - 13.5) / 0.125), 0, buckets.length - 1);
    buckets[index] += 1;
  }
  return buckets;
}

async function buildTagRadar(scores: Score[], tagSource: PosterDataSource): Promise<RadarItem[]> {
  const chartTags = await tagSource.getChartTags(scores);
  const counts = new Map<number, { label: string; count: number }>();
  for (const tags of chartTags) {
    for (const tag of tags) {
      if (tag.group_id !== 1) continue;
      const label = tag.localized_name["zh-Hans"];
      if (!label) throw new DrawError(`DXRating tag ${tag.id} is missing zh-Hans name`);
      const current = counts.get(tag.id);
      counts.set(tag.id, { label, count: (current?.count ?? 0) + 1 });
    }
  }

  const topTags = [...counts.entries()]
    .map(([id, value]) => ({ id, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count || a.id - b.id)
    .slice(0, 6);
  if (topTags.length < 3) {
    throw new DrawError(`B50 chart tags are insufficient for radar (${topTags.length}/3)`);
  }

  const max = topTags[0].count;
  return topTags.map((tag) => ({
    label: tag.label,
    value: Math.round((tag.count / max) * 100),
    displayValue: tag.count,
  }));
}

function buildPersonalMetrics(
  scores: Score[],
  achievementAverage: number,
  ratingAverage: number,
  maxRating: number,
  maxDxScore: number,
): MetricItem[] {
  return [
    { label: "平均达成率", value: `${achievementAverage.toFixed(3)}%` },
    { label: "平均 Rating", value: round1(ratingAverage) },
    { label: "最高 Rating", value: maxRating },
    { label: "最高 DX 分", value: maxDxScore },
    { label: "FC/AP 数", value: scores.filter((score) => score.fc).length },
    { label: "FS 数", value: scores.filter((score) => score.fs).length },
  ];
}

function sumRating(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + ratingOf(score), 0);
}

function ratingOf(score: Score): number {
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
