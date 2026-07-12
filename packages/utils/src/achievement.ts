/**
 * 达成率相关纯函数。
 *
 * 数据源可能给：
 * - 百分数：`100.8621`
 * - 万分位整数：`1008621`（÷10000 → 百分数）
 */

/**
 * 将达成率统一为百分数。
 *
 * 规则：`value > 1000` 时视为万分位并 `/ 10000`，否则原样返回。
 *
 * @param value - 原始达成率（百分数或万分位整数）
 * @returns 百分数形式的达成率（如 `100.5`）
 *
 * @example
 * ```ts
 * normalizeAchievement(100.5);      // 100.5
 * normalizeAchievement(1_005_000);  // 100.5
 * ```
 */
export function normalizeAchievement(value: number): number {
  return value > 1000 ? value / 10000 : value;
}
