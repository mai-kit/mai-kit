import type {
  CollectionListQuery,
  MaimaiDatabase,
  SongListQuery,
  VersionQuery,
} from "../../database";
import { DatabaseCache } from "../../cache";
import type { DatabaseCacheOptions } from "../../cache";
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
} from "../../models";
import { getLocalChartTags } from "../../chart-tags";
import { DivingFishDatabaseError } from "./error";
import {
  divingFishCoverId,
  mapDivingFishMusicDataToSongList,
  type DivingFishMusicEntry,
} from "./map-songs";

/** Diving-Fish 曲目 API 默认根地址 */
export const DIVING_FISH_DEFAULT_BASE_URL = "https://www.diving-fish.com/api/maimaidxprober/";

/** 封面 CDN 默认根（`https://www.diving-fish.com/covers/{id}.png`） */
export const DIVING_FISH_DEFAULT_COVER_BASE_URL = "https://www.diving-fish.com/covers/";

/** {@link DivingFishMaimaiDatabase} 构造选项 */
export interface DivingFishMaimaiDatabaseOptions {
  /** 曲目 API 根，默认 {@link DIVING_FISH_DEFAULT_BASE_URL} */
  baseURL?: string;
  /** 封面 CDN 根，默认 {@link DIVING_FISH_DEFAULT_COVER_BASE_URL} */
  coverBaseURL?: string;
  /**
   * 可选缓存（`music_data` JSON 与 jacket 字节）。
   * 不传则不缓存。
   */
  cache?: DatabaseCacheOptions;
}

/**
 * {@link MaimaiDatabase} 的 **Diving-Fish（水鱼）适配**。
 *
 * | 能力 | 来源 |
 * |------|------|
 * | 曲目列表 / 单曲 | `GET /music_data` |
 * | 封面 jacket | `GET /covers/{id}.png` |
 * | 谱面标签 | 包内 DXRating 快照 |
 * | 别名 / 收藏品 | 无对等接口 → 抛 {@link DivingFishDatabaseError} |
 *
 * @example
 * ```ts
 * const db = new DivingFishMaimaiDatabase();
 * const { songs } = await db.getSongList({ notes: true });
 * const jacket = await db.getAsset("jacket", 11451);
 * ```
 */
export class DivingFishMaimaiDatabase implements MaimaiDatabase {
  private readonly baseURL: string;
  private readonly coverBaseURL: string;
  private readonly cache?: DatabaseCache;
  private songListCache?: Promise<SongList>;

  /**
   * @param options - 可选 API/CDN 根与缓存
   */
  constructor(options: DivingFishMaimaiDatabaseOptions = {}) {
    this.baseURL = options.baseURL ?? DIVING_FISH_DEFAULT_BASE_URL;
    this.coverBaseURL = options.coverBaseURL ?? DIVING_FISH_DEFAULT_COVER_BASE_URL;
    this.cache = options.cache ? new DatabaseCache(options.cache) : undefined;
  }

  /**
   * 批量获取谱面社区标签（本地快照，不请求 DXRating 运行时）。
   *
   * @param charts - 曲名 + 类型 + 难度
   * @returns 与 `charts` 等长的标签数组
   */
  async getChartTags(charts: readonly ChartTagQuery[]): Promise<ChartTag[][]> {
    return getLocalChartTags(charts);
  }

  /**
   * 曲目列表（来自 `/music_data`）。
   *
   * @param query - `notes: true` 时填充物量，供 draw 计算 `dx_max`
   * @returns 通用 {@link SongList}（`genres`/`versions` 为空）
   * @throws {DivingFishDatabaseError} 拉取失败或响应非数组
   */
  async getSongList(query?: SongListQuery): Promise<SongList> {
    const load = async () => {
      const entries = await this.fetchMusicData();
      return mapDivingFishMusicDataToSongList(entries, { notes: query?.notes });
    };
    if (this.cache) {
      return this.cache.json(`df-song-list:${query?.notes ? 1 : 0}`, load);
    }
    // notes 只影响是否填充 notes；无 cache 时对无 notes 请求复用内存
    if (query?.notes) return load();
    this.songListCache ??= load();
    return this.songListCache;
  }

