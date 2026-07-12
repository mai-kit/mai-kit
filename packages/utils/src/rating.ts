import { normalizeAchievement } from "./achievement";

const DX_RATING_COEFFICIENTS = [
  { minimum: 100.5, coefficient: 22.4 },
  { minimum: 100, coefficient: 21.6 },
  { minimum: 99.5, coefficient: 21.1 },
  { minimum: 99, coefficient: 20.8 },
  { minimum: 98, coefficient: 20.3 },
  { minimum: 97, coefficient: 20 },
  { minimum: 94, coefficient: 16.8 },
  { minimum: 90, coefficient: 15.2 },
  { minimum: 80, coefficient: 13.6 },
  { minimum: 75, coefficient: 12 },
  { minimum: 70, coefficient: 11.2 },
  { minimum: 60, coefficient: 9.6 },
  { minimum: 50, coefficient: 8 },
  { minimum: 40, coefficient: 6.4 },
  { minimum: 30, coefficient: 4.8 },
  { minimum: 20, coefficient: 3.2 },
  { minimum: 10, coefficient: 1.6 },
] as const;

/**
 * 按达成率取单曲 DX Rating 系数（官方分段表）。
 *
 * @param achievement - 达成率：百分数或万分位（内部 {@link normalizeAchievement}）
 * @returns 系数；低于 10% 时为 `0`
 * @throws {RangeError} 达成率非法（同 {@link calculateDxRating}）
 *
 * @example
 * ```ts
 * dxRatingCoefficient(100.5); // 22.4
 * dxRatingCoefficient(99.5); // 21.1
 * ```
 */
export function dxRatingCoefficient(achievement: number): number {
  const normalized = validAchievement(achievement);
  return DX_RATING_COEFFICIENTS.find(({ minimum }) => normalized >= minimum)?.coefficient ?? 0;
}

/**
 * 计算游戏内展示用的单曲 DX Rating（向下取整）。
 *
 * 公式概要：`floor(定数 × 系数 × min(达成率, 100.5) / 100)`。
 *
 * @param levelValue - 精确定数，如 `14.7`
 * @param achievement - 达成率：百分数或万分位
 * @returns 非负整数 Rating
 * @throws {RangeError} `levelValue` 非法，或达成率不在 0–101%
 *
 * @example
 * ```ts
 * calculateDxRating(14.5, 100.5);
 * ```
 */
export function calculateDxRating(levelValue: number, achievement: number): number {
  assertNonNegativeFinite("levelValue", levelValue);
  const normalized = validAchievement(achievement);
  const raw = levelValue * dxRatingCoefficient(normalized) * (Math.min(normalized, 100.5) / 100);
  return Math.floor(raw + 1e-9);
}

/**
 * 反推达到目标单曲 Rating 所需的最低定数，向上取整到 0.1。
 *
 * @param targetRating - 目标单曲 Rating（非负）
 * @param achievement - 当前/假设达成率（百分数或万分位）
 * @returns 最低定数；系数为 0 且 `targetRating > 0` 时为 `undefined`；目标为 0 时返回 `0`
 * @throws {RangeError} 参数非法
 *
 * @example
 * ```ts
 * requiredLevelValue(315, 100.5); // 14
 * requiredLevelValue(1, 9); // undefined
 * ```
 */
export function requiredLevelValue(targetRating: number, achievement: number): number | undefined {
  assertNonNegativeFinite("targetRating", targetRating);
  if (targetRating === 0) return 0;
  const normalized = validAchievement(achievement);
  const perLevel = dxRatingCoefficient(normalized) * (Math.min(normalized, 100.5) / 100);
  if (perLevel === 0) return undefined;
  return Math.ceil((targetRating / perLevel) * 10) / 10;
}

function validAchievement(value: number): number {
  const normalized = normalizeAchievement(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 101) {
    throw new RangeError("achievement must be between 0 and 101 percent");
  }
  return normalized;
}

function assertNonNegativeFinite(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}
