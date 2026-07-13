import type { Bests, PlayerProfile, Score } from "@mai-kit/prober";
import { buildSongDxMaxMap, buildSongLevelMap, scoreMapKey } from "@mai-kit/utils/song";
import { DrawError } from "./error";
import { summarizeCharts } from "./poster-derived";
import type { PosterData, PosterDataSource, RadarItem, ScoreChart } from "./types";

/**
 * 将 prober 档案 + Best50 与标签 / 曲目源聚合成 {@link PosterData}。
 *
 * 由 {@link Draw.poster} 调用；也可经包根 `buildPosterData` 单独使用。
 *
 * - `source.getChartTags`：谱面倾向雷达（必选）
 * - `source.getSongList`（可选）：自动填 `dx_max` / `level_value`
 * - **只写入权威字段**：`player` / `charts` / `summary` / `radar`
 *   （评级/定数分布与个人数据网格在渲染时从 charts/summary 派生，不双写）
 *
 * 封面 / 头像在渲染阶段解析。
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

  const charts: ScoreChart[] = b50.map((score) => {
    const key = scoreMapKey(score);
    const dx_max = songDxMaxMap?.get(key);
    const level_value = songLevelMap?.get(key);
    const chart = Object.assign({}, score) as ScoreChart;
    if (dx_max != null) Object.assign(chart, { dx_max });
    if (level_value != null) Object.assign(chart, { level_value });
    return chart;
  });

  const radar = await buildTagRadar(b50, source);

  return {
    player,
    charts,
    summary: summarizeCharts(charts, {
      newSongs: bests.dx_total,
      oldSongs: bests.standard_total,
    }),
    radar,
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
