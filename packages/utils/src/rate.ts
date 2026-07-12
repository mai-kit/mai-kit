import type { RateType } from "@mai-kit/shared";
import { normalizeAchievement } from "./achievement";

const RATE_THRESHOLDS = [
  { rate: "sssp", minimum: 100.5 },
  { rate: "sss", minimum: 100 },
  { rate: "ssp", minimum: 99.5 },
  { rate: "ss", minimum: 99 },
  { rate: "sp", minimum: 98 },
  { rate: "s", minimum: 97 },
  { rate: "aaa", minimum: 94 },
  { rate: "aa", minimum: 90 },
  { rate: "a", minimum: 80 },
  { rate: "bbb", minimum: 75 },
  { rate: "bb", minimum: 70 },
  { rate: "b", minimum: 60 },
  { rate: "c", minimum: 50 },
  { rate: "d", minimum: 0 },
] as const satisfies readonly { rate: RateType; minimum: number }[];

/**
 * 由达成率推导评级码（`sssp` … `d`）。
 *
 * @param achievement - 达成率：百分数（如 `100.5`）或万分位（如 `1005000`）
 * @returns 评级码，见 `@mai-kit/shared` 的 {@link RateType}
 * @throws {RangeError} 归一化后不在 `[0, 101]` 百分数区间
 *
 * @example
 * ```ts
 * rateFromAchievement(100.5);     // "sssp"
 * rateFromAchievement(1_000_000); // "sss"
 * ```
 */
export function rateFromAchievement(achievement: number): RateType {
  const normalized = normalizeAchievement(achievement);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 101) {
    throw new RangeError("achievement must be between 0 and 101 percent");
  }
  return RATE_THRESHOLDS.find(({ minimum }) => normalized >= minimum)!.rate;
}

/**
 * 某评级档的最低达成率（百分数）。
 *
 * @param rate - 评级码
 * @returns 该档最低达成率，如 `"sss"` → `100`
 *
 * @example
 * ```ts
 * minimumAchievementForRate("sss"); // 100
 * minimumAchievementForRate("sssp"); // 100.5
 * ```
 */
export function minimumAchievementForRate(rate: RateType): number {
  return RATE_THRESHOLDS.find((threshold) => threshold.rate === rate)!.minimum;
}
