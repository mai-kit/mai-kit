import { LevelIndex } from "@mai-kit/shared";
import type { FCType, FSType, RateType, SongType } from "@mai-kit/shared";
import type { Bests, PlayerProfile, Score } from "../../models";
import { DivingFishProberError } from "./error";
import type {
  DivingFishPlayerPayload,
  DivingFishQueryPlayerPayload,
  DivingFishRecord,
  DivingFishVersionRecord,
} from "./schemas";
import type { DivingFishVersionScore } from "./types";

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

/** 上游谱面类型 → 通用 `SongType`。 */
export function mapDivingFishSongType(
  type: string,
  songId?: number,
  levelLabel?: string,
): SongType {
  if (songId !== undefined && songId >= 100_000) return "utage";
  if (levelLabel?.trim().toLowerCase() === "utage") return "utage";
  const normalized = type.trim().toUpperCase();
  if (normalized === "DX") return "dx";
  if (normalized === "SD" || normalized === "STANDARD") return "standard";
  throw invalidField("record.type", type);
}

/** 上游评级码 → 通用 `RateType`。 */
export function mapDivingFishRate(rate: string): RateType {
  const key = rate.trim().toLowerCase();
  if (isRateType(key)) return key;
  throw invalidField("record.rate", rate);
}

/** 上游 FC 码 → 通用 `FCType`；空串为 `null`。 */
export function mapDivingFishFc(fc: string): FCType | null {
  const key = fc.trim().toLowerCase();
  if (!key) return null;
  if (isFcType(key)) return key;
  throw invalidField("record.fc", fc);
}

/** 上游 FS 码 → 通用 `FSType`；空串为 `null`。 */
export function mapDivingFishFs(fs: string): FSType | null {
  const key = fs.trim().toLowerCase();
  if (!key) return null;
  if (isFsType(key)) return key;
  throw invalidField("record.fs", fs);
}

/** 单条上游成绩 → 通用成绩。 */
export function mapDivingFishRecord(record: DivingFishRecord): Score & { dx_rating: number } {
  assertFiniteNumber(record.song_id, "record.song_id");
  assertFiniteNumber(record.achievements, "record.achievements");
  assertFiniteNumber(record.dxScore, "record.dxScore");
  assertFiniteNumber(record.ra, "record.ra");
  const title = record.title;

  return {
    id: record.song_id,
    ...(title.length > 0 ? { song_name: title } : {}),
    level: record.level,
    level_index: mapLevelIndex(record.level_index, "record.level_index"),
    achievements: record.achievements,
    fc: mapDivingFishFc(record.fc),
    fs: mapDivingFishFs(record.fs),
    dx_score: record.dxScore,
    dx_rating: record.ra,
    rate: mapDivingFishRate(record.rate),
    type: mapDivingFishSongType(record.type, record.song_id, record.level_label),
  };
}

/** `/query/plate` 的精简成绩 → 适配公开模型。 */
export function mapDivingFishVersionRecord(
  record: DivingFishVersionRecord,
): DivingFishVersionScore {
  assertFiniteNumber(record.id, "version_record.id");
  assertFiniteNumber(record.achievements, "version_record.achievements");
  const title = record.title;
  if (title.length === 0) throw invalidField("version_record.title", record.title);
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

/** 玩家顶栏字段 → 通用档案。 */
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

/** 公开 B50 的 `charts.dx` / `charts.sd` → 通用 Best50。 */
export function mapDivingFishBestsFromCharts(payload: DivingFishQueryPlayerPayload): Bests {
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

/** 完整 records 按 `is_new` 重算 B15 / B35。 */
export function mapDivingFishBestsFromRecords(
  records: readonly DivingFishRecord[],
  isNewSong: ReadonlyMap<number, boolean>,
): Bests {
  type RatedScore = { score: Score & { dx_rating: number }; ds: number };
  const newScores: RatedScore[] = [];
  const oldScores: RatedScore[] = [];
  for (const record of records) {
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

function sumRating(scores: readonly (Score & { dx_rating: number })[]): number {
  return scores.reduce((sum, score) => sum + score.dx_rating, 0);
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
