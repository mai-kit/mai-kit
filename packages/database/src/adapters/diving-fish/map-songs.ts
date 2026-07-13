import { LevelIndex } from "@mai-kit/shared";
import type { Notes, Song, SongDifficulty, SongList } from "../../models";
import { DivingFishDatabaseError } from "./error";

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
  /** 曲目 id（上游为整数；映射器同时接受数字字符串） */
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
 * @throws {DivingFishDatabaseError} 无法识别的类型
 */
export function mapDivingFishSongType(type: string): "standard" | "dx" {
  if (typeof type !== "string") throw invalidField("music_data.type", type);
  const normalized = type.trim().toUpperCase();
  if (normalized === "DX") return "dx";
  if (normalized === "SD" || normalized === "STANDARD") return "standard";
  throw invalidField("music_data.type", type);
}

/**
 * @param noteList - 上游 notes 数组
 * @param isDx - 是否 DX（5 元组含 touch）
 * @returns 通用 {@link Notes}
 * @throws {DivingFishDatabaseError} 物量长度、类型或数值非法
 */
function mapNotes(noteList: readonly number[], isDx: boolean): Notes {
  const expectedLength = isDx ? 5 : 4;
  if (noteList.length !== expectedLength || !noteList.every(isNonNegativeInteger)) {
    throw invalidField("music_data.charts[].notes", noteList);
  }
  if (isDx) {
    const [tap, hold, slide, touch, brk] = noteList;
    const total = tap + hold + slide + touch + brk;
    return { total, tap, hold, slide, touch, break: brk };
  }
  const [tap, hold, slide, brk] = noteList;
  const total = tap + hold + slide + brk;
  return { total, tap, hold, slide, touch: 0, break: brk };
}

/**
 * @param entry - music_data 单项
 * @param includeNotes - 是否填充 `notes`
 * @returns 该 type 下的难度列表
 * @throws {DivingFishDatabaseError} 难度数组、等级、谱面或物量字段非法
 */
function mapDifficulties(entry: DivingFishMusicEntry, includeNotes: boolean): SongDifficulty[] {
  const isDx = mapDivingFishSongType(entry.type) === "dx";
  if (
    !Array.isArray(entry.ds) ||
    !Array.isArray(entry.level) ||
    !Array.isArray(entry.charts) ||
    entry.ds.length === 0 ||
    entry.ds.length !== entry.level.length ||
    entry.ds.length !== entry.charts.length
  ) {
    throw invalidField(`music_data[${String(entry.id)}].difficulties`, {
      ds: entry.ds,
      level: entry.level,
      charts: entry.charts,
    });
  }
  const list: SongDifficulty[] = [];
  const difficulties = [
    LevelIndex.BASIC,
    LevelIndex.ADVANCED,
    LevelIndex.EXPERT,
    LevelIndex.MASTER,
    LevelIndex.RE_MASTER,
  ] as const;
  if (entry.ds.length > difficulties.length) {
    throw invalidField(`music_data[${String(entry.id)}].difficulty_count`, entry.ds.length);
  }
  for (let i = 0; i < entry.ds.length; i += 1) {
    const levelValue = entry.ds[i];
    const level = requiredTrimmedString(
      entry.level[i],
      `music_data[${String(entry.id)}].level[${i}]`,
    );
    const difficulty = difficulties[i];
    if (!Number.isFinite(levelValue) || difficulty === undefined) {
      throw invalidField(`music_data[${String(entry.id)}].difficulty[${i}]`, {
        level,
        levelValue,
      });
    }
    const chart = entry.charts[i];
    if (!chart || typeof chart !== "object") {
      throw invalidField(`music_data[${String(entry.id)}].charts[${i}]`, chart);
    }
    const notes = mapNotes(chart.notes, isDx);
    const noteDesigner = optionalTrimmedString(
      chart.charter,
      `music_data[${String(entry.id)}].charts[${i}].charter`,
    );
    const mapped: SongDifficulty = {
      type: isDx ? "dx" : "standard",
      difficulty,
      level,
      level_value: levelValue,
      ...(includeNotes ? { notes } : {}),
      ...(noteDesigner ? { note_designer: noteDesigner } : {}),
    };
    list.push(mapped);
  }
  return list;
}

