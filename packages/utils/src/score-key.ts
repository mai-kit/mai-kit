/**
 * 成绩 / 谱面身份字符串 key，用于 `Map` 索引。
 *
 * 形状：`"{songId}:{type}:{levelIndex}"`，例如 `"11451:dx:3"`。
 */
import type { LevelIndex, SongType } from "@mai-kit/shared";

/**
 * 从成绩对象拼 key（字段名与 prober `Score` 一致）。
 *
 * @param score - 至少包含 `id` / `type` / `level_index`
 * @returns 与 {@link chartMapKey} 相同格式的 key
 *
 * @example
 * ```ts
 * scoreMapKey({ id: 1, type: "dx", level_index: 3 }); // "1:dx:3"
 * ```
 */
export function scoreMapKey(score: {
  /** 曲目 id */
  id: number;
  /** 谱面类型 */
  type: SongType;
  /** 难度下标 */
  level_index: LevelIndex | number;
}): string {
  return chartMapKey(score.id, score.type, score.level_index);
}

/**
 * 从离散字段拼 key（与 {@link scoreMapKey} 结果一致）。
 *
 * @param songId - 曲目 id
 * @param type - 谱面类型（`standard` / `dx` / …）
 * @param difficulty - 难度下标（`LevelIndex` 或 number）
 * @returns `"{songId}:{type}:{difficulty}"`
 *
 * @example
 * ```ts
 * chartMapKey(11451, "dx", LevelIndex.MASTER); // "11451:dx:3"
 * ```
 */
export function chartMapKey(
  songId: number,
  type: SongType,
  difficulty: LevelIndex | number,
): string {
  return `${songId}:${type}:${difficulty}`;
}
