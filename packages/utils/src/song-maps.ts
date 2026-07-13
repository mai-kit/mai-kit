/**
 * 从曲目列表构建「谱面 key → 数值」索引（纯数据变换，无网络）。
 *
 * 结构与 `@mai-kit/database` 的 `Song` 兼容，但不依赖该包。
 * `@mai-kit/draw` 在出图时拿到 `getSongList` 结果后会调用这些函数。
 */

import { dxMaxFromNoteTotal } from "./dx-score";
import { chartMapKey } from "./score-key";
import type { LevelIndex, SongType } from "@mai-kit/shared";

/** 单谱面物量 / 定数最小字段 */
export interface DifficultyMeta {
  /** 难度下标（与 `LevelIndex` / `level_index` 一致） */
  difficulty: number;
  /** 精确定数，如 14.7 */
  level_value?: number;
  /** 物量；`total` 用于 DX 满分 */
  notes?: {
    /** 谱面 Note 总数 */
    total?: number;
  };
}

/** 曲目难度分组最小字段 */
export interface SongDifficultiesMeta {
  standard?: readonly DifficultyMeta[];
  dx?: readonly DifficultyMeta[];
}

/**
 * 曲目最小字段（与 database `Song` 结构化兼容）。
 *
 * @example
 * ```ts
 * const song: SongMeta = {
 *   id: 114,
 *   difficulties: {
 *     standard: [],
 *     dx: [{ difficulty: 3, level_value: 14.5, notes: { total: 761 } }],
 *   },
 * };
 * ```
 */
export interface SongMeta {
  id: number;
  difficulties: SongDifficultiesMeta;
}

/** 供 {@link findSongDifficulty} 使用的曲目难度列表形状 */
export interface DifficultyLists<
  TStandard extends DifficultyMeta = DifficultyMeta,
  TDx extends DifficultyMeta = DifficultyMeta,
  TUtage extends DifficultyMeta = DifficultyMeta,
> {
  difficulties: {
    standard: readonly TStandard[];
    dx: readonly TDx[];
    utage?: readonly TUtage[];
  };
}

/**
 * 按谱面类型与难度索引查找曲目难度，保留各类型的具体难度结构。
 *
 * @param song - 含 `difficulties.standard` / `dx` / 可选 `utage` 的曲目
 * @param type - 谱面类型
 * @param levelIndex - 难度下标
 * @returns 匹配的难度项；未找到为 `undefined`
 *
 * @example
 * ```ts
 * const master = findSongDifficulty(song, "dx", LevelIndex.MASTER);
 * console.log(master?.level_value);
 * ```
 */
export function findSongDifficulty<
  TStandard extends DifficultyMeta,
  TDx extends DifficultyMeta,
  TUtage extends DifficultyMeta,
>(
  song: DifficultyLists<TStandard, TDx, TUtage>,
  type: "standard",
  levelIndex: LevelIndex | number,
): TStandard | undefined;
export function findSongDifficulty<
  TStandard extends DifficultyMeta,
  TDx extends DifficultyMeta,
  TUtage extends DifficultyMeta,
>(
  song: DifficultyLists<TStandard, TDx, TUtage>,
  type: "dx",
  levelIndex: LevelIndex | number,
): TDx | undefined;
export function findSongDifficulty<
  TStandard extends DifficultyMeta,
  TDx extends DifficultyMeta,
  TUtage extends DifficultyMeta,
>(
  song: DifficultyLists<TStandard, TDx, TUtage>,
  type: "utage",
  levelIndex: LevelIndex | number,
): TUtage | undefined;
export function findSongDifficulty(
  song: DifficultyLists,
  type: SongType,
  levelIndex: LevelIndex | number,
): DifficultyMeta | undefined {
  return song.difficulties[type]?.find((difficulty) => difficulty.difficulty === levelIndex);
}

/**
 * 构建 `songId:type:difficulty → DX 满分` 映射。
 *
 * 满分 = `notes.total × 3`（见 {@link dxMaxFromNoteTotal}）。
 * 无物量或 `total ≤ 0` 的谱面不写入。
 *
 * @param songs - 曲目列表（通常来自 `getSongList({ notes: true })`）
 * @returns key 与 {@link chartMapKey} / {@link scoreMapKey} 一致
 *
 * @example
 * ```ts
 * const { songs } = await database.getSongList({ notes: true });
 * const dxMaxByChart = buildSongDxMaxMap(songs);
 * dxMaxByChart.get("114:dx:3");
 * ```
 */
export function buildSongDxMaxMap(songs: readonly SongMeta[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const song of songs) {
    for (const type of ["standard", "dx"] as const) {
      for (const diff of song.difficulties[type] ?? []) {
        const total = diff.notes?.total;
        if (total != null && total > 0) {
          map.set(chartMapKey(song.id, type, diff.difficulty), dxMaxFromNoteTotal(total));
        }
      }
    }
  }
  return map;
}

/**
 * 构建 `songId:type:difficulty → level_value` 映射。
 *
 * 无有效 `level_value` 的谱面不写入。
 *
 * @param songs - 曲目列表
 * @returns key 与 {@link chartMapKey} 一致；value 为精确定数
 *
 * @example
 * ```ts
 * const { songs } = await database.getSongList();
 * const levelByChart = buildSongLevelMap(songs);
 * levelByChart.get("114:dx:3");
 * ```
 */
export function buildSongLevelMap(songs: readonly SongMeta[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const song of songs) {
    for (const type of ["standard", "dx"] as const) {
      for (const diff of song.difficulties[type] ?? []) {
        if (diff.level_value != null && Number.isFinite(diff.level_value)) {
          map.set(chartMapKey(song.id, type, diff.difficulty), diff.level_value);
        }
      }
    }
  }
  return map;
}
