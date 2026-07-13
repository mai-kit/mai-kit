/**
 * @packageDocumentation
 *
 * `@mai-kit/database` 提供舞萌 DX 游戏数据与素材访问。
 *
 * {@link MaimaiDatabase} 定义与数据源无关的接口，内置的 LXNS 和 Diving-Fish
 * 适配负责连接具体 API 与 CDN。玩家成绩由 `@mai-kit/prober` 查询。
 *
 * ## 用法
 *
 * ```ts
 * // db 为任意 MaimaiDatabase 实现
 * const { songs } = await db.getSongList({ notes: true });
 * const jacket = await db.getAsset("jacket", songId);
 * // 可注入 Draw：new Draw({ database: db })
 * ```
 *
 * ## 内置适配
 *
 * ```ts
 * import { LxnsMaimaiDatabase, DivingFishMaimaiDatabase } from "@mai-kit/database";
 *
 * const lxns = new LxnsMaimaiDatabase();
 * const df = new DivingFishMaimaiDatabase();
 * ```
 *
 * ## 启用缓存
 *
 * ```ts
 * import {
 *   FileSystemCacheStore,
 *   LxnsMaimaiDatabase,
 *   MemoryCacheStore,
 * } from "@mai-kit/database";
 *
 * // 内存（Node / Web）
 * const memoryDb = new LxnsMaimaiDatabase({
 *   cache: {
 *     store: new MemoryCacheStore({ maxEntries: 512 }),
 *     ttlMs: 5 * 60_000,
 *   },
 * });
 *
 * // 磁盘（仅 Node）
 * const diskDb = new LxnsMaimaiDatabase({
 *   cache: {
 *     store: new FileSystemCacheStore({ directory: "/var/cache/mai-kit", maxEntries: 2_000 }),
 *     ttlMs: 24 * 60 * 60_000,
 *   },
 * });
 * ```
 *
 * ## 错误
 *
 * - {@link MaimaiDatabaseError}：HTTP / 业务 / 缓存等通用失败
 * - {@link MaimaiDatabaseNotImplementedError}：适配无法实现某接口方法（如水鱼无别名 API）
 * - 适配子类：`LxnsDatabaseError` / `DivingFishDatabaseError`
 *
 * [包与职责](/guide/architecture) · [快速开始](/guide/getting-started)
 */

export * from "./adapters/lxns/index";
export * from "./adapters/diving-fish/index";
export * from "./cache";
// chart-tags 为适配内部实现，不从包根公开（用 MaimaiDatabase.getChartTags）
export * from "./database";
export * from "./error";
export type { HttpResilienceOptions } from "@mai-kit/shared";
export * from "./models";
