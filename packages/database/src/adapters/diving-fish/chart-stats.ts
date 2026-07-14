import { divingFishChartStatsSchema, parseDivingFishResponse } from "./schemas";

/** 水鱼按难度汇总的全站成绩统计。 */
export interface DivingFishDifficultyStats {
  /** 平均达成率 */
  achievements: number;
  /** D 至 SSS+ 各评级占比 */
  dist: number[];
  /** 未 FC、FC、FC+、AP、AP+ 各完成度占比 */
  fc_dist: number[];
}

/** 水鱼单张谱面的社区成绩统计。 */
export interface DivingFishChartStat {
  /** 参与统计的成绩数量 */
  cnt: number;
  /** 上游等级文案（如 `"12+"`）；难度索引由所在数组下标表示 */
  diff: string;
  /** 水鱼根据社区成绩拟合的相对难度 */
  fit_diff: number;
  /** 平均达成率 */
  avg: number;
  /** 平均 DX 分 */
  avg_dx: number;
  /** 达成率标准差 */
  std_dev: number;
  /** D 至 SSS+ 各评级数量 */
  dist: number[];
  /** 未 FC、FC、FC+、AP、AP+ 各完成度数量 */
  fc_dist: number[];
}

/**
 * 水鱼 `/chart_stats` 的结构化结果。
 *
 * `charts` 以曲目 id 为键，数组下标为难度索引。上游用空对象表示没有统计的谱面，
 * 这里统一映射为 `null`，调用方无需检查空对象。
 */
export interface DivingFishChartStats {
  /** 曲目 id → 各难度谱面统计 */
  charts: Record<string, Array<DivingFishChartStat | null>>;
  /** 等级文案 → 全站汇总统计 */
  diff_data: Record<string, DivingFishDifficultyStats>;
}

/**
 * 校验并整理水鱼 `/chart_stats` 响应。
 *
 * @param value - 未知的上游 JSON
 * @returns 空谱面位置已转为 `null` 的统计结果
 * @throws {DivingFishDatabaseError} 响应结构不符合公开接口
 */
export function mapDivingFishChartStats(value: unknown): DivingFishChartStats {
  const parsed = parseDivingFishResponse(divingFishChartStatsSchema, value, "chart_stats");

  const charts: DivingFishChartStats["charts"] = {};
  for (const [songId, entries] of Object.entries(parsed.charts)) {
    charts[songId] = entries.map((entry) => (isEmptyChartStat(entry) ? null : entry));
  }

  return { charts, diff_data: parsed.diff_data };
}

function isEmptyChartStat(
  value: Record<string, never> | DivingFishChartStat,
): value is Record<string, never> {
  return Object.keys(value).length === 0;
}
