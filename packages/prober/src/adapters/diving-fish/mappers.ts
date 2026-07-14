import { LevelIndex } from "@mai-kit/shared";
import type { FCType, FSType, RateType, SongType } from "@mai-kit/shared";
import type { Bests, PlayerProfile, Score } from "../../models";
import type {
  DivingFishPlayerPayload,
  DivingFishRecord,
  DivingFishVersionRecord,
  DivingFishVersionScore,
} from "./types";
import { DivingFishProberError } from "./error";

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
 * @returns `dx` 或 `standard`
 * @throws {DivingFishProberError} 无法识别的类型
 */
export function mapDivingFishSongType(
  type: string,
  songId?: number,
  levelLabel?: string,
): SongType {
  if (songId !== undefined && songId >= 100_000) return "utage";
  if (levelLabel?.trim().toLowerCase() === "utage") return "utage";
  const t = type.trim().toUpperCase();
  if (t === "DX") return "dx";
  if (t === "SD" || t === "STANDARD") return "standard";
  throw invalidField("record.type", type);
}

/**
 * 评级原文 → `RateType`。
 *
 * @param rate - 如 `sssp`、`aa`
 * @returns 合法评级
 * @throws {DivingFishProberError} 无法识别的评级
 */
export function mapDivingFishRate(rate: string): RateType {
  const key = rate.trim().toLowerCase();
  if (isRateType(key)) return key;
  throw invalidField("record.rate", rate);
}

/**
 * FC 原文 → `FCType` 或 `null`。
 *
 * @param fc - `fc`/`fcp`/`ap`/`app` 或空串
 * @returns 合法 FC；空值为 `null`
 * @throws {DivingFishProberError} 非空但无法识别的 FC
 */
export function mapDivingFishFc(fc: string): FCType | null {
  const key = fc.trim().toLowerCase();
  if (!key) return null;
  if (isFcType(key)) return key;
  throw invalidField("record.fc", fc);
}

/**
 * FS 原文 → `FSType` 或 `null`。
 *
 * @param fs - `sync`/`fs`/`fsp`/`fsd`/`fsdp` 或空串
 * @returns 合法 FS；空值为 `null`
 * @throws {DivingFishProberError} 非空但无法识别的 FS
 */
export function mapDivingFishFs(fs: string): FSType | null {
  const key = fs.trim().toLowerCase();
  if (!key) return null;
  if (isFsType(key)) return key;
  throw invalidField("record.fs", fs);
}

/**
 * 单曲成绩 → 通用 {@link Score}（可供 draw 使用）。
 *
 * @param record - 上游 records / charts 项
 * @returns 通用成绩
 * @throws {DivingFishProberError} 必填成绩字段非法或枚举值无法识别
 *
 * @example
 * ```ts
 * const score = mapDivingFishRecord(record);
 * console.log(score.id, score.level_index, score.achievements);
 * ```
 */
export function mapDivingFishRecord(record: DivingFishRecord): Score & { dx_rating: number } {
  assertFiniteNumber(record.song_id, "record.song_id");
  assertFiniteNumber(record.achievements, "record.achievements");
  assertFiniteNumber(record.dxScore, "record.dxScore");
  assertFiniteNumber(record.ra, "record.ra");
  const title = record.title.trim();

  const levelIndex = mapLevelIndex(record.level_index, "record.level_index");

  return {
    id: record.song_id,
    ...(title ? { song_name: title } : {}),
    level: record.level,
    level_index: levelIndex,
    achievements: record.achievements,
    fc: mapDivingFishFc(record.fc),
    fs: mapDivingFishFs(record.fs),
    dx_score: record.dxScore,
    dx_rating: record.ra,
    rate: mapDivingFishRate(record.rate),
    type: mapDivingFishSongType(record.type, record.song_id, record.level_label),
  };
}

/** `/query/plate` 的精简版本成绩 → 适配公开模型。 */
export function mapDivingFishVersionRecord(
  record: DivingFishVersionRecord,
): DivingFishVersionScore {
  assertFiniteNumber(record.id, "version_record.id");
  assertFiniteNumber(record.achievements, "version_record.achievements");
  const title = record.title.trim();
  if (!title) throw invalidField("version_record.title", record.title);
  return {
    id: record.id,
    song_name: title,
    level: record.level,
    level_index: mapLevelIndex(record.level_index, "version_record.level_index"),
    type: mapDivingFishSongType(record.type, record.id),
    achievements: record.achievements,
    fc: mapDivingFishFc(record.fc),
    fs: mapDivingFishFs(record.fs),
  };
}

