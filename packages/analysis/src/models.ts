import type { RateType, Score } from "@mai-kit/prober";

/** 含单曲 Rating 的成绩；用于需要精确比较 Rating 的分析。 */
export interface RatedScore extends Score {
  /** 单曲 Rating。 */
  dx_rating: number;
}

/** 带精确定数的成绩输入。 */
export interface ScoreWithLevelValue {
  /** 待分析成绩。 */
  score: Score;
  /** 谱面精确定数，如 `14.7`。 */
  levelValue: number;
}

/** 单张谱面提升到目标达成率后的结果。 */
export interface ScoreUpgrade {
  /** 原成绩。 */
  score: Score;
  /** 计算使用的精确定数。 */
  levelValue: number;
  /** 当前达成率对应的 Rating。 */
  currentRating: number;
  /** 目标达成率（百分数）。 */
  targetAchievement: number;
  /**
   * 目标达成率对应的评级码（`sssp` … `d`）。
   * 由 `rateFromAchievement(targetAchievement)` 得到，便于展示「目标 SSS+」。
   */
  targetRate: RateType;
  /** 目标达成率对应的 Rating。 */
  targetRating: number;
  /**
   * 增量含义取决于产出函数：
   * - {@link analyzeScoreUpgrade} / {@link rankUpgradeCandidates}：单曲 Rating 增量
   * - {@link rankBestsUpgradeCandidates}：**B50（B15+B35）总分**增量
   */
  gain: number;
}

/** B50 中的一张谱面及其分区和名次。 */
export interface BestsEntry {
  /** 谱面成绩。 */
  score: RatedScore;
  /** 新曲 B15 或旧曲 B35。 */
  section: "dx" | "standard";
  /** 分区内从 1 开始的名次。 */
  rank: number;
}

/** 两份 B50 中同一谱面的变化。 */
export interface BestsChartChange {
  /** 稳定谱面键：`songId:type:levelIndex`。 */
  key: string;
  /** 旧快照条目；新进入 B50 时不存在。 */
  previous?: BestsEntry;
  /** 新快照条目；掉出 B50 时不存在。 */
  current?: BestsEntry;
  /** 单曲 Rating 差值。 */
  ratingDelta: number;
  /** 达成率差值。 */
  achievementDelta: number;
}

/** 两份 B50 快照的比较结果。 */
export interface BestsComparison {
  /** 新进入 B50 的谱面。 */
  entered: BestsChartChange[];
  /** Rating 提升，或 Rating 相同但达成率提升的谱面。 */
  improved: BestsChartChange[];
  /** Rating 下降，或 Rating 相同但达成率下降的谱面。 */
  regressed: BestsChartChange[];
  /** 掉出 B50 的谱面。 */
  dropped: BestsChartChange[];
  /** 两次快照中数值均未变化的谱面数。 */
  unchangedCount: number;
  /** 旧 B50 Rating 合计。 */
  previousTotal: number;
  /** 新 B50 Rating 合计。 */
  currentTotal: number;
  /** B50 Rating 合计变化。 */
  totalDelta: number;
}
