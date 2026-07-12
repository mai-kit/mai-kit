import { calculateDxRating, normalizeAchievement } from "@mai-kit/utils";
import type { ScoreUpgrade, ScoreWithLevelValue } from "./models";

/**
 * 计算一张谱面提升到目标达成率后的单曲 Rating 增量。
 *
 * 当前与目标 Rating 都按传入定数重新计算，不依赖数据源可能过期的 `dx_rating`。
 *
 * @param entry - 成绩与精确定数
 * @param targetAchievement - 目标达成率（百分数或万分位）
 * @returns 当前值、目标值和增量
 * @throws {RangeError} 目标低于当前达成率，或参数不合法
 *
 * @example
 * ```ts
 * const upgrade = analyzeScoreUpgrade({ score, levelValue: 14.7 }, 100.5);
 * console.log(upgrade.gain);
 * ```
 */
export function analyzeScoreUpgrade(
  entry: ScoreWithLevelValue,
  targetAchievement: number,
): ScoreUpgrade {
  const currentAchievement = normalizeAchievement(entry.score.achievements);
  const normalizedTarget = normalizeAchievement(targetAchievement);
  if (normalizedTarget < currentAchievement) {
    throw new RangeError("targetAchievement must not be lower than the current achievement");
  }

  const currentRating = calculateDxRating(entry.levelValue, currentAchievement);
  const targetRating = calculateDxRating(entry.levelValue, normalizedTarget);
  return {
    score: entry.score,
    levelValue: entry.levelValue,
    currentRating,
    targetAchievement: normalizedTarget,
    targetRating,
    gain: targetRating - currentRating,
  };
}

/**
 * 按单曲 Rating 增量排列升分候选。
 *
 * 已达到目标或提升后 Rating 不变的谱面不会进入结果。相同增量时，优先目标 Rating
 * 更高、当前达成率更低的谱面。
 *
 * @param entries - 成绩与精确定数列表
 * @param targetAchievement - 所有候选统一使用的目标达成率
 * @param limit - 最多返回数量；省略时返回全部
 * @returns 按预期 Rating 增量降序排列的候选
 * @throws {RangeError} `limit` 不是非负整数，或输入参数不合法
 *
 * @example
 * ```ts
 * const candidates = rankUpgradeCandidates(entries, 100.5, 10);
 * console.log(candidates[0]?.score.song_name, candidates[0]?.gain);
 * ```
 */
export function rankUpgradeCandidates(
  entries: readonly ScoreWithLevelValue[],
  targetAchievement: number,
  limit?: number,
): ScoreUpgrade[] {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("limit must be a non-negative integer");
  }
  const target = normalizeAchievement(targetAchievement);
  const upgrades = entries
    .filter((entry) => normalizeAchievement(entry.score.achievements) < target)
    .map((entry) => analyzeScoreUpgrade(entry, target))
    .filter((upgrade) => upgrade.gain > 0)
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        b.targetRating - a.targetRating ||
        normalizeAchievement(a.score.achievements) - normalizeAchievement(b.score.achievements),
    );
  return limit === undefined ? upgrades : upgrades.slice(0, limit);
}