  /**
   * 单曲详情（在曲目列表中查找）。
   *
   * @param id - 曲目 id
   * @param _query - 忽略（水鱼 music_data 无版本过滤）
   * @returns 通用 {@link Song}
   * @throws {DivingFishDatabaseError} 曲目不存在
   */
  async getSong(id: number, _query?: VersionQuery): Promise<Song> {
    const { songs } = await this.getSongList({ notes: true });
    const song = songs.find((s) => s.id === id);
    if (!song) {
      throw new DivingFishDatabaseError({
        message: `Diving-Fish song not found: id=${id}`,
        code: 404,
        status: 404,
      });
    }
    return song;
  }

  /**
   * @param _songId - 忽略
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getSongCollections(_songId: number): Promise<SongCollection[]> {
    throw unsupported("getSongCollections");
  }

  /**
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getAliasList(): Promise<Alias[]> {
    throw unsupported("getAliasList");
  }

  /**
   * @param _type - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getCollectionList(
    _type: CollectionType,
    _query?: CollectionListQuery,
  ): Promise<Collection[]> {
    throw unsupported("getCollectionList");
  }

  /**
   * @param _type - 忽略
   * @param _id - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getCollectionInfo(
    _type: CollectionType,
    _id: number,
    _query?: VersionQuery,
  ): Promise<Collection> {
    throw unsupported("getCollectionInfo");
  }

  /**
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getCollectionGenreList(_query?: VersionQuery): Promise<CollectionGenre[]> {
    throw unsupported("getCollectionGenreList");
  }

  /**
   * @param _id - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {DivingFishDatabaseError} 水鱼无对等接口
   */
  async getCollectionGenreInfo(_id: number, _query?: VersionQuery): Promise<CollectionGenre> {
    throw unsupported("getCollectionGenreInfo");
  }

  /**
   * 拉取素材字节。本适配仅支持封面 `jacket`。
   *
   * @param type - 素材类型；仅 `"jacket"` 有效
   * @param id - 曲目 id
   * @returns PNG 等原始字节
   * @throws {DivingFishDatabaseError} 类型不支持、HTTP 失败或网络错误
   */
  async getAsset(type: AssetType, id: number): Promise<Uint8Array> {
    if (type !== "jacket") {
      throw new DivingFishDatabaseError({
        message: `Diving-Fish adapter only supports getAsset("jacket"); got "${type}"`,
      });
    }
    const coverId = divingFishCoverId(id);
    const url = new URL(`${coverId}.png`, this.coverBaseURL);
    const load = async () => {
      let response: Response;
      try {
        response = await fetch(url);
      } catch (error) {
        throw new DivingFishDatabaseError({
          message: `Diving-Fish cover fetch failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          cause: error,
        });
      }
      if (!response.ok) {
        throw new DivingFishDatabaseError({
          message: `Diving-Fish cover HTTP ${response.status} for ${coverId}`,
          status: response.status,
          code: response.status,
        });
      }
      return new Uint8Array(await response.arrayBuffer());
    };
    if (this.cache) {
      return this.cache.bytes(`df-cover:${coverId}`, load);
    }
    return load();
  }

  /**
   * @returns 上游 music_data 数组
   * @throws {DivingFishDatabaseError} 网络、HTTP 或非数组响应
   */
  private async fetchMusicData(): Promise<DivingFishMusicEntry[]> {
    const url = new URL("music_data", this.baseURL);
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (error) {
      throw new DivingFishDatabaseError({
        message: `Diving-Fish music_data request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: error,
      });
    }
    if (!response.ok) {
      throw new DivingFishDatabaseError({
        message: `Diving-Fish music_data HTTP ${response.status}`,
        status: response.status,
        code: response.status,
      });
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new DivingFishDatabaseError({ message: "Diving-Fish music_data: expected array" });
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return body as DivingFishMusicEntry[];
  }
}

/**
 * @param method - 方法名
 * @returns 说明不支持的错误
 */
function unsupported(method: string): DivingFishDatabaseError {
  return new DivingFishDatabaseError({
    message: `Diving-Fish adapter does not support MaimaiDatabase.${method}()`,
  });
}
