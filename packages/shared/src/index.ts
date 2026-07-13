/**
 * @packageDocumentation
 *
 * `@mai-kit/shared` — mai-kit 跨包共享的**错误基类**、**maimai 领域原语**，
 * 以及适配层可选用的**无业务 HTTP 工具**。
 *
 * - 错误：{@link MaiKitError} / {@link isMaiKitError}
 * - 原语：`SongType` / `LevelIndex` / `FCType` / `FSType` / `RateType` / `Collection*`
 * - HTTP：{@link fetchWithResilience} / {@link RequestCoalescer}（超时、重试、同键合并；
 *   不绑定 URL / 错误类型，由各适配映射为包级错误）
 *
 * 不含查分/曲目适配或业务流程。database / prober 会再导出部分类型以免漂移。
 */

export * from "./error";
export * from "./http-resilience";
export * from "./maimai";
