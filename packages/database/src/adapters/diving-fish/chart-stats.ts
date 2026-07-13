import { DivingFishDatabaseError } from "./error";

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
  /** 难度索引 */
  diff: number;
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
  /** 难度索引 → 全站汇总统计 */
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
  if (!isRecord(value) || !isRecord(value.charts) || !isRecord(value.diff_data)) {
    throw malformed();
  }

  const charts: DivingFishChartStats["charts"] = {};
  for (const [songId, entries] of Object.entries(value.charts)) {
    if (!Array.isArray(entries)) throw malformed();
    charts[songId] = entries.map((entry) => {
      if (isRecord(entry) && Object.keys(entry).length === 0) return null;
      if (!isChartStat(entry)) throw malformed();
      return entry;
    });
  }

  const diffData: DivingFishChartStats["diff_data"] = {};
  for (const [difficulty, entry] of Object.entries(value.diff_data)) {
    if (!isDifficultyStats(entry)) throw malformed();
    diffData[difficulty] = entry;
  }

  return { charts, diff_data: diffData };
}

function isChartStat(value: unknown): value is DivingFishChartStat {
  return (
    isRecord(value) &&
    isFiniteNumber(value.cnt) &&
    isFiniteNumber(value.diff) &&
    isFiniteNumber(value.fit_diff) &&
    isFiniteNumber(value.avg) &&
    isFiniteNumber(value.avg_dx) &&
    isFiniteNumber(value.std_dev) &&
    isNumberArray(value.dist) &&
    isNumberArray(value.fc_dist)
  );
}

function isDifficultyStats(value: unknown): value is DivingFishDifficultyStats {
  return (
    isRecord(value) &&
    isFiniteNumber(value.achievements) &&
    isNumberArray(value.dist) &&
    isNumberArray(value.fc_dist)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function malformed(): DivingFishDatabaseError {
  return new DivingFishDatabaseError({
    message: "Diving-Fish chart_stats: unexpected response structure",
  });
}
