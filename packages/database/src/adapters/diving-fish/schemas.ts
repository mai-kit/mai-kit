import * as z from "zod/mini";
import type { DivingFishChartStat, DivingFishDifficultyStats } from "./chart-stats";
import { DivingFishDatabaseError } from "./error";

export const divingFishMusicEntrySchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  type: z.string(),
  ds: z.array(z.number()),
  level: z.array(z.string()),
  charts: z.array(
    z.object({
      notes: z.array(z.number()),
      charter: z.optional(z.string()),
    }),
  ),
  basic_info: z.optional(
    z.object({
      title: z.optional(z.string()),
      artist: z.optional(z.string()),
      genre: z.optional(z.string()),
      bpm: z.optional(z.number()),
      from: z.optional(z.string()),
      is_new: z.optional(z.boolean()),
    }),
  ),
});

export const divingFishMusicDataSchema = z.array(divingFishMusicEntrySchema);
export type DivingFishMusicEntry = z.infer<typeof divingFishMusicEntrySchema>;

const chartStatSchema = z.object({
  cnt: z.number(),
  diff: z.number(),
  fit_diff: z.number(),
  avg: z.number(),
  avg_dx: z.number(),
  std_dev: z.number(),
  dist: z.array(z.number()),
  fc_dist: z.array(z.number()),
}) satisfies z.ZodMiniType<DivingFishChartStat>;

const difficultyStatsSchema = z.object({
  achievements: z.number(),
  dist: z.array(z.number()),
  fc_dist: z.array(z.number()),
}) satisfies z.ZodMiniType<DivingFishDifficultyStats>;

const emptyObjectSchema = z.custom<Record<string, never>>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0,
);

export const divingFishChartStatsSchema = z.object({
  charts: z.record(z.string(), z.array(z.union([chartStatSchema, emptyObjectSchema]))),
  diff_data: z.record(z.string(), difficultyStatsSchema),
});

export function parseDivingFishResponse<T>(
  schema: z.ZodMiniType<T>,
  value: unknown,
  endpoint: string,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new DivingFishDatabaseError({
    message: `Diving-Fish ${endpoint}: unexpected response structure (${formatIssues(parsed.error.issues)})`,
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
