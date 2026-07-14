import type { FCType, FSType, LevelIndex, SongType } from "@mai-kit/shared";

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

/** 水鱼 `/query/plate` 返回的按版本成绩（字段少于完整 {@link Score}）。 */
export interface DivingFishVersionScore {
  /** 曲目 id */
  id: number;
  /** 曲名 */
  song_name: string;
  /** 等级文案 */
  level: string;
  /** 难度索引 */
  level_index: LevelIndex;
  /** 谱面类型 */
  type: SongType;
  /** 达成率 */
  achievements: number;
  /** FC 标记 */
  fc: FCType | null;
  /** FS 标记 */
  fs: FSType | null;
}
