/**
 * maimai 玩家数据模型（prober 包专属）。
 *
 * 领域原语已上提到 @mai-kit/shared，此处导入并再导出。
 */
import { LevelIndex } from "@mai-kit/shared";
import type {
  Collection,
  CollectionRequired,
  CollectionRequiredSong,
  CollectionType,
  FCType,
  FSType,
  RateType,
  SongType,
} from "@mai-kit/shared";

/** @internal 领域原语文档见 `@mai-kit/shared`；此处再导出仅便于类型拼装 */
export { LevelIndex };
/** @internal 领域原语文档见 `@mai-kit/shared` */
export type {
  Collection,
  CollectionRequired,
  CollectionRequiredSong,
  CollectionType,
  FCType,
  FSType,
  RateType,
  SongType,
};

/**
 * 玩家当前装备的收藏品信息。
 *
 * 部分查分源只返回展示名称，不能提供收藏品 id；这与 database 中可按 id 查询的完整
 * [Collection](/api/@mai-kit/shared/interfaces/Collection) 不同，因此 `id` 在玩家档案中是可选的。
 */
export interface PlayerCollection extends Omit<Collection, "id"> {
  /** 收藏品 id；数据源未提供时省略 */
  id?: number;
}

/**
 * 玩家档案（与具体查分服务无关的通用模型）。
 * 字段语义对齐常见查分器约定；可直接交给 `@mai-kit/draw` 的 `Draw.poster`。
 *
 * @example
 * ```ts
 * const profile: PlayerProfile = {
 *   name: "Amatsuka",
 *   rating: 15_000,
 *   friend_code: 1234567890,
 *   course_rank: 10,
 *   class_rank: 5,
 *   star: 2,
 * };
 * ```
 */
export interface PlayerProfile {
  /** 玩家昵称 */
  name: string;
  /** 展示用总 Rating */
  rating: number;
  /** 好友码；数据源提供时存在 */
  friend_code?: number;
  /** 课段位 id（含 0=初学者）；数据源提供时存在 */
  course_rank?: number;
  /** 阶级 id；数据源提供时存在 */
  class_rank?: number;
  /** 轮回星数；数据源提供时存在 */
  star?: number;
  /** 当前称号 */
  trophy?: PlayerCollection;
  /** 头像收藏品；draw 按 `icon.id` 拉图 */
  icon?: PlayerCollection;
  /** 当前姓名框 */
  name_plate?: PlayerCollection;
  /** 当前背景 */
  frame?: PlayerCollection;
  /** 成绩上传时间（ISO 等） */
  upload_time?: string;
}

/**
 * 单条成绩。
 *
 * - `achievements`：百分数或万分位整数（展示前用 `@mai-kit/utils` 的 `normalizeAchievement`）
 * - `dx_rating`：单曲 Rating（若源提供）
 * - 无 `dx_max`：满分由 draw 结合曲目物量注入，不在此模型中
 *
 * @example
 * ```ts
 * const score: Score = {
 *   id: 11451,
 *   song_name: "曲名",
 *   level: "14+",
 *   level_index: LevelIndex.MASTER,
 *   achievements: 100.5432,
 *   dx_score: 1_593,
 *   dx_rating: 315,
 *   rate: "sssp",
 *   fc: "ap",
 *   type: "dx",
 * };
 * ```
 */
export interface Score {
  /** 曲目 id */
  id: number;
  /** 曲名（数据源提供时） */
  song_name?: string;
  /** 等级文案，如 `14+` */
  level?: string;
  /** 难度下标 */
  level_index: LevelIndex;
  /** 达成率：百分数或万分位整数 */
  achievements: number;
  /** FULL COMBO 标记；无标记时为 `null` 或缺省 */
  fc?: FCType | null;
  /** FULL SYNC 标记；无标记时为 `null` 或缺省 */
  fs?: FSType | null;
  /** 当前 DX 分 */
  dx_score: number;
  /** DX 星级 0–5（数据源提供时） */
  dx_star?: number;
  /** 单曲 Rating（数据源提供时） */
  dx_rating?: number;
  /** 评级码 */
  rate?: RateType;
  /** 谱面类型 */
  type: SongType;
  /** 本次游玩时间 */
  play_time?: string;
  /** 成绩上传时间 */
  upload_time?: string;
  /** 最后游玩时间 */
  last_played_time?: string;
}

/** 不含达成率与 DX 分的精简成绩，用于仅需谱面与通关标记的列表。 */
export interface SimpleScore {
  id: number;
  song_name: string;
  level: string;
  level_index: LevelIndex;
  fc?: FCType | null;
  fs?: FSType | null;
  rate: RateType;
  type: SongType;
}

/**
 * Best50 结构。
 *
 * - `dx`：新曲侧（海报 B15 取前 15）
 * - `standard`：旧曲侧（海报 B35 取前 35）
 * - `*_total`：对应 rating 合计（源提供）
 *
 * @example
 * ```ts
 * const bests: Bests = {
 *   standard_total: 10_500,
 *   dx_total: 4_500,
 *   standard: oldScores,
 *   dx: newScores,
 *   standard_selections: [],
 *   dx_selections: [],
 * };
 * ```
 */
export interface Bests {
  /** 旧曲侧 Rating 合计 */
  standard_total: number;
  /** 新曲侧 Rating 合计 */
  dx_total: number;
  /** 旧曲 B35 */
  standard: Score[];
  /** 新曲 B15 */
  dx: Score[];
  /** 旧曲候选成绩（数据源提供时） */
  standard_selections: Score[];
  /** 新曲候选成绩（数据源提供时） */
  dx_selections: Score[];
}

/** 某一日或版本节点的 Rating 走势记录。 */
export interface RatingTrend {
  /** 总 Rating */
  total: number;
  /** 旧曲侧 Rating */
  standard_total: number;
  /** 新曲侧 Rating */
  dx_total: number;
  /** 数据源返回的日期字符串或时间戳 */
  date: string | number;
}

/** 出勤热力图：键为数据源的日期标识，值为当日游玩次数。 */
export type Heatmap = Record<string, number>;

/** 唯一定位一张谱面的组合键。 */
export interface ScoreKey {
  songId: number;
  songType: SongType;
  levelIndex: LevelIndex | number;
}

/**
 * 成绩列表的可选筛选条件。
 *
 * @example
 * ```ts
 * const query: ScoreQuery = {
 *   songId: 11451,
 *   songType: "dx",
 *   levelIndex: LevelIndex.MASTER,
 * };
 * const scores = await player.getScores(query);
 * ```
 */
export interface ScoreQuery {
  songId?: number;
  songType?: SongType;
  levelIndex?: LevelIndex | number;
}

/** 单谱面的历史成绩；数据源明确表示无记录时为 `null`。 */
export type ScoreHistory = Score[] | null;
