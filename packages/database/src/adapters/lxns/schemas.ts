import * as z from "zod/mini";
import type {
  Alias,
  Collection,
  CollectionGenre,
  Genre,
  Notes,
  Song,
  SongCollection,
  SongDifficulty,
  SongDifficultyUtage,
  SongList,
  Version,
} from "../../models";
import { LxnsDatabaseError } from "./error";

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

const notesSchema = z.object({
  total: z.int(),
  tap: z.int(),
  hold: z.int(),
  slide: z.int(),
  touch: z.int(),
  break: z.int(),
}) satisfies z.ZodMiniType<Notes>;

const buddyNotesSchema = z.object({
  left: notesSchema,
  right: notesSchema,
});

const songDifficultySchema = z.object({
  type: songTypeSchema,
  difficulty: levelIndexSchema,
  level: z.string(),
  level_value: z.number(),
  note_designer: z.string(),
  version: z.int(),
  notes: z.optional(notesSchema),
}) satisfies z.ZodMiniType<SongDifficulty>;

const songDifficultyUtageSchema = z.object({
  kanji: z.string(),
  description: z.string(),
  is_buddy: z.boolean(),
  notes: z.optional(z.union([notesSchema, buddyNotesSchema])),
  type: songTypeSchema,
  difficulty: levelIndexSchema,
  level: z.string(),
  level_value: z.number(),
  note_designer: z.string(),
  version: z.int(),
}) satisfies z.ZodMiniType<SongDifficultyUtage>;

export const songSchema = z.object({
  id: z.int(),
  title: z.string(),
  artist: z.string(),
  genre: z.string(),
  bpm: z.number(),
  map: z.optional(z.string()),
  version: z.int(),
  rights: z.optional(z.string()),
  disabled: z.optional(z.boolean()),
  difficulties: z.object({
    standard: z.array(songDifficultySchema),
    dx: z.array(songDifficultySchema),
    utage: z.optional(z.array(songDifficultyUtageSchema)),
  }),
  locked: z.optional(z.boolean()),
}) satisfies z.ZodMiniType<Song>;

const genreSchema = z.object({
  id: z.int(),
  title: z.string(),
  genre: z.string(),
}) satisfies z.ZodMiniType<Genre>;

const versionSchema = z.object({
  id: z.int(),
  title: z.string(),
  version: z.int(),
}) satisfies z.ZodMiniType<Version>;

export const songListSchema = z.object({
  songs: z.array(songSchema),
  genres: z.array(genreSchema),
  versions: z.array(versionSchema),
}) satisfies z.ZodMiniType<SongList>;

const aliasSchema = z.object({
  song_id: z.int(),
  aliases: z.array(z.string()),
}) satisfies z.ZodMiniType<Alias>;

export const aliasListSchema = z.object({
  aliases: z.array(aliasSchema),
});

const collectionRequiredSongSchema = z.object({
  id: z.int(),
  title: z.string(),
  type: songTypeSchema,
  completed: z.optional(z.boolean()),
  completed_difficulties: z.optional(z.array(levelIndexSchema)),
});

const collectionRequiredSchema = z.object({
  difficulties: z.optional(z.array(levelIndexSchema)),
  rate: z.optional(rateTypeSchema),
  fc: z.optional(fcTypeSchema),
  fs: z.optional(fsTypeSchema),
  songs: z.optional(z.array(collectionRequiredSongSchema)),
  completed: z.optional(z.boolean()),
});

export const collectionSchema = z.object({
  id: z.int(),
  name: z.string(),
  color: z.optional(z.string()),
  description: z.optional(z.string()),
  genre: z.optional(z.string()),
  required: z.optional(z.array(collectionRequiredSchema)),
}) satisfies z.ZodMiniType<Collection>;

export const collectionListSchema = z.object({
  trophies: z.optional(z.array(collectionSchema)),
  icons: z.optional(z.array(collectionSchema)),
  plates: z.optional(z.array(collectionSchema)),
  frames: z.optional(z.array(collectionSchema)),
});

export const collectionGenreSchema = z.object({
  id: z.int(),
  title: z.string(),
  genre: z.string(),
}) satisfies z.ZodMiniType<CollectionGenre>;

export const collectionGenreListSchema = z.object({
  collectionGenres: z.array(collectionGenreSchema),
});

const songCollectionSchema = z.object({
  type: z.literal(["trophy", "icon", "plate", "frame"]),
  id: z.int(),
  name: z.string(),
  color: z.optional(z.string()),
  genre: z.optional(z.string()),
}) satisfies z.ZodMiniType<SongCollection>;

export const songCollectionListSchema = z.array(songCollectionSchema) satisfies z.ZodMiniType<
  SongCollection[]
>;

export function parseLxnsResponse<T>(
  schema: z.ZodMiniType<T>,
  value: unknown,
  endpoint: string,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new LxnsDatabaseError({
    message: `Lxns ${endpoint}: unexpected response structure (${formatIssues(parsed.error.issues)})`,
    cause: parsed.error,
  });
}

function formatIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 3)
    .map(
      (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "response"}: ${issue.message}`,
    )
    .join("; ");
}
