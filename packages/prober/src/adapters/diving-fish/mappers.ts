import { LevelIndex } from "@mai-kit/shared";
import type { FCType, FSType, RateType, SongType } from "@mai-kit/shared";
import type { Bests, PlayerProfile, Score } from "../../models";
import type { DivingFishPlayerPayload, DivingFishRecord } from "./types";

const RATE_CODES = [
  "sssp",
  "sss",
  "ssp",
  "ss",
  "sp",
  "s",
  "aaa",
  "aa",
  "a",
  "bbb",
  "bb",
  "b",
  "c",
  "d",
] as const satisfies readonly RateType[];

const FC_CODES = ["app", "ap", "fcp", "fc"] as const satisfies readonly FCType[];
const FS_CODES = ["fsdp", "fsd", "fsp", "fs", "sync"] as const satisfies readonly FSType[];

const RATE_SET: ReadonlySet<string> = new Set(RATE_CODES);
const FC_SET: ReadonlySet<string> = new Set(FC_CODES);
const FS_SET: ReadonlySet<string> = new Set(FS_CODES);

function isRateType(value: string): value is RateType {
  return RATE_SET.has(value);
}

function isFcType(value: string): value is FCType {
  return FC_SET.has(value);
}

function isFsType(value: string): value is FSType {
  return FS_SET.has(value);
}

/**
 * 谱面类型原文 → 通用 `SongType`。
 *
 * @param type - 上游 `DX` / `SD` 等
 * @returns `dx` 或 `standard`（无法识别时按 standard）
 */
export function mapDivingFishSongType(type: string): SongType {
  const t = type.trim().toUpperCase();
  if (t === "DX") return "dx";
  if (t === "SD" || t === "STANDARD") return "standard";
  // Diving-Fish 无 utage 成绩类型
  return "standard";
}

/**
 * 评级原文 → `RateType`。
 *
 * @param rate - 如 `sssp`、`aa`
 * @returns 合法评级；无法识别时为 `undefined`
 */
export function mapDivingFishRate(rate: string): RateType | undefined {
  const key = rate.trim().toLowerCase();
  return isRateType(key) ? key : undefined;
}

/**
 * FC 原文 → `FCType` 或 `null`。
 *
 * @param fc - `fc`/`fcp`/`ap`/`app` 或空串
 * @returns 合法 FC；空或未知为 `null`
 */
export function mapDivingFishFc(fc: string): FCType | null {
  if (!fc) return null;
  const key = fc.trim().toLowerCase();
  return isFcType(key) ? key : null;
}

/**
 * FS 原文 → `FSType` 或 `null`。
 *
 * @param fs - `sync`/`fs`/`fsp`/`fsd`/`fsdp` 或空串
 * @returns 合法 FS；空或未知为 `null`
 */
export function mapDivingFishFs(fs: string): FSType | null {
  if (!fs) return null;
  const key = fs.trim().toLowerCase();
  return isFsType(key) ? key : null;
}

/**
 * 单曲成绩 → 通用 {@link Score}（可供 draw 使用）。
 *
 * @param record - 上游 records / charts 项
 * @returns 通用成绩
 *
 * @example
 * ```ts
 * const score = mapDivingFishRecord(record);
 * console.log(score.id, score.level_index, score.achievements);
 * ```
 */
export function mapDivingFishRecord(record: DivingFishRecord): Score {
  const idx = record.level_index;
  const levelIndex: LevelIndex =
    idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4 ? idx : LevelIndex.BASIC;

  return {
    id: record.song_id,
    song_name: record.title,
    level: record.level,
    level_index: levelIndex,
    achievements: record.achievements,
    fc: mapDivingFishFc(record.fc),
    fs: mapDivingFishFs(record.fs),
    dx_score: record.dxScore,
    dx_rating: record.ra,
    rate: mapDivingFishRate(record.rate),
    type: mapDivingFishSongType(record.type),
  };
}

/**
 * 玩家顶栏字段 → 通用 {@link PlayerProfile}。
 *
 * @param payload - 上游玩家载荷
 * @param friendCode - 无好友码时填 `0`；有 QQ 查询时可传入 QQ 数字
 * @returns 通用档案（`class_rank` / `star` 水鱼无对等字段，置 0）
 */
export function mapDivingFishProfile(
  payload: DivingFishPlayerPayload,
  friendCode = 0,
): PlayerProfile {
  const plate = payload.plate?.trim();
  return {
    name: payload.nickname?.trim() || payload.username?.trim() || "Player",
    rating: payload.rating,
    friend_code: friendCode,
    course_rank: payload.additional_rating ?? 0,
    class_rank: 0,
    star: 0,
    trophy: plate ? { id: 0, name: plate } : undefined,
  };
}

/**
 * @param scores - 成绩列表
 * @returns `dx_rating` 合计
 */
function sumRating(scores: readonly Score[]): number {
  return scores.reduce((sum, s) => sum + (s.dx_rating ?? 0), 0);
}

/**
 * 从公开 `query/player` 的 `charts.dx` / `charts.sd` 组装 {@link Bests}。
 *
 * @param payload - 含 `charts` 的查询结果
 * @returns Best50（新 15 + 旧 35）
 */
export function mapDivingFishBestsFromCharts(payload: DivingFishPlayerPayload): Bests {
  const dx = (payload.charts?.dx ?? []).map(mapDivingFishRecord);
  const standard = (payload.charts?.sd ?? []).map(mapDivingFishRecord);
  return {
    dx,
    standard,
    dx_total: sumRating(dx),
    standard_total: sumRating(standard),
    dx_selections: [],
    standard_selections: [],
  };
}

/**
 * 从完整 `records` 按是否新曲拆 B15 / B35，并按单曲 Rating 降序截取。
 *
 * @param records - 完整成绩列表
 * @param isNewSong - `song_id` → 是否当前版本新曲（通常来自 `/music_data`）
 * @returns Best50
 */
export function mapDivingFishBestsFromRecords(
  records: readonly DivingFishRecord[],
  isNewSong: ReadonlyMap<number, boolean>,
): Bests {
  const newScores: Score[] = [];
  const oldScores: Score[] = [];
  for (const record of records) {
    const score = mapDivingFishRecord(record);
    if (isNewSong.get(score.id)) newScores.push(score);
    else oldScores.push(score);
  }
  const byRaDesc = (a: Score, b: Score) => (b.dx_rating ?? 0) - (a.dx_rating ?? 0);
  newScores.sort(byRaDesc);
  oldScores.sort(byRaDesc);
  const dx = newScores.slice(0, 15);
  const standard = oldScores.slice(0, 35);
  return {
    dx,
    standard,
    dx_total: sumRating(dx),
    standard_total: sumRating(standard),
    dx_selections: [],
    standard_selections: [],
  };
}
