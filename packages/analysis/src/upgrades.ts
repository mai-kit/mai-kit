import type { Bests, RateType, Score } from "@mai-kit/prober";
import {
  calculateDxRating,
  minimumAchievementForRate,
  normalizeAchievement,
  rateFromAchievement,
} from "@mai-kit/utils";
import { scoreMapKey } from "@mai-kit/utils/song";
import type { ScoreUpgrade, ScoreWithLevelValue } from "./models";

/**
 * 解析「目标达成率」：可用评级下限、显式达成率，或两者取较高。
 *
 * - `minRate: "sss"` → 目标至少 SSS 档下限（100%）
 * - 省略 `minRate` → 不按评级限制，须提供 `targetAchievement`
 * - 两者都给 → 取较大达成率（可在 SSS 下限上再抬到 100.5）
 */
export function resolveUpgradeTarget(options: {
  minRate?: RateType;
  targetAchievement?: number;
}): number {
  const fromRate =
    options.minRate === undefined ? undefined : minimumAchievementForRate(options.minRate);
  const fromAchievement =
    options.targetAchievement === undefined
      ? undefined
      : normalizeAchievement(options.targetAchievement);

  if (fromRate === undefined && fromAchievement === undefined) {
    throw new RangeError("minRate or targetAchievement is required");
  }
  if (fromRate === undefined) return fromAchievement!;
  if (fromAchievement === undefined) return fromRate;
  return Math.max(fromRate, fromAchievement);
}

/**
 * 计算一张谱面提升到目标达成率后的**单曲** Rating 增量。
 *
 * 这是底层公式，**不等于** B50 总分增量。评估「刷哪首对 B15/B35 有帮助」请用
 * {@link rankBestsUpgradeCandidates}。
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
    targetRate: rateFromAchievement(normalizedTarget),
    targetRating,
    gain: targetRating - currentRating,
  };
}

/**
 * {@link rankUpgradeCandidates} 的选项。
 */
export interface RankUpgradeOptions {
  /**
   * 最低目标评级。如 `"sss"` 表示目标至少 SSS（达成率 ≥ 100%），
   * 只评估当前尚未达到该目标的谱面。
   * 省略则不按评级设目标，此时须提供 {@link targetAchievement}。
   */
  minRate?: RateType;
  /**
   * 目标达成率（百分数或万分位）。可与 `minRate` 同用，取较高者。
   * 单独使用时表示不按评级档限制、直接指定目标线。
   */
  targetAchievement?: number;
  /** 最多返回条数 */
  limit?: number;
}

/**
 * 按**单曲** Rating 增量排列候选（不考虑 B15/B35）。
 *
 * 加分推荐请用 {@link rankBestsUpgradeCandidates}。
 */
export function rankUpgradeCandidates(
  entries: readonly ScoreWithLevelValue[],
  options: RankUpgradeOptions,
): ScoreUpgrade[] {
  const { limit } = options;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("limit must be a non-negative integer");
  }
  const target = resolveUpgradeTarget(options);
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

/**
 * {@link rankBestsUpgradeCandidates} 的选项。
 */
export interface RankBestsUpgradeOptions {
  /**
   * 玩家**当前真实 B50**（查分器返回的 bests）。
   * 地板与是否在榜以此为准，不用本地重算一遍 B50。
   */
  currentBests: Bests;
  /**
   * 谱面是否属于**新曲池**（进 B15 还是 B35）。
   * 仅对「当前不在 B50 里」的谱面用来选地板；已在 `currentBests.dx` / `standard` 里的以 bests 为准。
   */
  isNewSong: (score: Score) => boolean;
  /**
   * 最低目标评级。如 `"sss"` → 目标至少 SSS 档（达成率 ≥ 100%），
   * 只看「刷到该档及以上」对 B50 的增量。
   * 省略则不按评级限制，此时须提供 {@link targetAchievement}。
   */
  minRate?: RateType;
  /**
   * 目标达成率（百分数或万分位）。可与 `minRate` 同用，取较高者。
   * 单独使用时表示直接指定目标线（不绑定评级档）。
   */
  targetAchievement?: number;
  /** 最多返回条数 */
  limit?: number;
}

