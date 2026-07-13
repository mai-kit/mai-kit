/**
 * `@mai-kit/analysis` 提供玩家成绩取得后的纯分析能力：重算 Best50、评估升分候选、
 * 比较两份 B50 快照、汇总 Rating 构成与里程碑缺口。包内不请求查分器或曲目 API，
 * 输入由 `@mai-kit/prober` 与 `@mai-kit/database` 等调用方准备。
 *
 * @packageDocumentation
 *
 * @example 重算 Best50
 * ```ts
 * import { recalculateBests } from "@mai-kit/analysis";
 *
 * const bests = recalculateBests(scores, (score) => newSongIds.has(score.id));
 * ```
 *
 * @example 查找能抬 B15/B35 的加分候选（全曲 + 真实 B50 地板）
 * ```ts
 * import { rankBestsUpgradeCandidates } from "@mai-kit/analysis";
 *
 * // 目标至少 SSS+（评级下限）；也可只传 targetAchievement: 100.5
 * const candidates = rankBestsUpgradeCandidates(entries, {
 *   currentBests: bests,
 *   isNewSong,
 *   minRate: "sssp",
 *   limit: 10,
 * });
 * ```
 *
 * @example Rating 构成与整千缺口
 * ```ts
 * import { summarizeBestsRating, ratingGapToNextThousand } from "@mai-kit/analysis";
 *
 * const summary = summarizeBestsRating(bests);
 * const gap = ratingGapToNextThousand(summary.total);
 * ```
 */

export { recalculateBests } from "./bests";
export { compareBests } from "./compare";
export { ratingGapToNextThousand, ratingGapToTarget, summarizeBestsRating } from "./summary";
export type { BestsRatingSummary, RatingMilestoneGap } from "./summary";
export {
  analyzeScoreUpgrade,
  rankBestsUpgradeCandidates,
  rankUpgradeCandidates,
  resolveUpgradeTarget,
} from "./upgrades";
export type { RankBestsUpgradeOptions, RankUpgradeOptions } from "./upgrades";
export type {
  BestsChartChange,
  BestsComparison,
  BestsEntry,
  RatedScore,
  ScoreUpgrade,
  ScoreWithLevelValue,
} from "./models";
