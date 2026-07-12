import { MaimaiDatabaseError } from "./error";

/** 缓存存储的二进制条目。 */
export interface DatabaseCacheEntry {
  value: Uint8Array;
  expiresAt?: number;
}

/** database 通用缓存存储接口，Node / Web 均可自行实现。 */
export interface DatabaseCacheStore {
  /** 读取缓存条目；未命中时返回 `undefined`。 */
  get(key: string): Promise<DatabaseCacheEntry | undefined>;
  /** 写入或替换缓存条目。 */
  set(key: string, entry: DatabaseCacheEntry): Promise<void>;
  /** 删除指定缓存条目。 */
  delete(key: string): Promise<void>;
  /** 清空当前存储中的所有条目。 */
  clear(): Promise<void>;
}

/** database 适配器的通用缓存配置。 */
export interface DatabaseCacheOptions {
  /** 实际持久化或内存存储实现 */
  store: DatabaseCacheStore;
  /** 缓存有效期（毫秒）；不传表示不过期。 */
  ttlMs?: number;
}

/** {@link MemoryCacheStore} 的容量配置。 */
export interface MemoryCacheStoreOptions {
  /** 最多保留的条目数；超过后淘汰最久未访问的条目。 */
  maxEntries: number;
}

/**
 * 双端可用的内存 LRU 缓存存储。
 *
 * @example
 * ```ts
 * const store = new MemoryCacheStore({ maxEntries: 500 });
 * const database = new LxnsMaimaiDatabase({ cache: { store, ttlMs: 300_000 } });
 * ```
 */
export class MemoryCacheStore implements DatabaseCacheStore {
  private readonly entries = new Map<string, DatabaseCacheEntry>();
  private readonly maxEntries: number;

  constructor(options: MemoryCacheStoreOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0) {
      throw new RangeError("MemoryCacheStore maxEntries must be a positive integer");
    }
    this.maxEntries = options.maxEntries;
  }

  /** 读取并刷新条目的 LRU 访问顺序。 */
  async get(key: string): Promise<DatabaseCacheEntry | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return cloneEntry(entry);
  }

  /** 写入条目，并在超出容量时淘汰最久未访问的条目。 */
  async set(key: string, entry: DatabaseCacheEntry): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, cloneEntry(entry));
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  /** 删除指定条目。 */
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** 清空内存缓存。 */
  async clear(): Promise<void> {
    this.entries.clear();
  }
}

/**
 * 适配器共用的缓存读写与并发请求合并器。
 *
 * @example
 * ```ts
 * const cache = new DatabaseCache({
 *   store: new MemoryCacheStore({ maxEntries: 100 }),
 *   ttlMs: 60_000,
 * });
 * const songs = await cache.json("songs", () => fetchSongs());
 * const jacket = await cache.bytes("jacket:114", () => fetchJacket(114));
 * ```
 */
export class DatabaseCache {
  private readonly pending = new Map<string, Promise<Uint8Array>>();

  constructor(private readonly options: DatabaseCacheOptions) {
    if (options.ttlMs !== undefined && (!Number.isFinite(options.ttlMs) || options.ttlMs < 0)) {
      throw new RangeError("Database cache ttlMs must be a non-negative finite number");
    }
  }

  /** 读取 JSON 缓存；未命中时调用 `load` 并写回。 */
  async json<T>(key: string, load: () => Promise<T>): Promise<T> {
    const bytes = await this.getOrLoad(key, async () => encodeJson(await load()));
    try {
      // 缓存内容由对应适配器的加载函数编码，类型与调用点的 T 一致。
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch (error) {
      throw cacheError(`Failed to decode database cache entry ${key}`, error);
    }
  }

  /** 读取二进制缓存；未命中时调用 `load` 并写回。 */
  async bytes(key: string, load: () => Promise<Uint8Array>): Promise<Uint8Array> {
    return this.getOrLoad(key, load);
  }

  private async getOrLoad(key: string, load: () => Promise<Uint8Array>): Promise<Uint8Array> {
    const active = this.pending.get(key);
    if (active) return (await active).slice();

    const task = this.readOrLoad(key, load);
    this.pending.set(key, task);
    try {
      return (await task).slice();
    } finally {
      if (this.pending.get(key) === task) this.pending.delete(key);
    }
  }

  private async readOrLoad(key: string, load: () => Promise<Uint8Array>): Promise<Uint8Array> {
    let cached: DatabaseCacheEntry | undefined;
    try {
      cached = await this.options.store.get(key);
    } catch (error) {
      throw cacheError(`Failed to read database cache entry ${key}`, error);
    }

    if (cached) {
      if (cached.expiresAt === undefined || cached.expiresAt > Date.now()) return cached.value;
      try {
        await this.options.store.delete(key);
      } catch (error) {
        throw cacheError(`Failed to delete expired database cache entry ${key}`, error);
      }
    }

    const value = await load();
    const entry: DatabaseCacheEntry = {
      value: value.slice(),
      ...(this.options.ttlMs === undefined ? {} : { expiresAt: Date.now() + this.options.ttlMs }),
    };
    try {
      await this.options.store.set(key, entry);
    } catch (error) {
      throw cacheError(`Failed to write database cache entry ${key}`, error);
    }
    return value;
  }
}

function cloneEntry(entry: DatabaseCacheEntry): DatabaseCacheEntry {
  return {
    value: entry.value.slice(),
    ...(entry.expiresAt === undefined ? {} : { expiresAt: entry.expiresAt }),
  };
}

function encodeJson(value: unknown): Uint8Array {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) throw new TypeError("JSON.stringify returned undefined");
    return new TextEncoder().encode(json);
  } catch (error) {
    throw cacheError("Failed to encode database cache value", error);
  }
}

function cacheError(message: string, cause: unknown): MaimaiDatabaseError {
  return new MaimaiDatabaseError({ message, cause });
}
