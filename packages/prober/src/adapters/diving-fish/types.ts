import type { FCType, FSType, LevelIndex, SongType } from "@mai-kit/shared";

/**
 * Diving-Fish 单曲成绩（`/query/player` charts 项、`/player/records` records 项）。
 * 字段名与上游 JSON 一致，映射层再转成通用 {@link Score}。
 *
 * @example
 * ```ts
 * const record: DivingFishRecord = {
 *   achievements: 100.5432,
 *   ds: 14.7,
 *   dxScore: 1_593,
 *   fc: "ap",
 *   fs: "fs",
 *   level: "14+",
 *   level_index: 3,
 *   ra: 315,
 *   rate: "sssp",
 *   song_id: 11451,
 *   title: "曲名",
 *   type: "DX",
 * };
 * ```
 */
export interface DivingFishRecord {
  /** 达成率（百分数，如 100.5492） */
  achievements: number;
  /** 谱面定数 */
  ds: number;
  /** DX 分数 */
  dxScore: number;
  /** FC 标记原文（`fc`/`fcp`/`ap`/`app` 或空串） */
  fc: string;
  /** FS 标记原文（`sync`/`fs`/… 或空串） */
  fs: string;
  /** 等级文案（如 `14+`） */
  level: string;
  /** 难度索引 0–4（Basic–Re:Master） */
  level_index: number;
  /** 难度标签（如 `Master`） */
  level_label?: string;
  /** 单曲 Rating */
  ra: number;
  /** 评级原文（如 `sssp`） */
  rate: string;
  /** 曲目 id */
  song_id: number;
  /** 曲名 */
  title: string;
  /** 谱面类型原文：`DX` / `SD` */
  type: string;
}

/**
 * Diving-Fish 玩家载荷（完整成绩 / test_data / 公开 query 共用字段）。
 */
export interface DivingFishPlayerPayload {
  /** 段位码（0–22，对应初学者–里皆传） */
  additional_rating?: number;
  /** 展示昵称 */
  nickname?: string;
  /** 牌子文案（如 `煌将`） */
  plate?: string;
  /** 总 Rating */
  rating: number;
  /** 账号用户名 */
  username?: string;
  /** 完整成绩列表（records 接口） */
  records?: DivingFishRecord[];
  /**
   * 公开 query 的 B50 拆分：
   * - `dx`：新曲 B15
   * - `sd`：旧曲 B35
   */
  charts?: {
    /** 新曲 B15 成绩 */
    dx?: DivingFishRecord[];
    /** 旧曲 B35 成绩 */
    sd?: DivingFishRecord[];
  };
  /** 上游保留字段，无业务用途 */
  user_general_data?: unknown;
}

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

/** @internal 水鱼 `/query/plate` 原始成绩。 */
export interface DivingFishVersionRecord {
  id: number;
  title: string;
  level: string;
  level_index: number;
  type: string;
  achievements: number;
  fc: string;
  fs: string;
}