/**
 * 将 `/music_data` 数组映射为通用 {@link SongList}。
 *
 * 若输入中同一 `id` 分别出现 SD / DX，则合并进一首 `Song` 的
 * `difficulties.standard` / `dx`。
 * `genres` / `versions` 水鱼响应无对等结构，因此结果中省略。
 *
 * @param entries - 上游 music_data 数组
 * @param options - `notes: true` 时填充物量（供 draw 算 `dx_max`）
 * @returns 通用曲目列表
 * @throws {DivingFishDatabaseError} 任一曲目或谱面字段不符合上游结构
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
    assertDivingFishMusicEntry(entry);
    if (typeof entry.id === "string" && entry.id.trim().length === 0) {
      throw invalidField("music_data.id", entry.id);
    }
    const id = Number(entry.id);
    if (!Number.isSafeInteger(id) || id < 0) {
      throw invalidField("music_data.id", entry.id);
    }
    const songType = mapDivingFishSongType(entry.type);
    const diffs = mapDifficulties(entry, includeNotes);
    const title = requiredTrimmedString(
      entry.basic_info?.title ?? entry.title,
      `music_data[${id}].title`,
    );
    const existing = byId.get(id);
    if (existing) {
      const target = existing.difficulties[songType];
      if (target.length > 0) {
        throw new DivingFishDatabaseError({
          message: `Diving-Fish music_data contains duplicate ${songType} entry for id=${id}`,
        });
      }
      existing.difficulties[songType] = diffs;
      continue;
    }
    const artist = optionalTrimmedString(
      entry.basic_info?.artist,
      `music_data[${id}].basic_info.artist`,
    );
    const genre = optionalTrimmedString(
      entry.basic_info?.genre,
      `music_data[${id}].basic_info.genre`,
    );
    const bpm = entry.basic_info?.bpm;
    if (bpm !== undefined && !Number.isFinite(bpm)) {
      throw invalidField(`music_data[${id}].basic_info.bpm`, bpm);
    }
    const song: Song = {
      id,
      title,
      ...(artist ? { artist } : {}),
      ...(genre ? { genre } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      difficulties: {
        standard: songType === "standard" ? diffs : [],
        dx: songType === "dx" ? diffs : [],
      },
    };
    byId.set(id, song);
  }

  return {
    songs: [...byId.values()].sort((a, b) => a.id - b.id),
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertDivingFishMusicEntry(value: unknown): asserts value is DivingFishMusicEntry {
  if (!isRecord(value)) throw invalidField("music_data[]", value);
  if (typeof value.id !== "string" && typeof value.id !== "number") {
    throw invalidField("music_data.id", value.id);
  }
  if (typeof value.title !== "string") throw invalidField("music_data.title", value.title);
  if (typeof value.type !== "string") throw invalidField("music_data.type", value.type);
  if (!Array.isArray(value.ds) || !value.ds.every((item) => typeof item === "number")) {
    throw invalidField("music_data.ds", value.ds);
  }
  if (!Array.isArray(value.level) || !value.level.every((item) => typeof item === "string")) {
    throw invalidField("music_data.level", value.level);
  }
  if (!Array.isArray(value.charts) || !value.charts.every(isDivingFishChart)) {
    throw invalidField("music_data.charts", value.charts);
  }
  if (value.basic_info !== undefined && !isDivingFishBasicInfo(value.basic_info)) {
    throw invalidField("music_data.basic_info", value.basic_info);
  }
}

function isDivingFishChart(value: unknown): value is DivingFishMusicEntry["charts"][number] {
  return (
    isRecord(value) &&
    Array.isArray(value.notes) &&
    value.notes.every((item) => typeof item === "number") &&
    (value.charter === undefined || typeof value.charter === "string")
  );
}

function isDivingFishBasicInfo(
  value: unknown,
): value is NonNullable<DivingFishMusicEntry["basic_info"]> {
  return (
    isRecord(value) &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.artist === undefined || typeof value.artist === "string") &&
    (value.genre === undefined || typeof value.genre === "string") &&
    (value.bpm === undefined || typeof value.bpm === "number") &&
    (value.from === undefined || typeof value.from === "string") &&
    (value.is_new === undefined || typeof value.is_new === "boolean")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredTrimmedString(value: unknown, field: string): string {
  if (typeof value !== "string") throw invalidField(field, value);
  const text = value.trim();
  if (!text) throw invalidField(field, value);
  return text;
}

function optionalTrimmedString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw invalidField(field, value);
  return value.trim() || undefined;
}

function invalidField(field: string, value: unknown): DivingFishDatabaseError {
  return new DivingFishDatabaseError({
    message: `Diving-Fish ${field} has an invalid value: ${formatInvalidValue(value)}`,
  });
}

function formatInvalidValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
