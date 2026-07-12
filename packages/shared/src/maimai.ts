/**
 * maimai 领域原语（跨包共享，避免类型漂移）。
 * database / prober 等会再导出，用户也可直接从 `@mai-kit/shared` 引用。
 */

/** 谱面类型：标准 / DX / 宴会场 */
export type SongType = "standard" | "dx" | "utage";

/**
 * 难度索引（与多数 API 的 `level_index` / `difficulty` 字段一致）。
 * @example LevelIndex.MASTER // 3
 */
export enum LevelIndex {
  BASIC = 0,
  ADVANCED = 1,
  EXPERT = 2,
  MASTER = 3,
  RE_MASTER = 4,
}

/**
 * FULL COMBO 标记码。
 * - `app` AP+ / `ap` AP / `fcp` FC+ / `fc` FC
 */
export type FCType = "app" | "ap" | "fcp" | "fc";

/**
 * FULL SYNC 等标记码。
 * - `fsdp` FSD+ / `fsd` FSD / `fsp` FS+ / `fs` FS / `sync` SYNC
 */
export type FSType = "fsdp" | "fsd" | "fsp" | "fs" | "sync";

/**
 * 评级码（从高到低：sssp … d）。
 * 展示文案由渲染层或业务自行映射（如 sssp → SSS+）。
 */
export type RateType =
  | "sssp"
  | "sss"
  | "ssp"
  | "ss"
  | "sp"
  | "s"
  | "aaa"
  | "aa"
  | "a"
  | "bbb"
  | "bb"
  | "b"
  | "c"
  | "d";

/** 收藏品类型 */
export type CollectionType = "trophy" | "icon" | "plate" | "frame";

/** 收藏品达成要求的曲目 */
export interface CollectionRequiredSong {
  id: number;
  title: string;
  type: SongType;
  completed?: boolean;
  completed_difficulties?: LevelIndex[];
}

/** 收藏品达成要求 */
export interface CollectionRequired {
  difficulties?: LevelIndex[];
  rate?: RateType;
  fc?: FCType;
  fs?: FSType;
  songs?: CollectionRequiredSong[];
  completed?: boolean;
}

/**
 * 收藏品（也用于玩家装备的称号 / 头像 / 姓名框 / 背景）。
 *
 * @example
 * ```ts
 * const icon: Collection = {
 *   id: 101,
 *   name: "示例头像",
 *   genre: "イベント",
 *   required: [{ rate: "sssp", songs: [{ id: 114, title: "曲名", type: "dx" }] }],
 * };
 * ```
 */
export interface Collection {
  id: number;
  name: string;
  color?: string;
  description?: string;
  genre?: string;
  required?: CollectionRequired[];
}
