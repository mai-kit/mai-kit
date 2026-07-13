import type { Bests, Score } from "@mai-kit/prober";
import { scoreMapKey } from "@mai-kit/utils/song";
import type { BestsEntry, RatedScore } from "./models";

/**
 * B50 Rating 构成：新曲 B15 / 旧曲 B35 贡献与 tail（区底）。
 *
 * @category Rating 构成
 */
export interface BestsRatingSummary {
  /** 新曲区 Rating 合计（优先用分区内 `dx_rating` 重算；否则用 `dx_total`） */
  dxTotal: number;
  /** 旧曲区 Rating 合计 */
  standardTotal: number;
  /** B50 总 Rating */
  total: number;
  /** 新曲区成绩数 */
  dxCount: number;
  /** 旧曲区成绩数 */
  standardCount: number;
  /**
   * 新曲区占比 `dxTotal / total`；`total === 0` 时为 `0`。
   */
  dxShare: number;
  /**
   * 旧曲区占比 `standardTotal / total`；`total === 0` 时为 `0`。
   */
  standardShare: number;
  /**
   * 新曲区最低单曲 Rating（B15 tail）；区为空时为 `null`。
   * 再推一把新曲进 B15 至少要超过该值。
   */
  dxFloor: number | null;
  /**
   * 旧曲区最低单曲 Rating（B35 tail）；区为空时为 `null`。
   */
  standardFloor: number | null;
  /** 带分区与名次的 B50 条目（先 dx 后 standard） */
  entries: BestsEntry[];
}

/**
 * 汇总一份 B50 的 Rating 构成（分区合计、占比、区底）。
 *
 * 分区合计优先用各曲 `dx_rating` 求和；若某曲缺合法 Rating 则回退到
 * `bests.dx_total` / `standard_total`（该区）。区底始终要求该区成绩带合法 `dx_rating`。
 *
 * @param bests - Best50
 * @returns 构成摘要
 * @throws {RangeError} 求区底时存在非法 `dx_rating`
 *
 * @example
 * ```ts
 * const summary = summarizeBestsRating(bests);
 * console.log(summary.dxShare, summary.dxFloor);
 * ```
 *
 * @category Rating 构成
 */
export function summarizeBestsRating(bests: Bests): BestsRatingSummary {
  const dxEntries = toEntries(bests.dx, "dx");
  const standardEntries = toEntries(bests.standard, "standard");
  const dxTotal = sumSectionRating(bests.dx, bests.dx_total);
  const standardTotal = sumSectionRating(bests.standard, bests.standard_total);
  const total = dxTotal + standardTotal;

  return {
    dxTotal,
    standardTotal,
    total,
    dxCount: bests.dx.length,
    standardCount: bests.standard.length,
    dxShare: total === 0 ? 0 : dxTotal / total,
    standardShare: total === 0 ? 0 : standardTotal / total,
    dxFloor: sectionFloor(bests.dx),
    standardFloor: sectionFloor(bests.standard),
    entries: [...dxEntries, ...standardEntries],
  };
}

/**
 * Rating 里程碑缺口（如下一整千、或自定义目标）。
 *
 * @category Rating 构成
 */
export interface RatingMilestoneGap {
  /** 当前总 Rating */
  current: number;
  /** 目标 Rating（已规范化为整数目标） */
  target: number;
  /** 还需的 Rating；已达或超过目标时为 `0` */
  gap: number;
  /** 是否已达到或超过目标 */
  reached: boolean;
}

/**
 * 计算到**下一个整千**（如 15_823 → 16_000）还差多少 Rating。
 *
 * 已在整千点（如 16_000）时，目标为再下一档（17_000）。
 *
 * @param rating - 当前总 Rating（非负有限数）
 * @returns 缺口
 * @throws {RangeError} `rating` 非法
 *
 * @example
 * ```ts
 * ratingGapToNextThousand(15_823);
 * // → { current: 15823, target: 16000, gap: 177, reached: false }
 * ```
 *
 * @category Rating 构成
 */
export function ratingGapToNextThousand(rating: number): RatingMilestoneGap {
  assertFiniteNonNegative(rating, "rating");
  const current = Math.floor(rating);
  const target = (Math.floor(current / 1000) + 1) * 1000;
  return gapResult(current, target);
}

/**
 * 计算到指定目标 Rating 的缺口。
 *
 * @param rating - 当前总 Rating
 * @param target - 目标 Rating（须 ≥ 0）
 * @returns 缺口
 * @throws {RangeError} 参数非法
 *
 * @example
 * ```ts
 * ratingGapToTarget(15_823, 16_000).gap; // 177
 * ```
 *
 * @category Rating 构成
 */
export function ratingGapToTarget(rating: number, target: number): RatingMilestoneGap {
  assertFiniteNonNegative(rating, "rating");
  assertFiniteNonNegative(target, "target");
  return gapResult(Math.floor(rating), Math.floor(target));
}

function gapResult(current: number, target: number): RatingMilestoneGap {
  const gap = Math.max(0, target - current);
  return { current, target, gap, reached: gap === 0 };
}

function sumSectionRating(scores: readonly Score[], fallbackTotal: number): number {
  if (scores.length === 0) return 0;
  let sum = 0;
  for (const score of scores) {
    if (score.dx_rating === undefined || !Number.isFinite(score.dx_rating) || score.dx_rating < 0) {
      return fallbackTotal;
    }
    sum += score.dx_rating;
  }
  return sum;
}

function sectionFloor(scores: readonly Score[]): number | null {
  if (scores.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const score of scores) {
    assertRated(score);
    if (score.dx_rating < min) min = score.dx_rating;
  }
  return min;
}

function toEntries(scores: readonly Score[], section: "dx" | "standard"): BestsEntry[] {
  return scores.map((score, index) => {
    assertRated(score);
    return {
      score,
      section,
      rank: index + 1,
    };
  });
}

function assertRated(score: Score): asserts score is RatedScore {
  if (score.dx_rating === undefined || !Number.isFinite(score.dx_rating) || score.dx_rating < 0) {
    throw new RangeError(
      `Score ${scoreMapKey(score)} must have a non-negative finite dx_rating for rating summary`,
    );
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}
