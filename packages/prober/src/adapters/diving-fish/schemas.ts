import * as z from "zod/mini";
import type { DivingFishRatingRankEntry } from "./types";

export const divingFishRecordSchema = z.object({
  achievements: z.number(),
  ds: z.number(),
  dxScore: z.number(),
  fc: z.string(),
  fs: z.string(),
  level: z.string(),
  level_index: z.int(),
  level_label: z.optional(z.string()),
  ra: z.number(),
  rate: z.string(),
  song_id: z.number(),
  title: z.string(),
  type: z.string(),
});

export type DivingFishRecord = z.infer<typeof divingFishRecordSchema>;

const playerFields = {
  additional_rating: z.optional(z.number()),
  nickname: z.optional(z.string()),
  plate: z.optional(z.string()),
  rating: z.number(),
  username: z.optional(z.string()),
  user_general_data: z.optional(z.unknown()),
};

export const queryPlayerPayloadSchema = z.object({
  ...playerFields,
  charts: z.object({
    dx: z.array(divingFishRecordSchema),
    sd: z.array(divingFishRecordSchema),
  }),
});

export type DivingFishQueryPlayerPayload = z.infer<typeof queryPlayerPayloadSchema>;

export const recordsPlayerPayloadSchema = z.object({
  ...playerFields,
  records: z.array(divingFishRecordSchema),
});

export type DivingFishRecordsPlayerPayload = z.infer<typeof recordsPlayerPayloadSchema>;
export type DivingFishPlayerPayload = DivingFishQueryPlayerPayload | DivingFishRecordsPlayerPayload;

const ratingRankEntrySchema = z.object({
  username: z.string(),
  ra: z.number(),
}) satisfies z.ZodMiniType<DivingFishRatingRankEntry>;

export const ratingRankingSchema = z.array(ratingRankEntrySchema) satisfies z.ZodMiniType<
  DivingFishRatingRankEntry[]
>;

export const newSongDataSchema = z.array(
  z.object({
    id: z.union([z.string(), z.number()]),
    basic_info: z.object({
      is_new: z.boolean(),
    }),
  }),
);

export type DivingFishNewSongEntry = z.infer<typeof newSongDataSchema>[number];
