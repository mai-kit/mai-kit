/**
 * `@mai-kit/analysis` 提供玩家成绩取得后的纯分析能力：重算 Best50、评估升分候选、
 * 比较两份 B50 快照。包内不请求查分器或曲目 API，输入由 `@mai-kit/prober` 与
 * `@mai-kit/database` 等调用方准备。
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
 * @example 查找升分候选
 * ```ts
 * import { rankUpgradeCandidates } from "@mai-kit/analysis";
 *
 * const candidates = rankUpgradeCandidates(scoresWithLevelValue, 100.5, 10);
 * ```
 */

export { recalculateBests } from "./bests";
export { compareBests } from "./compare";
export { analyzeScoreUpgrade, rankUpgradeCandidates } from "./upgrades";
export type {
  BestsChartChange,
  BestsComparison,
  BestsEntry,
  RatedScore,
  ScoreUpgrade,
  ScoreWithLevelValue,
} from "./models";
