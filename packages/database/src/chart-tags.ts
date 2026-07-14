import type { ChartTag, ChartTagGroup, ChartTagQuery, SongType } from "./models";
import { MaimaiDatabaseError } from "./error";
import * as z from "zod/mini";

/** @internal 上游快照地址（构建/同步脚本用；不从包根导出） */
export const DXRATING_TAGS_SOURCE_URL = "https://miruku.dxrating.net/api/v1/tags";

const localizedTextSchema = z.record(z.string(), z.string());
const chartTagSchema = z.object({
  id: z.int(),
  localized_name: localizedTextSchema,
  localized_description: localizedTextSchema,
  group_id: z.int(),
}) satisfies z.ZodMiniType<ChartTag>;
const chartTagGroupSchema = z.object({
  id: z.int(),
  localized_name: localizedTextSchema,
  color: z.string(),
}) satisfies z.ZodMiniType<ChartTagGroup>;
const chartTagSnapshotChartSchema = z.object({
  song_name: z.string(),
  type: z.literal(["standard", "dx"]),
  level_index: z.literal([0, 1, 2, 3, 4]),
  tag_ids: z.array(z.int()),
});
const chartTagSnapshotSchema = z.object({
  schema_version: z.literal(1),
  source: z.string(),
  tags: z.array(chartTagSchema),
  tag_groups: z.array(chartTagGroupSchema),
  charts: z.array(chartTagSnapshotChartSchema),
});

type ChartTagSnapshot = z.infer<typeof chartTagSnapshotSchema>;

let snapshotPromise: Promise<ChartTagSnapshot> | undefined;
let chartTagIndexPromise: Promise<Map<string, ChartTag[]>> | undefined;

/** @internal 包内 DXRating 标签快照 URL（Web bundler 需保留 database/data）。 */
export function getChartTagSnapshotUrl(): URL {
  return new URL("../data/dxrating-tags.json", import.meta.url);
}

/** @internal 读取完整的本地标签快照（适配器内部；不从包根导出）。 */
export async function getChartTagSnapshot(): Promise<ChartTagSnapshot> {
  snapshotPromise ??= loadSnapshot();
  return snapshotPromise;
}

/**
 * @internal 适配器内部读本地标签快照；用户侧用 `MaimaiDatabase.getChartTags`。
 *
 * 关联键严格使用曲名 + 谱面类型 + 难度索引，不做模糊匹配或降级猜测。
 */
export async function getLocalChartTags(charts: readonly ChartTagQuery[]): Promise<ChartTag[][]> {
  chartTagIndexPromise ??= buildChartTagIndex();
  const index = await chartTagIndexPromise;
  return charts.map((chart) => {
    if (!chart.song_name) return [];
    return index.get(chartTagKey(chart.song_name, chart.type, chart.level_index)) ?? [];
  });
}

function chartTagKey(songName: string, type: SongType, levelIndex: number): string {
  return `${songName}\u0000${type}\u0000${levelIndex}`;
}

async function buildChartTagIndex(): Promise<Map<string, ChartTag[]>> {
  const snapshot = await getChartTagSnapshot();
  const tags = new Map(snapshot.tags.map((tag) => [tag.id, tag]));
  const index = new Map<string, ChartTag[]>();
  for (const chart of snapshot.charts) {
    const chartTags = chart.tag_ids.map((tagId) => tags.get(tagId)).filter((tag) => tag != null);
    index.set(chartTagKey(chart.song_name, chart.type, chart.level_index), chartTags);
  }
  return index;
}

async function loadSnapshot(): Promise<ChartTagSnapshot> {
  const url = getChartTagSnapshotUrl();
  try {
    const text =
      url.protocol === "file:"
        ? await readNodeFile(url)
        : await fetch(url).then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          });
    return chartTagSnapshotSchema.parse(JSON.parse(text));
  } catch (error) {
    throw new MaimaiDatabaseError({
      message: "Failed to load bundled DXRating chart tags",
      cause: error,
    });
  }
}

async function readNodeFile(url: URL): Promise<string> {
  const fs = await import("node:fs/promises");
  return fs.readFile(url, "utf8");
}
