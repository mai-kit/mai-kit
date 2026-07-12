/**
 * @packageDocumentation
 *
 * `@mai-kit/shared` — mai-kit 跨包共享的**错误基类**与 **maimai 领域原语**。
 *
 * - 错误：{@link MaiKitError} / {@link isMaiKitError}
 * - 原语：`SongType` / `LevelIndex` / `FCType` / `FSType` / `RateType` / `Collection*`
 *
 * 不包含网络、适配器或业务流程。database / prober 会再导出部分类型以免漂移。
 */

export * from "./error";
export * from "./maimai";