/**
 * 玩家顶栏字段 → 通用 {@link PlayerProfile}。
 *
 * @param payload - 上游玩家载荷
 * @returns 仅包含水鱼实际提供字段的通用档案
 * @throws {DivingFishProberError} 缺少昵称或 Rating 非法
 */
export function mapDivingFishProfile(payload: DivingFishPlayerPayload): PlayerProfile {
  assertFiniteNumber(payload.rating, "player.rating");
  const name = payload.nickname?.trim() || payload.username?.trim();
  if (!name) throw new DivingFishProberError({ message: "Diving-Fish player name is missing" });
  if (payload.additional_rating !== undefined) {
    assertFiniteNumber(payload.additional_rating, "player.additional_rating");
  }
  const plate = payload.plate?.trim();
  return {
    name,
    rating: payload.rating,
    ...(payload.additional_rating !== undefined ? { course_rank: payload.additional_rating } : {}),
    ...(plate ? { trophy: { name: plate } } : {}),
  };
}

/**
 * @param scores - 成绩列表
 * @returns `dx_rating` 合计
 */
function sumRating(scores: readonly (Score & { dx_rating: number })[]): number {
  return scores.reduce((sum, score) => sum + score.dx_rating, 0);
}

/**
 * 从公开 `query/player` 的 `charts.dx` / `charts.sd` 组装 {@link Bests}。
 *
 * @param payload - 含 `charts` 的查询结果
 * @returns Best50（新 15 + 旧 35）
 * @throws {DivingFishProberError} B50 分组缺失或任一成绩字段非法
 */
export function mapDivingFishBestsFromCharts(payload: DivingFishPlayerPayload): Bests {
  if (!payload.charts || !Array.isArray(payload.charts.dx) || !Array.isArray(payload.charts.sd)) {
    throw new DivingFishProberError({
      message: "Diving-Fish query/player response is missing charts.dx or charts.sd",
    });
  }
  const dx = payload.charts.dx.map(mapDivingFishRecord);
  const standard = payload.charts.sd.map(mapDivingFishRecord);
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
 * @throws {DivingFishProberError} 曲目新旧分类缺失或任一成绩字段非法
 */
export function mapDivingFishBestsFromRecords(
  records: readonly DivingFishRecord[],
  isNewSong: ReadonlyMap<number, boolean>,
): Bests {
  type RatedScore = { score: Score & { dx_rating: number }; ds: number };
  const newScores: RatedScore[] = [];
  const oldScores: RatedScore[] = [];
  for (const record of records) {
    // 官方 B50 查询明确排除宴会场；完整 records 中仍会包含这些成绩。
    if (record.song_id >= 100_000) continue;
    const score = mapDivingFishRecord(record);
    const isNew = isNewSong.get(score.id);
    if (isNew === undefined) {
      throw new DivingFishProberError({
        message: `Diving-Fish music_data is missing song id=${score.id}`,
      });
    }
    const item = { score, ds: record.ds };
    if (isNew) newScores.push(item);
    else oldScores.push(item);
  }
  const byRaDesc = (a: RatedScore, b: RatedScore): number =>
    b.score.dx_rating - a.score.dx_rating ||
    b.ds - a.ds ||
    b.score.achievements - a.score.achievements;
  newScores.sort(byRaDesc);
  oldScores.sort(byRaDesc);
  const dx = newScores.slice(0, 15).map(({ score }) => score);
  const standard = oldScores.slice(0, 35).map(({ score }) => score);
  return {
    dx,
    standard,
    dx_total: sumRating(dx),
    standard_total: sumRating(standard),
    dx_selections: [],
    standard_selections: [],
  };
}

function mapLevelIndex(value: number, field: string): LevelIndex {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3 && value !== 4) {
    throw invalidField(field, value);
  }
  return value;
}

function assertFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) throw invalidField(field, value);
}

function invalidField(field: string, value: unknown): DivingFishProberError {
  return new DivingFishProberError({
    message: `Diving-Fish ${field} has an invalid value: ${String(value)}`,
  });
}
