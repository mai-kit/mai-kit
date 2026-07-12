import { mkdir, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://miruku.dxrating.net/api/v1/tags";
const OUTPUT_URL = new URL("../data/dxrating-tags.json", import.meta.url);

const TYPE_MAP = { std: "standard", dx: "dx" } as const;
const LEVEL_MAP = { basic: 0, advanced: 1, expert: 2, master: 3, remaster: 4 } as const;

type LocalizedText = Record<string, string>;

interface ApiTag {
  id: number;
  localized_name: LocalizedText;
  localized_description: LocalizedText;
  group_id: number;
}

interface ApiTagGroup {
  id: number;
  localized_name: LocalizedText;
  color: string;
}

interface ApiTagSong {
  song_id: string;
  sheet_type: string;
  sheet_difficulty: string;
  tag_id: number;
}

interface ApiResponse {
  tags: ApiTag[];
  tagGroups: ApiTagGroup[];
  tagSongs: ApiTagSong[];
}

const response = await fetch(SOURCE_URL, { headers: { Accept: "application/json" } });
if (!response.ok) throw new Error(`DXRating tags request failed: HTTP ${response.status}`);

const responseBody = await response.text();
if (responseBody.length > 10_000_000) throw new Error("DXRating tags response exceeds 10 MB");
const data: unknown = JSON.parse(responseBody);
validate(data);

const chartTags = new Map<
  string,
  { song_name: string; type: "standard" | "dx"; level_index: number; tag_ids: Set<number> }
>();
for (const relation of data.tagSongs) {
  const type = mapType(relation.sheet_type);
  const levelIndex = mapLevel(relation.sheet_difficulty);
  if (type == null || levelIndex == null) continue;
  const key = `${relation.song_id}\u0000${type}\u0000${levelIndex}`;
  const chart = chartTags.get(key) ?? {
    song_name: relation.song_id,
    type,
    level_index: levelIndex,
    tag_ids: new Set<number>(),
  };
  chart.tag_ids.add(relation.tag_id);
  chartTags.set(key, chart);
}

const charts = [...chartTags.values()]
  .map((chart) => ({
    song_name: chart.song_name,
    type: chart.type,
    level_index: chart.level_index,
    tag_ids: [...chart.tag_ids].sort((a, b) => a - b),
  }))
  .sort(
    (a, b) =>
      a.song_name.localeCompare(b.song_name, "ja") ||
      a.type.localeCompare(b.type) ||
      a.level_index - b.level_index,
  );

const snapshot = {
  schema_version: 1,
  source: SOURCE_URL,
  tags: [...data.tags].sort((a, b) => a.id - b.id),
  tag_groups: [...data.tagGroups].sort((a, b) => a.id - b.id),
  charts,
};

await mkdir(new URL(".", OUTPUT_URL), { recursive: true });
await writeFile(OUTPUT_URL, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Synced ${snapshot.tags.length} tags, ${snapshot.tag_groups.length} groups, ${snapshot.charts.length} tagged charts`,
);

function validate(value: unknown): asserts value is ApiResponse {
  if (!isRecord(value)) throw new Error("Invalid DXRating response");
  if (!isUnknownArray(value.tags) || value.tags.length > 1_000) {
    throw new Error("Invalid DXRating tags array");
  }
  if (!isUnknownArray(value.tagGroups) || value.tagGroups.length > 100) {
    throw new Error("Invalid DXRating tagGroups array");
  }
  if (!isUnknownArray(value.tagSongs) || value.tagSongs.length > 100_000) {
    throw new Error("Invalid DXRating tagSongs array");
  }
  for (const tag of value.tags) {
    if (!isRecord(tag)) throw new Error("Invalid DXRating tag entry");
    if (
      !Number.isInteger(tag.id) ||
      !Number.isInteger(tag.group_id) ||
      !isLocalizedText(tag.localized_name) ||
      !isLocalizedText(tag.localized_description)
    ) {
      throw new Error("Invalid DXRating tag entry");
    }
  }
  for (const group of value.tagGroups) {
    if (
      !isRecord(group) ||
      !Number.isInteger(group.id) ||
      !isLocalizedText(group.localized_name) ||
      typeof group.color !== "string"
    ) {
      throw new Error("Invalid DXRating tag-group entry");
    }
  }
  for (const relation of value.tagSongs) {
    if (!isRecord(relation)) {
      throw new Error("Invalid DXRating tag-song relation");
    }
    if (
      typeof relation.song_id !== "string" ||
      relation.song_id.length === 0 ||
      relation.song_id.length > 300 ||
      typeof relation.sheet_type !== "string" ||
      typeof relation.sheet_difficulty !== "string" ||
      !Number.isInteger(relation.tag_id)
    ) {
      throw new Error("Invalid DXRating tag-song relation");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (!isRecord(value) || typeof value["zh-Hans"] !== "string") return false;
  return Object.values(value).every((localizedValue) => typeof localizedValue === "string");
}

function mapType(value: string): "standard" | "dx" | undefined {
  if (value === "std") return TYPE_MAP.std;
  if (value === "dx") return TYPE_MAP.dx;
  return undefined;
}

function mapLevel(value: string): number | undefined {
  if (value === "basic") return LEVEL_MAP.basic;
  if (value === "advanced") return LEVEL_MAP.advanced;
  if (value === "expert") return LEVEL_MAP.expert;
  if (value === "master") return LEVEL_MAP.master;
  if (value === "remaster") return LEVEL_MAP.remaster;
  return undefined;
}
