import type { DivingFishHttp } from "./http";
import { DivingFishProberError } from "./error";

let cache = new WeakMap<DivingFishHttp, Promise<ReadonlyMap<number, boolean>>>();

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
  const existing = cache.get(http);
  if (existing) return existing;
  const pending = load(http);
  cache.set(http, pending);
  return pending;
}

/**
 * 清空 `is_new` 映射缓存（测试用）。
 *
 * @internal
 */
export function resetDivingFishIsNewMapCache(): void {
  cache = new WeakMap();
}

/**
 * @param http - HTTP 客户端
 * @returns 新曲映射
 */
async function load(http: DivingFishHttp): Promise<ReadonlyMap<number, boolean>> {
  const entries = await http.musicData();
  const map = new Map<number, boolean>();
  for (const item of entries) {
    const id = Number(item.id);
    if (!Number.isSafeInteger(id)) throw invalidMusicData();
    const isNew = item.basic_info.is_new;
    const existing = map.get(id);
    if (existing !== undefined && existing !== isNew) {
      throw new DivingFishProberError({
        message: `Diving-Fish music_data has conflicting is_new values for id=${id}`,
      });
    }
    map.set(id, isNew);
  }
  return map;
}

function invalidMusicData(): DivingFishProberError {
  return new DivingFishProberError({
    message: "Diving-Fish music_data: unexpected response structure",
  });
}
