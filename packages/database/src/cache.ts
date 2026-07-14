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

/** {@link FileSystemCacheStore} 的配置（**Node.js only**）。 */
export interface FileSystemCacheStoreOptions {
  /**
   * 缓存文件目录。推荐绝对路径；相对路径按 Node 的 `path.resolve` 解析
   *（通常相对 `process.cwd()`）。
   */
  directory: string;
  /**
   * 最多保留的条目文件数；超出时按文件 mtime 淘汰最旧。
   * 省略表示不限制数量（依赖 `ttlMs` / 手工 `clear`）。
   */
  maxEntries?: number;
}

const FS_CACHE_MAGIC = new TextEncoder().encode("MKC1");
const FS_CACHE_HEADER_SIZE = 4 + 8; // magic + expiresAt (uint64 BE)

type NodeFs = typeof import("node:fs/promises");
type NodePath = typeof import("node:path");

/**
 * Node.js 专用的磁盘缓存存储（实现 {@link DatabaseCacheStore}）。
 *
 * 每个 key 对应目录下的一个 `.bin` 文件（文件名为 key 的 SHA-256）；
 * 条目含可选 `expiresAt`（过期删除由 {@link DatabaseCache} 负责）；
 * 写入采用临时文件 + rename。浏览器不可用。
 *
 * @example
 * ```ts
 * import { FileSystemCacheStore, LxnsMaimaiDatabase } from "@mai-kit/database";
 *
 * const database = new LxnsMaimaiDatabase({
 *   cache: {
 *     store: new FileSystemCacheStore({
 *       directory: "/var/cache/mai-kit",
 *       maxEntries: 2_000,
 *     }),
 *     ttlMs: 24 * 60 * 60_000,
 *   },
 * });
 * ```
 */
export class FileSystemCacheStore implements DatabaseCacheStore {
  private directory: string;
  private readonly maxEntries: number | undefined;
  private ready: Promise<{ fs: NodeFs; path: NodePath }> | undefined;

  constructor(options: FileSystemCacheStoreOptions) {
    assertNodeEnvironment();
    if (typeof options.directory !== "string" || options.directory.trim() === "") {
      throw new TypeError("FileSystemCacheStore directory must be a non-empty string");
    }
    if (
      options.maxEntries !== undefined &&
      (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0)
    ) {
      throw new RangeError("FileSystemCacheStore maxEntries must be a positive integer");
    }
    this.directory = options.directory;
    this.maxEntries = options.maxEntries;
  }

  /** 读取磁盘条目；不存在返回 `undefined`。 */
  async get(key: string): Promise<DatabaseCacheEntry | undefined> {
    const { fs, path } = await this.ensureReady();
    const file = path.join(this.directory, await entryFileName(key));
    let data: Uint8Array;
    try {
      data = new Uint8Array(await fs.readFile(file));
    } catch (error) {
      if (isNotFoundError(error)) return undefined;
      throw error;
    }
    return decodeFsEntry(data);
  }

  /** 写入磁盘条目；可选按 `maxEntries` 淘汰最旧文件。 */
  async set(key: string, entry: DatabaseCacheEntry): Promise<void> {
    const { fs, path } = await this.ensureReady();
    const name = await entryFileName(key);
    const file = path.join(this.directory, name);
    const tmp = path.join(this.directory, `.${name}.${process.pid}.${Date.now()}.tmp`);
    const payload = encodeFsEntry(entry);
    try {
      await fs.writeFile(tmp, payload);
      await fs.rename(tmp, file);
    } catch (error) {
      await fs.unlink(tmp).catch(() => undefined);
      throw error;
    }
    if (this.maxEntries !== undefined) await this.evictIfNeeded(fs, path);
  }