/**
 * 在全曲成绩中，找出刷到目标达成率后**能抬高 B15 或 B35 总分**的谱面。
 *
 * ## 目标怎么定
 *
 * - `minRate: "sss"`：目标取 SSS 最低线（100%），结果都是「冲到至少 SSS」
 * - `targetAchievement: 100.5`：直接指定达成率（如 SSS+ 线）
 * - 两者都给：取较高达成率
 * - 都省略：抛错（无法定义目标）
 *
 * ## B50 机制（本函数实现的口径）
 *
 * - B50 = 新曲池最高 15 首（B15）+ 旧曲池最高 35 首（B35）的单曲 Rating 之和
 * - 单曲 Rating = f(定数, 达成率)
 * - **已在对应池榜内**：抬达成率 → B50 增量 = 新单曲 Rating − **当前单曲 Rating**
 *   （当前 Rating 优先用成绩上的 `dx_rating`，与查分器 B50 一致）
 * - **不在榜内**：仅当目标单曲 Rating **严格大于** 该池地板（B15 第 15 / B35 第 35）
 *   才能挤进榜；B50 增量 = 目标 Rating − **地板 Rating**
 * - 目标 Rating ≤ 地板 → 对 B50 无贡献，不入选
 *
 * 因此不会出现「低定数 0%→100.5% 单曲 +200 却进不了榜」仍排在前面的情况。
 */
export function rankBestsUpgradeCandidates(
  entries: readonly ScoreWithLevelValue[],
  options: RankBestsUpgradeOptions,
): ScoreUpgrade[] {
  const { currentBests, isNewSong, limit } = options;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("limit must be a non-negative integer");
  }
  if (entries.length === 0) return [];

  const target = resolveUpgradeTarget(options);
  const targetRate = rateFromAchievement(target);
  const { dxFloor, standardFloor, inDx, inStandard } = bestsContext(currentBests);

  const upgrades: ScoreUpgrade[] = [];

  for (const entry of entries) {
    const currentAchievement = normalizeAchievement(entry.score.achievements);
    if (currentAchievement >= target) continue;

    const targetRating = calculateDxRating(entry.levelValue, target);
    // 与 B50 对齐：有服务端单曲分用服务端的
    const formulaCurrent = calculateDxRating(entry.levelValue, currentAchievement);
    const currentRating =
      entry.score.dx_rating != null && Number.isFinite(entry.score.dx_rating)
        ? entry.score.dx_rating
        : formulaCurrent;

    if (targetRating <= currentRating) continue;

    const key = scoreMapKey(entry.score);
    const inDxBest = inDx.has(key);
    const inStdBest = inStandard.has(key);
    const inBests = inDxBest || inStdBest;

    // 在榜：以 bests 分区为准；不在榜：用 isNewSong 决定打哪边地板
    const floor = inDxBest
      ? dxFloor
      : inStdBest
        ? standardFloor
        : isNewSong(entry.score)
          ? dxFloor
          : standardFloor;

    const bestsGain = inBests
      ? targetRating - currentRating
      : targetRating > floor
        ? targetRating - floor
        : 0;

    if (bestsGain <= 0) continue;

    upgrades.push({
      score: entry.score,
      levelValue: entry.levelValue,
      currentRating,
      targetAchievement: target,
      targetRate,
      targetRating,
      gain: bestsGain,
    });
  }

  upgrades.sort(
    (a, b) =>
      b.gain - a.gain ||
      b.targetRating - a.targetRating ||
      normalizeAchievement(a.score.achievements) - normalizeAchievement(b.score.achievements),
  );
  return limit === undefined ? upgrades : upgrades.slice(0, limit);
}

function bestsContext(bests: Bests): {
  dxFloor: number;
  standardFloor: number;
  inDx: Set<string>;
  inStandard: Set<string>;
} {
  const dxRatings = bests.dx.map(ratingOf);
  const stdRatings = bests.standard.map(ratingOf);
  // 未满员：地板为 0，任意正 Rating 都可进榜
  const dxFloor = bests.dx.length < 15 ? 0 : Math.min(...dxRatings);
  const standardFloor = bests.standard.length < 35 ? 0 : Math.min(...stdRatings);
  return {
    dxFloor,
    standardFloor,
    inDx: new Set(bests.dx.map((score) => scoreMapKey(score))),
    inStandard: new Set(bests.standard.map((score) => scoreMapKey(score))),
  };
}

function ratingOf(score: Score): number {
  if (score.dx_rating == null || !Number.isFinite(score.dx_rating)) {
    throw new RangeError(`Bests score ${score.id} must have a finite dx_rating`);
  }
  return score.dx_rating;
}
