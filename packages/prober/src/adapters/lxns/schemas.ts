import * as z from "zod/mini";
import type {
  Bests,
  Collection,
  CollectionRequired,
  FSType,
  Heatmap,
  PlayerCollection,
  PlayerProfile,
  RatingTrend,
  Score,
  ScoreHistory,
  ScoreRankingEntry,
  SimpleScore,
} from "../../models";
import type { LxnsYearInReview } from "./lxns-player";

const songTypeSchema = z.literal(["standard", "dx", "utage"]);
const levelIndexSchema = z.literal([0, 1, 2, 3, 4]);
const fcTypeSchema = z.literal(["app", "ap", "fcp", "fc"]);
const fsTypeSchema = z.literal(["fsdp", "fsd", "fsp", "fs", "sync"]);
const rateTypeSchema = z.literal([
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
]);

const collectionRequiredSongSchema = z.object({
  id: z.int(),
  title: z.string(),
  type: songTypeSchema,
  completed: z.optional(z.boolean()),
  completed_difficulties: z.optional(z.array(levelIndexSchema)),
});

const lxnsCollectionRequiredSchema = z.object({
  difficulties: z.optional(z.array(levelIndexSchema)),
  rate: z.optional(rateTypeSchema),
  fc: z.optional(z.union([fcTypeSchema, fsTypeSchema])),
  fs: z.optional(fsTypeSchema),
  songs: z.optional(z.array(collectionRequiredSongSchema)),
  completed: z.optional(z.boolean()),
});

type LxnsCollectionRequired = z.infer<typeof lxnsCollectionRequiredSchema>;

const collectionRequiredSchema = z.pipe(
  lxnsCollectionRequiredSchema,
  z.transform((required, context): CollectionRequired => {
    if (
      required.fc !== undefined &&
      isFsType(required.fc) &&
      required.fs !== undefined &&
      required.fs !== required.fc
    ) {
      context.issues.push({
        code: "custom",
        input: required,
        message: "LXNS collection requirement has conflicting fc/fs values",
        path: ["fs"],
      });
      return z.NEVER;
    }
    return normalizeLxnsCollectionRequired(required);
  }),
) satisfies z.ZodMiniType<CollectionRequired>;

export const collectionSchema = z.object({
  id: z.int(),
  name: z.string(),
  color: z.optional(z.string()),
  description: z.optional(z.string()),
  genre: z.optional(z.string()),
  required: z.optional(z.array(collectionRequiredSchema)),
}) satisfies z.ZodMiniType<Collection>;

export const collectionListSchema = z.array(collectionSchema) satisfies z.ZodMiniType<Collection[]>;

const playerCollectionSchema = z.object({
  id: z.optional(z.int()),
  name: z.string(),
  color: z.optional(z.string()),
  description: z.optional(z.string()),
  genre: z.optional(z.string()),
  required: z.optional(z.array(collectionRequiredSchema)),
}) satisfies z.ZodMiniType<PlayerCollection>;

export const playerProfileSchema = z.object({
  name: z.string(),
  rating: z.number(),
  friend_code: z.int(),
  course_rank: z.int(),
  class_rank: z.int(),
  star: z.int(),
  trophy: z.optional(playerCollectionSchema),
  icon: z.optional(playerCollectionSchema),
  name_plate: z.optional(playerCollectionSchema),
  frame: z.optional(playerCollectionSchema),
  upload_time: z.optional(z.string()),
}) satisfies z.ZodMiniType<PlayerProfile>;

export const scoreSchema = z.object({
  id: z.int(),
  song_name: z.optional(z.string()),
  level: z.optional(z.string()),
  level_index: levelIndexSchema,
  achievements: z.number(),
  fc: z.optional(z.nullable(fcTypeSchema)),
  fs: z.optional(z.nullable(fsTypeSchema)),
  dx_score: z.int(),
  dx_star: z.optional(z.int()),
  dx_rating: z.optional(z.number()),
  rate: z.optional(rateTypeSchema),
  type: songTypeSchema,
  play_time: z.optional(z.string()),
  upload_time: z.optional(z.string()),
  last_played_time: z.optional(z.string()),
}) satisfies z.ZodMiniType<Score>;

export const scoreListSchema = z.array(scoreSchema) satisfies z.ZodMiniType<Score[]>;

export const simpleScoreSchema = z.object({
  id: z.int(),
  song_name: z.string(),
  level: z.string(),
  level_index: levelIndexSchema,
  fc: z.optional(z.nullable(fcTypeSchema)),
  fs: z.optional(z.nullable(fsTypeSchema)),
  rate: rateTypeSchema,
  type: songTypeSchema,
}) satisfies z.ZodMiniType<SimpleScore>;

export const simpleScoreListSchema = z.array(simpleScoreSchema) satisfies z.ZodMiniType<
  SimpleScore[]
>;

export const bestsSchema = z.object({
  standard_total: z.number(),
  dx_total: z.number(),
  standard: scoreListSchema,
  dx: scoreListSchema,
  standard_selections: scoreListSchema,
  dx_selections: scoreListSchema,
}) satisfies z.ZodMiniType<Bests>;

export const heatmapSchema = z.record(z.string(), z.number()) satisfies z.ZodMiniType<Heatmap>;

const ratingTrendSchema = z.object({
  total: z.number(),
  standard_total: z.number(),
  dx_total: z.number(),
  date: z.union([z.string(), z.number()]),
}) satisfies z.ZodMiniType<RatingTrend>;

export const ratingTrendListSchema = z.array(ratingTrendSchema) satisfies z.ZodMiniType<
  RatingTrend[]
>;
export const scoreHistorySchema = z.nullable(scoreListSchema) satisfies z.ZodMiniType<ScoreHistory>;

const scoreRankingEntrySchema = z.object({
  ranking: z.int(),
  player_name: z.optional(z.string()),
  achievements: z.optional(z.number()),
  dx_score: z.optional(z.int()),
  upload_time: z.string(),
}) satisfies z.ZodMiniType<ScoreRankingEntry>;

export const scoreRankingListSchema = z.array(scoreRankingEntrySchema) satisfies z.ZodMiniType<
  ScoreRankingEntry[]
>;

export const yearInReviewSchema = z.looseObject({
  game: z.string(),
  year: z.int(),
  latest_version: z.int(),
  player_name: z.string(),
  player_avatar_id: z.int(),
}) satisfies z.ZodMiniType<LxnsYearInReview>;

function normalizeLxnsCollectionRequired(required: LxnsCollectionRequired): CollectionRequired {
  const { fc, fs, ...rest } = required;
  if (fc !== undefined && isFsType(fc)) {
    return { ...rest, fs: fs ?? fc };
  }
  return {
    ...rest,
    ...(fc !== undefined ? { fc } : {}),
    ...(fs !== undefined ? { fs } : {}),
  };
}

function isFsType(value: string): value is FSType {
  return (
    value === "fsdp" || value === "fsd" || value === "fsp" || value === "fs" || value === "sync"
  );
}
