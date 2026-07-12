/**
 * 定数 / 等级字符串解析。
 */

/**
 * 将 level 文案解析为近似定数。
 *
 * - `"14"` → `14`
 * - `"14+"` → `14.7`（`+` 按 +0.7 近似，非官方精确定数）
 *
 * @param level - 等级字符串（如 prober `Score.level`）；空或缺省无法解析
 * @returns 近似定数；无法解析时为 `undefined`（由调用方决定缺失策略）
 *
 * @example
 * ```ts
 * parseLevelString("14+"); // 14.7
 * parseLevelString("13");  // 13
 * parseLevelString();      // undefined
 * ```
 */
export function parseLevelString(level?: string): number | undefined {
  if (!level) return undefined;
  const match = level.match(/(\d+(?:\.\d+)?)(\+?)/);
  if (!match) return undefined;
  return Number(match[1]) + (match[2] === "+" ? 0.7 : 0);
}
