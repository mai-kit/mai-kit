/**
 * maimai 游戏数据模型（database 包专属）。
 *
 * 领域原语（SongType / LevelIndex / FCType / FSType / RateType /
 * CollectionType / Collection 等）已上提到 @mai-kit/shared，此处导入并再导出。
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

/** 谱面物量 */
export interface Notes {
  total: number;
  tap: number;
  hold: number;
  slide: number;
  touch: number;
  break: number;
}

/** 宴会场 BUDDY 谱面物量 */
export interface BuddyNotes {
  left: Notes;
  right: Notes;
}

/** 谱面难度（标准 / DX） */
export interface SongDifficulty {
  /** 谱面类型（标准谱面或 DX 谱面） */
  type: SongType;
  /** 难度索引 */
  difficulty: LevelIndex;
  /** 等级文案；数据源提供时存在 */
  level?: string;
  /** 精确定数；数据源提供时存在 */
  level_value?: number;
  /** 谱师；数据源提供时存在 */
  note_designer?: string;
  /** 数字版本 id；数据源提供时存在 */
  version?: number;
  /** 谱面物量；查询请求包含物量时存在 */
  notes?: Notes;
}

/** 宴会场谱面难度 */
export interface SongDifficultyUtage {
  kanji: string;
  description: string;
  is_buddy: boolean;
  notes?: Notes | BuddyNotes;
  type: SongType;
  difficulty: LevelIndex;
  level: string;
  level_value: number;
  note_designer: string;
  version: number;
}

/** 一首曲目的全部难度 */
export interface SongDifficulties {
  standard: SongDifficulty[];
  dx: SongDifficulty[];
  utage?: SongDifficultyUtage[];
}

/**
 * 曲目。
 *
 * @example
 * ```ts
 * const song: Song = {
 *   id: 114,
 *   title: "曲名",
 *   artist: "艺术家",
 *   genre: "maimai",
 *   bpm: 180,
 *   version: 24000,
 *   difficulties: {
 *     standard: [],
 *     dx: [{
 *       type: "dx",
 *       difficulty: LevelIndex.MASTER,
 *       level: "14+",
 *       level_value: 14.7,
 *       note_designer: "Charter",
 *       version: 24000,
 *     }],
 *   },
 * };
 * ```
 */
export interface Song {
  /** 曲目 id */
  id: number;
  /** 曲名 */
  title: string;
  /** 艺术家；数据源提供时存在 */
  artist?: string;
  /** 流派；数据源提供时存在 */
  genre?: string;
  /** BPM；数据源提供时存在 */
  bpm?: number;
  /** 上游曲目地图字段；数据源提供时存在 */
  map?: string;
  /** 数字版本 id；数据源提供时存在 */
  version?: number;
  /** 版权说明；数据源提供时存在 */
  rights?: string;
  /** 是否被数据源标记为禁用 */
  disabled?: boolean;
  /** 标准 / DX / 宴会场的难度列表 */
  difficulties: SongDifficulties;
  /** 是否被数据源标记为锁定 */
  locked?: boolean;
}

/** 流派 */
export interface Genre {
  id: number;
  title: string;
  genre: string;
}

/** 版本 */
export interface Version {
  id: number;
  title: string;
  version: number;
}

/** 曲目列表查询结果 */
export interface SongList {
  /** 曲目列表 */
  songs: Song[];
  /** 流派表；数据源提供对应能力时存在 */
  genres?: Genre[];
  /** 版本表；数据源提供对应能力时存在 */
  versions?: Version[];
}

/** 曲目别名 */
export interface Alias {
  song_id: number;
  aliases: string[];
}

/** 曲目关联的收藏品 */
export interface SongCollection {
  type: CollectionType;
  id: number;
  name: string;
  color?: string;
  genre?: string;
}

/** 素材类型 */
export type AssetType = "icon" | "plate" | "frame" | "jacket" | "music";

/** 收藏品分类 */
export interface CollectionGenre {
  id: number;
  title: string;
  genre: string;
}

/** DXRating 社区谱面标签的多语言文本 */
export type LocalizedText = Record<string, string>;

/** DXRating 社区谱面标签 */
export interface ChartTag {
  id: number;
  localized_name: LocalizedText;
  localized_description: LocalizedText;
  group_id: number;
}

/** DXRating 社区谱面标签分组 */
export interface ChartTagGroup {
  id: number;
  localized_name: LocalizedText;
  color: string;
}

/**
 * 查询某张谱面的标签；字段与 prober Score 可结构化兼容。
 *
 * @example
 * ```ts
 * const query: ChartTagQuery = {
 *   song_name: "ウミユリ海底譚",
 *   type: "standard",
 *   level_index: LevelIndex.MASTER,
 * };
 * ```
 */
export interface ChartTagQuery {
  song_name?: string;
  type: SongType;
  level_index: LevelIndex;
}
