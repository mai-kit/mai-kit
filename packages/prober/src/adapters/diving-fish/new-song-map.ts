import type { DivingFishHttp } from "./http";

let cache: Promise<ReadonlyMap<number, boolean>> | undefined;

/**
 * 构建 `song_id → 是否当前版本新曲` 映射（来自 `/music_data`，进程内缓存）。
 *
 * @param http - Diving-Fish HTTP 客户端
 * @returns 只读 Map；`true` 表示新曲（计入 B15）
 * @throws {DivingFishProberError} 拉取 `music_data` 失败时
 */
export async function getDivingFishIsNewMap(
  http: DivingFishHttp,
): Promise<ReadonlyMap<number, boolean>> {
  cache ??= load(http);
  return cache;
}

/**
 * 清空 `is_new` 映射缓存（测试用）。
 *
 * @internal
 */
export function resetDivingFishIsNewMapCache(): void {
  cache = undefined;
}

/**
 * @param http - HTTP 客户端
 * @returns 新曲映射
 */
async function load(http: DivingFishHttp): Promise<ReadonlyMap<number, boolean>> {
  const raw = await http.musicData();
  const map = new Map<number, boolean>();
  if (!isUnknownArray(raw)) return map;
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const id = Number("id" in item ? item.id : undefined);
    if (!Number.isFinite(id)) continue;
    const basic = "basic_info" in item ? item.basic_info : undefined;
    const isNew =
      typeof basic === "object" && basic !== null && "is_new" in basic && Boolean(basic.is_new);
    map.set(id, isNew);
  }
  return map;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
