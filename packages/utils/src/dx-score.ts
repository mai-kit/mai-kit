/**
 * DX 分数相关纯函数（与「单曲 Rating」无关）。
 *
 * 规则：Critical Perfect = 3 分 / note → 满分 = `notes.total × 3`。
 */

/**
 * 由谱面物量 `total` 得到 DX 满分。
 *
 * @param total - 谱面 Note 总数（`notes.total`）
 * @returns DX 满分（`floor(total) * 3`）
 *
 * @example
 * ```ts
 * dxMaxFromNoteTotal(761); // 2283
 * ```
 */
export function dxMaxFromNoteTotal(total: number): number {
  return Math.floor(total) * 3;
}

/** DX 分数星级 0–5（与游戏内档位一致） */
export type DxStar = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * DX 分相对满分的百分比。
 *
 * @param dxScore - 当前 DX 分（0…dxMax）
 * @param dxMax - DX 满分（须为正有限数）
 * @returns `(dxScore / dxMax) * 100`
 * @throws {RangeError} `dxMax` 非正有限，或 `dxScore` 超出 `[0, dxMax]`
 *
 * @example
 * ```ts
 * dxScorePercentage(1_593, 1_722); // 92.50871080139373
 * ```
 */
export function dxScorePercentage(dxScore: number, dxMax: number): number {
  assertDxScore(dxScore, dxMax);
  return (dxScore / dxMax) * 100;
}

/**
 * 由 DX 分与满分推导 0–5 星。
 *
 * 档位：≥97%→5，≥95%→4，≥93%→3，≥90%→2，≥85%→1，否则 0。
 *
 * @param dxScore - 当前 DX 分
 * @param dxMax - DX 满分
 * @returns 星级 0–5
 * @throws {RangeError} 同 {@link dxScorePercentage}
 *
 * @example
 * ```ts
 * dxStarFromScore(1_593, 1_722); // 2
 * dxStarFromScore(970, 1_000); // 5
 * ```
 */
export function dxStarFromScore(dxScore: number, dxMax: number): DxStar {
  const percentage = dxScorePercentage(dxScore, dxMax);
  if (percentage >= 97) return 5;
  if (percentage >= 95) return 4;
  if (percentage >= 93) return 3;
  if (percentage >= 90) return 2;
  if (percentage >= 85) return 1;
  return 0;
}

function assertDxScore(dxScore: number, dxMax: number): void {
  if (!Number.isFinite(dxMax) || dxMax <= 0) {
    throw new RangeError("dxMax must be a positive finite number");
  }
  if (!Number.isFinite(dxScore) || dxScore < 0 || dxScore > dxMax) {
    throw new RangeError("dxScore must be between 0 and dxMax");
  }
}
