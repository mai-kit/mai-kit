import { LevelIndex } from "@mai-kit/shared";
import type { Notes, Song, SongDifficulty, SongList } from "../../models";

/**
 * Diving-Fish `/music_data` 数组元素（字段名与上游 JSON 一致）。
 *
 * @example
 * ```ts
 * const entry: DivingFishMusicEntry = {
 *   id: "11451",
 *   title: "曲名",
 *   type: "DX",
 *   ds: [4, 7, 10, 13, 14.7],
 *   level: ["4", "7", "10", "13", "14+"],
 *   charts: [{ notes: [100, 20, 10, 5, 2], charter: "Charter" }],
 *   basic_info: { artist: "艺术家", genre: "maimai", bpm: 180 },
 * };
 * ```
 */
export interface DivingFishMusicEntry {
  /** 曲目 id（上游多为字符串） */
  id: string | number;
  /** 曲名 */
  title: string;
  /** `DX` 或 `SD` */
  type: string;
  /** 各难度定数（Basic → Re:Master） */
  ds: number[];
  /** 各难度等级文案 */
  level: string[];
  /** 各难度谱面（含 notes / charter） */
  charts: Array<{ notes: number[]; charter?: string }>;
  /** 基础信息 */
  basic_info?: {
    /** 上游基础信息中的曲名 */
    title?: string;
    /** 艺术家 */
    artist?: string;
    /** 流派 */
    genre?: string;
    /** BPM */
    bpm?: number;
    /** 收录版本原文 */
    from?: string;
    /** 是否当前版本新曲 */
    is_new?: boolean;
  };
}

/**
 * 封面文件名用 id：不足 5 位补零；10001–11000 的 DX 与 SD 共封面时用 id−10000。
 *
 * @param songId - 曲目 id
 * @returns 如 `00038`、`11235`
 * @see https://maimai.diving-fish.com/manual/docs/developer/zh-api-document/
 *
 * @example
 * ```ts
 * divingFishCoverId(38); // "00038"
 * divingFishCoverId(10038); // "00038"
 * ```
 */
export function divingFishCoverId(songId: number): string {
  let mid = Math.trunc(songId);
  if (mid > 10_000 && mid <= 11_000) mid -= 10_000;
  return String(mid).padStart(5, "0");
}

/**
 * 谱面类型原文 → 通用 `standard` / `dx`。
 *
 * @param type - 上游 `DX` / `SD`
 * @returns 通用谱面类型
 */
export function mapDivingFishSongType(type: string): "standard" | "dx" {
  return type.trim().toUpperCase() === "DX" ? "dx" : "standard";
}

/**
 * @param noteList - 上游 notes 数组
 * @param isDx - 是否 DX（5 元组含 touch）
 * @returns 通用 {@link Notes}；无数据时为 `undefined`
 */
function mapNotes(noteList: number[] | undefined, isDx: boolean): Notes | undefined {
  if (!noteList || noteList.length === 0) return undefined;
  if (isDx && noteList.length >= 5) {
    const [tap, hold, slide, touch, brk] = noteList;
    const total = tap + hold + slide + touch + brk;
    return { total, tap, hold, slide, touch, break: brk };
  }
  const [tap = 0, hold = 0, slide = 0, brk = 0] = noteList;
  const total = tap + hold + slide + brk;
  return { total, tap, hold, slide, touch: 0, break: brk };
}

/**
 * @param entry - music_data 单项
 * @param includeNotes - 是否填充 `notes`
 * @returns 该 type 下的难度列表
 */
function mapDifficulties(entry: DivingFishMusicEntry, includeNotes: boolean): SongDifficulty[] {
  const isDx = mapDivingFishSongType(entry.type) === "dx";
  const list: SongDifficulty[] = [];
  const count = Math.max(
    entry.ds?.length ?? 0,
    entry.level?.length ?? 0,
    entry.charts?.length ?? 0,
  );
  const maxDifficultyIndex: number = LevelIndex.RE_MASTER;
  for (let i = 0; i < count; i++) {
    if (i > maxDifficultyIndex) break;
    const notes = includeNotes ? mapNotes(entry.charts?.[i]?.notes, isDx) : undefined;
    list.push({
      type: isDx ? "dx" : "standard",
      difficulty: i,
      level: entry.level?.[i] ?? String(entry.ds?.[i] ?? ""),
      level_value: entry.ds?.[i] ?? 0,
      note_designer: entry.charts?.[i]?.charter ?? "",
      version: 0,
      ...(notes ? { notes } : {}),
    });
  }
  return list;
}

/**
 * 将 `/music_data` 数组映射为通用 {@link SongList}。
 *
 * 同一 `id` 的 SD / DX 会合并进一首 `Song` 的 `difficulties.standard` / `dx`。
 * `genres` / `versions` 水鱼响应无对等结构，返回空数组。
 *
 * @param entries - 上游 music_data 数组
 * @param options - `notes: true` 时填充物量（供 draw 算 `dx_max`）
 * @returns 通用曲目列表
 *
 * @example
 * ```ts
 * const result = mapDivingFishMusicDataToSongList(entries, { notes: true });
 * console.log(result.songs[0]?.difficulties.dx);
 * ```
 */
export function mapDivingFishMusicDataToSongList(
  entries: readonly DivingFishMusicEntry[],
  options?: {
    /** 是否在返回谱面中填充 Note 物量 */
    notes?: boolean;
  },
): SongList {
  const includeNotes = Boolean(options?.notes);
  const byId = new Map<number, Song>();

  for (const entry of entries) {
    const id = Number(entry.id);
    if (!Number.isFinite(id)) continue;
    const songType = mapDivingFishSongType(entry.type);
    const diffs = mapDifficulties(entry, includeNotes);
    const existing = byId.get(id);
    if (existing) {
      if (songType === "dx") existing.difficulties.dx = diffs;
      else existing.difficulties.standard = diffs;
      continue;
    }
    byId.set(id, {
      id,
      title: entry.basic_info?.title ?? entry.title,
      artist: entry.basic_info?.artist ?? "",
      genre: entry.basic_info?.genre ?? "",
      bpm: entry.basic_info?.bpm ?? 0,
      version: 0,
      difficulties: {
        standard: songType === "standard" ? diffs : [],
        dx: songType === "dx" ? diffs : [],
      },
    });
  }

  return {
    songs: [...byId.values()].sort((a, b) => a.id - b.id),
    genres: [],
    versions: [],
  };
}
