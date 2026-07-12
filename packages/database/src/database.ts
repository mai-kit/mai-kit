import type {
  Alias,
  AssetType,
  ChartTag,
  ChartTagQuery,
  Collection,
  CollectionGenre,
  CollectionType,
  Song,
  SongCollection,
  SongList,
} from "./models";

/** 曲目列表查询参数 */
export interface SongListQuery {
  /** 按版本过滤 */
  version?: number;
  /** 是否包含谱面物量信息 */
  notes?: boolean;
}

/** 按版本过滤的查询参数 */
export interface VersionQuery {
  version?: number;
}

/** 收藏品列表查询参数 */
export interface CollectionListQuery {
  /** 按版本过滤 */
  version?: number;
  /** 是否包含达成要求 */
  required?: boolean;
}

/**
 * 游戏静态数据与素材访问接口（与具体数据服务无关）。
 *
 * - **包含**：曲目、别名、收藏品、素材二进制、谱面社区标签等
 * - **不包含**：玩家成绩查询（见 `@mai-kit/prober`）
 *
 * 各适配实现本接口；`@mai-kit/draw` 只依赖其中子集
 * （`getAsset` / `getChartTags` / 可选 `getSongList`）。
 *
 * @example
 * ```ts
 * // db 为任意 MaimaiDatabase 实现
 * const list = await db.getSongList({ notes: true });
 * const jacket = await db.getAsset("jacket", songId);
 * ```
 */
export interface MaimaiDatabase {
  /**
   * 批量获取谱面社区标签（包内快照，不请求 DXRating 运行时）。
   * @returns 与 `charts` 等长的二维数组
   */
  getChartTags(charts: readonly ChartTagQuery[]): Promise<ChartTag[][]>;

  /**
   * 曲目列表。
   * @param query.notes - `true` 时带物量，供 draw 计算 `dx_max`
   */
  getSongList(query?: SongListQuery): Promise<SongList>;

  /** 单曲详情 */
  getSong(id: number, query?: VersionQuery): Promise<Song>;

  /** 曲目关联收藏品 */
  getSongCollections(songId: number): Promise<SongCollection[]>;

  /** 曲目别名全表 */
  getAliasList(): Promise<Alias[]>;

  /** 某类收藏品列表（称号 / 头像 / 姓名框 / 背景） */
  getCollectionList(type: CollectionType, query?: CollectionListQuery): Promise<Collection[]>;

  /** 单个收藏品 */
  getCollectionInfo(type: CollectionType, id: number, query?: VersionQuery): Promise<Collection>;

  /** 收藏品分类列表 */
  getCollectionGenreList(query?: VersionQuery): Promise<CollectionGenre[]>;

  /** 单个收藏品分类 */
  getCollectionGenreInfo(id: number, query?: VersionQuery): Promise<CollectionGenre>;

  /**
   * 素材二进制（封面 jacket、头像 icon、姓名框 plate、背景 frame、音乐等）。
   * @returns 原始字节，调用方自行解码或转 data URI
   */
  getAsset(type: AssetType, id: number): Promise<Uint8Array>;
}