  /** 删除指定条目；不存在时忽略。 */
  async delete(key: string): Promise<void> {
    const { fs, path } = await this.ensureReady();
    const file = path.join(this.directory, await entryFileName(key));
    try {
      await fs.unlink(file);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  /** 删除目录内全部缓存 `.bin` 文件（不删除目录本身）。 */
  async clear(): Promise<void> {
    const { fs, path } = await this.ensureReady();
    const names = await fs.readdir(this.directory);
    await Promise.all(
      names
        .filter((name) => name.endsWith(".bin") && !name.startsWith("."))
        .map(async (name) => {
          try {
            await fs.unlink(path.join(this.directory, name));
          } catch (error) {
            if (!isNotFoundError(error)) throw error;
          }
        }),
    );
  }

  private async ensureReady(): Promise<{ fs: NodeFs; path: NodePath }> {
    assertNodeEnvironment();
    this.ready ??= (async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      this.directory = path.resolve(this.directory);
      await fs.mkdir(this.directory, { recursive: true });
      return { fs, path };
    })();
    return this.ready;
  }

  private async evictIfNeeded(fs: NodeFs, path: NodePath): Promise<void> {
    const max = this.maxEntries;
    if (max === undefined) return;

    const names = (await fs.readdir(this.directory)).filter(
      (name) => name.endsWith(".bin") && !name.startsWith("."),
    );
    if (names.length <= max) return;

    const stats = await Promise.all(
      names.map(async (name) => {
        const full = path.join(this.directory, name);
        const stat = await fs.stat(full);
        return { full, mtimeMs: stat.mtimeMs };
      }),
    );
    stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toRemove = stats.slice(0, stats.length - max);
    await Promise.all(
      toRemove.map(async ({ full }) => {
        try {
          await fs.unlink(full);
        } catch (error) {
          if (!isNotFoundError(error)) throw error;
        }
      }),
    );
  }
}

function assertNodeEnvironment(): void {
  if (typeof process === "undefined" || process.versions?.node == null) {
    throw new MaimaiDatabaseError({
      message: "FileSystemCacheStore is only available in Node.js",
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = Reflect.get(error, "code");
  return code === "ENOENT";
}

async function entryFileName(key: string): Promise<string> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(key, "utf8").digest("hex");
  return `${hash}.bin`;
}

function encodeFsEntry(entry: DatabaseCacheEntry): Uint8Array {
  const value = entry.value;
  const out = new Uint8Array(FS_CACHE_HEADER_SIZE + value.byteLength);
  out.set(FS_CACHE_MAGIC, 0);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const expiresAt =
    entry.expiresAt === undefined ? 0n : BigInt(Math.max(0, Math.floor(entry.expiresAt)));
  view.setBigUint64(4, expiresAt, false);
  out.set(value, FS_CACHE_HEADER_SIZE);
  return out;
}

function decodeFsEntry(data: Uint8Array): DatabaseCacheEntry {
  if (data.byteLength < FS_CACHE_HEADER_SIZE) {
    throw new MaimaiDatabaseError({ message: "FileSystemCacheStore entry is truncated" });
  }
  for (let i = 0; i < FS_CACHE_MAGIC.length; i += 1) {
    if (data[i] !== FS_CACHE_MAGIC[i]) {
      throw new MaimaiDatabaseError({ message: "FileSystemCacheStore entry has invalid magic" });
    }
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const expiresRaw = view.getBigUint64(4, false);
  const value = data.slice(FS_CACHE_HEADER_SIZE);
  if (expiresRaw === 0n) return { value };
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt)) {
    throw new MaimaiDatabaseError({ message: "FileSystemCacheStore entry has invalid expiresAt" });
  }
  return { value, expiresAt };
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
  async json<T>(key: string, load: () => Promise<T>): Promise<T>;
  /** 读取 JSON 缓存，并用 `decode` 校验缓存命中与新加载值。 */
  async json<T>(
    key: string,
    load: () => Promise<unknown>,
    decode: (value: unknown) => T,
  ): Promise<T>;
  async json<T>(
    key: string,
    load: () => Promise<unknown>,
    decode?: (value: unknown) => T,
  ): Promise<T> {
    const bytes = await this.getOrLoad(key, async () => {
      const loaded = await load();
      if (decode) decode(loaded);
      return encodeJson(loaded);
    });
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      throw cacheError(`Failed to decode database cache entry ${key}`, error);
    }
    if (decode) return decode(value);
    // 无 decoder 的公共兼容入口由调用方保证加载值类型；内置适配器均传 decoder。
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return value as T;
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
