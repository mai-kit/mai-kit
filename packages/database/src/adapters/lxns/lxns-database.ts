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
import { getLocalChartTags } from "../../chart-tags";
import { LxnsDatabaseError } from "./error";
import { LxnsHttp } from "./lxns-http";

/** LXNS 素材 CDN 默认根地址 */
export const LXNS_DEFAULT_ASSET_BASE_URL = "https://assets2.lxns.net/";

/** 收藏品类型到列表响应字段的映射 */
const COLLECTION_LIST_KEY: Record<CollectionType, string> = {
  trophy: "trophies",
  icon: "icons",
  plate: "plates",
  frame: "frames",
};

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

  constructor(options: LxnsMaimaiDatabaseOptions = {}) {
    this.http = new LxnsHttp({ baseURL: options.baseURL });
    this.assetBaseURL = options.assetBaseURL ?? LXNS_DEFAULT_ASSET_BASE_URL;
    this.cache = options.cache ? new DatabaseCache(options.cache) : undefined;
  }

  async getChartTags(charts: readonly ChartTagQuery[]): Promise<ChartTag[][]> {
    return getLocalChartTags(charts);
  }

  async getSongList(query?: SongListQuery): Promise<SongList> {
    return this.cachedJson("song-list", [query?.version, query?.notes], async () =>
      this.http.get<SongList>(
        "song/list",
        query === undefined ? undefined : { version: query.version, notes: query.notes },
      ),
    );
  }

  async getSong(id: number, query?: { version?: number }): Promise<Song> {
    return this.cachedJson("song", [id, query?.version], async () =>
      this.http.get<Song>(`song/${id}`, query),
    );
  }

  async getSongCollections(songId: number): Promise<SongCollection[]> {
    return this.cachedJson("song-collections", [songId], async () =>
      this.http.get<SongCollection[]>(`song-collections/${songId}`),
    );
  }

  async getAliasList(): Promise<Alias[]> {
    return this.cachedJson("alias-list", [], async () => {
      const res = await this.http.get<{ aliases: Alias[] }>("alias/list");
      return res.aliases;
    });
  }

  async getCollectionList(
    type: CollectionType,
    query?: { version?: number; required?: boolean },
  ): Promise<Collection[]> {
    return this.cachedJson("collection-list", [type, query?.version, query?.required], async () => {
      const key = COLLECTION_LIST_KEY[type];
      const res = await this.http.get<Record<string, Collection[]>>(`${type}/list`, query);
      return res[key] ?? [];
    });
  }

  async getCollectionInfo(
    type: CollectionType,
    id: number,
    query?: { version?: number },
  ): Promise<Collection> {
    return this.cachedJson("collection", [type, id, query?.version], async () =>
      this.http.get<Collection>(`${type}/${id}`, query),
    );
  }

  async getCollectionGenreList(query?: { version?: number }): Promise<CollectionGenre[]> {
    return this.cachedJson("collection-genre-list", [query?.version], async () => {
      const res = await this.http.get<{ collectionGenres: CollectionGenre[] }>(
        "collection-genre/list",
        query,
      );
      return res.collectionGenres;
    });
  }

  async getCollectionGenreInfo(id: number, query?: { version?: number }): Promise<CollectionGenre> {
    return this.cachedJson("collection-genre", [id, query?.version], async () =>
      this.http.get<CollectionGenre>(`collection-genre/${id}`, query),
    );
  }

  async getAsset(type: AssetType, id: number): Promise<Uint8Array> {
    const load = async (): Promise<Uint8Array> => {
      const ext = type === "music" ? "mp3" : "png";
      const url = new URL(`maimai/${type}/${id}.${ext}`, this.assetBaseURL);

      let response: Response;
      try {
        response = await fetch(url);
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
    };

    if (!this.cache) return load();
    const key = `lxns:asset:${JSON.stringify([this.assetBaseURL, type, id])}`;
    return this.cache.bytes(key, load);
  }

  private async cachedJson<T>(
    operation: string,
    args: unknown[],
    load: () => Promise<T>,
  ): Promise<T> {
    if (!this.cache) return load();
    const key = `lxns:data:${JSON.stringify([this.http.baseURL, operation, ...args])}`;
    return this.cache.json(key, load);
  }
}
