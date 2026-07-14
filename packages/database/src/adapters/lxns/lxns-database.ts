import type { MaimaiDatabase, SongListQuery } from "../../database";
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
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import { getLocalChartTags } from "../../chart-tags";
import { LxnsDatabaseError } from "./error";
import { LxnsHttp } from "./lxns-http";
import {
  aliasListSchema,
  collectionGenreListSchema,
  collectionGenreSchema,
  collectionListSchema,
  collectionSchema,
  normalizeLxnsCollection,
  parseLxnsResponse,
  songCollectionListSchema,
  songListSchema,
  songSchema,
} from "./schemas";

/** LXNS 素材 CDN 默认根地址 */
export const LXNS_DEFAULT_ASSET_BASE_URL = "https://assets2.lxns.net/";

/** 收藏品类型到列表响应字段的映射 */
const COLLECTION_LIST_KEY = {
  trophy: "trophies",
  icon: "icons",
  plate: "plates",
  frame: "frames",
} as const satisfies Record<CollectionType, string>;

/** {@link LxnsMaimaiDatabase} 构造选项 */
export interface LxnsMaimaiDatabaseOptions {
  /** 公开 JSON API 根地址 */
  baseURL?: string;
  /** 素材 CDN 根地址 */
  assetBaseURL?: string;
  /**
   * 远程 JSON 与素材缓存。
   * 不传则不缓存；draw 场景建议配置以减少重复拉取封面。
   */
  cache?: DatabaseCacheOptions;
  /** JSON API 单次超时（毫秒）；省略不限制 */
  timeoutMs?: number;
  /** JSON API 网络 / 5xx 额外重试次数（默认 `0`） */
  retries?: number;
}

/**
 * {@link MaimaiDatabase} 的 **LXNS 适配**：公开 JSON API + 素材 CDN。
 *
 * - 无需玩家访问令牌（公开数据）
 * - `getChartTags` 使用包内 DXRating 标签快照
 *
 * @example
 * ```ts
 * const database = new LxnsMaimaiDatabase({
 *   cache: { store: new MemoryCacheStore({ maxEntries: 512 }), ttlMs: 300_000 },
 * });
 * ```
 */
export class LxnsMaimaiDatabase implements MaimaiDatabase {
  private readonly http: LxnsHttp;
  private readonly assetBaseURL: string;
  private readonly cache?: DatabaseCache;
  private readonly resilience: HttpResilienceOptions;
  private readonly assetCoalescer = new RequestCoalescer();

  constructor(options: LxnsMaimaiDatabaseOptions = {}) {
    this.resilience = { timeoutMs: options.timeoutMs, retries: options.retries };
    this.http = new LxnsHttp({
      baseURL: options.baseURL,
      ...this.resilience,
    });
    this.assetBaseURL = options.assetBaseURL ?? LXNS_DEFAULT_ASSET_BASE_URL;
    this.cache = options.cache ? new DatabaseCache(options.cache) : undefined;
  }

  async getChartTags(charts: readonly ChartTagQuery[]): Promise<ChartTag[][]> {
    return getLocalChartTags(charts);
  }

  async getSongList(query?: SongListQuery): Promise<SongList> {
    return this.cachedJson(
      "song-list",
      [query?.version, query?.notes],
      async () =>
        this.http.get(
          "song/list",
          query === undefined ? undefined : { version: query.version, notes: query.notes },
        ),
      (value) => parseLxnsResponse(songListSchema, value, "song/list"),
    );
  }

  async getSong(id: number, query?: { version?: number }): Promise<Song> {
    return this.cachedJson(
      "song",
      [id, query?.version],
      async () => this.http.get(`song/${id}`, query),
      (value) => parseLxnsResponse(songSchema, value, `song/${id}`),
    );
  }

  async getSongCollections(songId: number): Promise<SongCollection[]> {
    return this.cachedJson(
      "song-collections",
      [songId],
      async () => this.http.get(`song-collections/${songId}`),
      (value) => parseLxnsResponse(songCollectionListSchema, value, `song-collections/${songId}`),
    );
  }

  async getAliasList(): Promise<Alias[]> {
    return this.cachedJson(
      "alias-list",
      [],
      async () => this.http.get("alias/list"),
      (value) => parseLxnsResponse(aliasListSchema, value, "alias/list").aliases,
    );
  }

  async getCollectionList(
    type: CollectionType,
    query?: { version?: number; required?: boolean },
  ): Promise<Collection[]> {
    return this.cachedJson(
      "collection-list",
      [type, query?.version, query?.required],
      async () => this.http.get(`${type}/list`, query),
      (value) => {
        const key = COLLECTION_LIST_KEY[type];
        const response = parseLxnsResponse(collectionListSchema, value, `${type}/list`);
        const collections = response[key];
        if (!collections) {
          throw new LxnsDatabaseError({
            message: `Lxns ${type}/list response is missing array field "${key}"`,
          });
        }
        return collections.map(normalizeLxnsCollection);
      },
    );
  }

  async getCollectionInfo(
    type: CollectionType,
    id: number,
    query?: { version?: number },
  ): Promise<Collection> {
    return this.cachedJson(
      "collection",
      [type, id, query?.version],
      async () => this.http.get(`${type}/${id}`, query),
      (value) =>
        normalizeLxnsCollection(parseLxnsResponse(collectionSchema, value, `${type}/${id}`)),
    );
  }

  async getCollectionGenreList(query?: { version?: number }): Promise<CollectionGenre[]> {
    return this.cachedJson(
      "collection-genre-list",
      [query?.version],
      async () => this.http.get("collection-genre/list", query),
      (value) =>
        parseLxnsResponse(collectionGenreListSchema, value, "collection-genre/list")
          .collectionGenres,
    );
  }

  async getCollectionGenreInfo(id: number, query?: { version?: number }): Promise<CollectionGenre> {
    return this.cachedJson(
      "collection-genre",
      [id, query?.version],
      async () => this.http.get(`collection-genre/${id}`, query),
      (value) => parseLxnsResponse(collectionGenreSchema, value, `collection-genre/${id}`),
    );
  }

  async getAsset(type: AssetType, id: number): Promise<Uint8Array> {
    const load = async (): Promise<Uint8Array> => {
      const ext = type === "music" ? "mp3" : "png";
      const url = new URL(`maimai/${type}/${id}.${ext}`, this.assetBaseURL);

      return this.assetCoalescer.run(`GET ${url.href}`, async () => {
        let response: Response;
        try {
          response = await fetchWithResilience(url, undefined, this.resilience);
        } catch (error) {
          throw new LxnsDatabaseError({
            message: `Failed to fetch asset ${type}/${id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            cause: error,
          });
        }

        if (!response.ok) {
          throw new LxnsDatabaseError({
            status: response.status,
            code: response.status,
            message: `Failed to fetch asset ${type}/${id} (HTTP ${response.status})`,
          });
        }

        return new Uint8Array(await response.arrayBuffer());
      });
    };

    if (!this.cache) return load();
    const key = `lxns:asset:${JSON.stringify([this.assetBaseURL, type, id])}`;
    return this.cache.bytes(key, load);
  }

  private async cachedJson<T>(
    operation: string,
    args: unknown[],
    load: () => Promise<unknown>,
    decode: (value: unknown) => T,
  ): Promise<T> {
    if (!this.cache) return decode(await load());
    const key = `lxns:raw:v1:${JSON.stringify([this.http.baseURL, operation, ...args])}`;
    return this.cache.json(key, load, decode);
  }
}
