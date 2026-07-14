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
import { MaimaiDatabaseNotImplementedError } from "../../error";
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import { mapDivingFishChartStats, type DivingFishChartStats } from "./chart-stats";
import { DivingFishDatabaseError } from "./error";
import { divingFishCoverId, mapDivingFishMusicDataToSongList } from "./map-songs";
import {
  divingFishMusicDataSchema,
  parseDivingFishResponse,
  type DivingFishMusicEntry,
} from "./schemas";

/** Diving-Fish 曲目 API 默认根地址 */
export const DIVING_FISH_DEFAULT_BASE_URL = "https://www.diving-fish.com/api/maimaidxprober/";

/** 封面 CDN 默认根（`https://www.diving-fish.com/covers/{id}.png`） */
export const DIVING_FISH_DEFAULT_COVER_BASE_URL = "https://www.diving-fish.com/covers/";

/** {@link DivingFishMaimaiDatabase} 构造选项 */
export interface DivingFishMaimaiDatabaseOptions extends HttpResilienceOptions {
  /** 曲目 API 根，默认 {@link DIVING_FISH_DEFAULT_BASE_URL} */
  baseURL?: string;
  /** 封面 CDN 根，默认 {@link DIVING_FISH_DEFAULT_COVER_BASE_URL} */
  coverBaseURL?: string;
  /**
   * 可选缓存（`music_data`、`chart_stats` JSON 与 jacket 字节）。
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
 * | 社区成绩统计 | `GET /chart_stats`（适配专属） |
 * | 封面 jacket | `GET /covers/{id}.png` |
 * | 谱面标签 | 包内 DXRating 快照 |
 * | 别名 / 收藏品 | 无对等接口 → 抛 {@link MaimaiDatabaseNotImplementedError} |
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
  private readonly resilience: HttpResilienceOptions;
  private readonly coalescer = new RequestCoalescer();
  private songListCache?: Promise<SongList>;

  /**
   * @param options - 可选 API/CDN 根、缓存、timeout / retries
   */
  constructor(options: DivingFishMaimaiDatabaseOptions = {}) {
    this.baseURL = options.baseURL ?? DIVING_FISH_DEFAULT_BASE_URL;
    this.coverBaseURL = options.coverBaseURL ?? DIVING_FISH_DEFAULT_COVER_BASE_URL;
    this.cache = options.cache ? new DatabaseCache(options.cache) : undefined;
    this.resilience = { timeoutMs: options.timeoutMs, retries: options.retries };
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
   * @returns 通用 {@link SongList}（水鱼未提供的 `genres`/`versions` 字段省略）
   * @throws {DivingFishDatabaseError} 拉取失败或响应结构错误
   */
  async getSongList(query?: SongListQuery): Promise<SongList> {
    const load = async () => {
      const entries = await this.fetchMusicData();
      return mapDivingFishMusicDataToSongList(entries, { notes: query?.notes });
    };
    // notes 只影响映射结果；原始 music_data 由 fetchMusicData 统一缓存。
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
   * 获取水鱼社区成绩统计。
   *
   * 这是水鱼适配专属能力，不属于通用 {@link MaimaiDatabase}。`charts` 以曲目 id 为键，
   * 每项数组下标对应难度索引；没有统计的谱面为 `null`。
   *
   * @returns 谱面相对难度、平均达成率、评级与 FC 分布
   * @throws {DivingFishDatabaseError} 网络、HTTP 或响应结构错误
   *
   * @example
   * ```ts
   * const stats = await db.getChartStats();
   * const master = stats.charts["11451"]?.[3];
   * console.log(master?.fit_diff);
   * ```
   */
  async getChartStats(): Promise<DivingFishChartStats> {
    const load = async () => this.fetchJson("chart_stats");
    if (this.cache) {
      return this.cache.json("df:raw:chart-stats:v1", load, mapDivingFishChartStats);
    }
    return mapDivingFishChartStats(await load());
  }

  /**
   * @param _songId - 忽略
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getSongCollections(_songId: number): Promise<SongCollection[]> {
    throw notImplemented("getSongCollections");
  }

  /**
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getAliasList(): Promise<Alias[]> {
    throw notImplemented("getAliasList");
  }

  /**
   * @param _type - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getCollectionList(
    _type: CollectionType,
    _query?: CollectionListQuery,
  ): Promise<Collection[]> {
    throw notImplemented("getCollectionList");
  }

  /**
   * @param _type - 忽略
   * @param _id - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getCollectionInfo(
    _type: CollectionType,
    _id: number,
    _query?: VersionQuery,
  ): Promise<Collection> {
    throw notImplemented("getCollectionInfo");
  }

  /**
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getCollectionGenreList(_query?: VersionQuery): Promise<CollectionGenre[]> {
    throw notImplemented("getCollectionGenreList");
  }

  /**
   * @param _id - 忽略
   * @param _query - 忽略
   * @returns 从不返回
   * @throws {MaimaiDatabaseNotImplementedError} 水鱼无对等接口
   */
  async getCollectionGenreInfo(_id: number, _query?: VersionQuery): Promise<CollectionGenre> {
    throw notImplemented("getCollectionGenreInfo");
  }

  /**
   * 拉取素材字节。本适配仅支持封面 `jacket`。
   *
   * @param type - 素材类型；仅 `"jacket"` 有效
   * @param id - 曲目 id
   * @returns PNG 等原始字节
   * @throws {MaimaiDatabaseNotImplementedError} 非 jacket 类型
   * @throws {DivingFishDatabaseError} HTTP 失败或网络错误
   */
  async getAsset(type: AssetType, id: number): Promise<Uint8Array> {
    if (type !== "jacket") {
      throw new MaimaiDatabaseNotImplementedError({
        method: "getAsset",
        adapter: "Diving-Fish",
        message: `Diving-Fish only implements getAsset("jacket"); got "${type}"`,
      });
    }
    const coverId = divingFishCoverId(id);
    const url = new URL(`${coverId}.png`, this.coverBaseURL);
    const load = async () =>
      this.coalescer.run(`GET ${url.href}`, async () => {
        let response: Response;
        try {
          response = await fetchWithResilience(url, undefined, this.resilience);
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
      });
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
    const load = async () => this.fetchJson("music_data");
    const decode = (value: unknown) =>
      parseDivingFishResponse(divingFishMusicDataSchema, value, "music_data");
    if (this.cache) return this.cache.json("df:raw:music-data:v1", load, decode);
    return decode(await load());
  }

  /**
   * @returns 指定公开端点的 JSON 响应
   * @throws {DivingFishDatabaseError} 网络、HTTP 或 JSON 解析失败
   */
  private async fetchJson(path: string): Promise<unknown> {
    const url = new URL(path, this.baseURL);
    return this.coalescer.run(`GET ${url.href}`, async () => {
      let response: Response;
      try {
        response = await fetchWithResilience(
          url,
          { headers: { Accept: "application/json" } },
          this.resilience,
        );
      } catch (error) {
        throw new DivingFishDatabaseError({
          message: `Diving-Fish ${path} request failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          cause: error,
        });
      }
      if (!response.ok) {
        throw new DivingFishDatabaseError({
          message: `Diving-Fish ${path} HTTP ${response.status}`,
          status: response.status,
          code: response.status,
        });
      }
      try {
        return await response.json();
      } catch (error) {
        throw new DivingFishDatabaseError({
          status: response.status,
          message: `Diving-Fish ${path}: invalid JSON response`,
          cause: error,
        });
      }
    });
  }
}

/**
 * @param method - {@link MaimaiDatabase} 方法名
 * @returns 包级未实现错误
 */
function notImplemented(method: string): MaimaiDatabaseNotImplementedError {
  return new MaimaiDatabaseNotImplementedError({ method, adapter: "Diving-Fish" });
}
