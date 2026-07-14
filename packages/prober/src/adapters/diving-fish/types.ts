/**
 * 查询目标：用户名或 QQ 二选一。
 *
 * @example
 * ```ts
 * { username: "someone" }
 * { qq: 123456789 }
 * ```
 */
export type DivingFishPlayerQuery =
  | { username: string; qq?: never }
  | { qq: string | number; username?: never };

/** 水鱼公开 Rating 排行中的一名玩家。 */
export interface DivingFishRatingRankEntry {
  /** 水鱼用户名 */
  username: string;
  /** Rating */
  ra: number;
}
