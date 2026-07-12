/**
 * @packageDocumentation
 *
 * `@mai-kit/prober` 提供舞萌 DX 玩家数据的只读查询。
 *
 * {@link ProberPlayer}、`PlayerProfile`、`Score` 和 `Bests` 不依赖具体查分服务。
 * LXNS 与 Diving-Fish 适配把各自的 API 响应转换为这些类型，得到的 `profile` 和
 * `bests` 都可以传给 `Draw.withPlayer()`。
 *
 * ## 查询玩家数据
 *
 * ```ts
 * // player 由适配创建，类型为 ProberPlayer
 * const [profile, bests] = await Promise.all([
 *   player.getProfile(),
 *   player.getBests(),
 * ]);
 * // → Draw.withPlayer(profile, bests)
 * ```
 *
 * ## 内置适配
 *
 * ```ts
 * import { createLxnsClient, createDivingFishClient } from "@mai-kit/prober";
 *
 * // LXNS
 * const me = createLxnsClient({ personalAccessToken: "..." }).me();
 *
 * // Diving-Fish 公开 B50
 * const df = createDivingFishClient();
 * const player = await df.getPlayer({ username: "someone" });
 * ```
 *
 * ## 错误处理
 *
 * ```ts
 * import {
 *   isDivingFishProberError,
 *   isLxnsProberError,
 *   isProberError,
 * } from "@mai-kit/prober";
 *
 * try {
 *   await player.getBests();
 * } catch (error) {
 *   if (isLxnsProberError(error)) console.error("LXNS", error.status);
 *   else if (isDivingFishProberError(error)) console.error("Diving-Fish", error.status);
 *   else if (isProberError(error)) console.error("prober", error.message);
 *   else throw error;
 * }
 * ```
 *
 * [包与职责](/guide/architecture) · [快速开始](/guide/getting-started)
 */

export * from "./models";
export * from "./prober-player";
export * from "./error";
export * from "./adapters/lxns/index";
export * from "./adapters/diving-fish/index";
