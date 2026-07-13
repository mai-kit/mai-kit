/**
 * 封面 / 头像解析（Draw 各出图方法共用）。
 */
import { loadLocalImage } from "./assets";
import { bytesDataUri } from "./encoding";
import { DrawError } from "./error";
import type { AssetFallback, AssetSource, PlayerProfile, ScoreChart } from "./types";

/** 解析单曲封面（data URI ← path ← database jacket）。 */
export async function resolveChartCover(
  chart: ScoreChart,
  database: AssetSource | undefined,
  fallback: AssetFallback,
): Promise<ScoreChart> {
  if (chart.coverDataUri) return chart;
  const allowPlaceholder = fallback === "placeholder";

  if (chart.coverPath) {
    const fromPath = await loadLocalImage(chart.coverPath);
    if (fromPath) return { ...chart, coverDataUri: fromPath };
    if (!allowPlaceholder) {
      throw new DrawError(
        `Failed to load cover from coverPath for chart id=${chart.id}: ${chart.coverPath}`,
      );
    }
  }

  if (!database) return chart;

  try {
    return {
      ...chart,
      coverDataUri: bytesDataUri(await database.getAsset("jacket", chart.id)),
    };
  } catch (error) {
    if (allowPlaceholder) return chart;
    throw new DrawError(`Failed to load jacket asset for chart id=${chart.id}`, {
      cause: error,
    });
  }
}

/** 解析多曲封面（并行）。 */
export async function resolveChartCovers(
  charts: readonly ScoreChart[],
  database: AssetSource | undefined,
  fallback: AssetFallback,
): Promise<ScoreChart[]> {
  return Promise.all(charts.map(async (chart) => resolveChartCover(chart, database, fallback)));
}

/** 解析玩家头像（可选）。 */
export async function resolvePlayerAvatar(
  player: PlayerProfile,
  database: AssetSource | undefined,
  fallback: AssetFallback,
): Promise<PlayerProfile> {
  if (player.avatarDataUri) return player;
  const allowPlaceholder = fallback === "placeholder";
  const next = { ...player };

  if (player.avatarPath) {
    const fromPath = await loadLocalImage(player.avatarPath);
    if (fromPath) {
      next.avatarDataUri = fromPath;
      return next;
    }
    if (!allowPlaceholder) {
      throw new DrawError(`Failed to load avatar from avatarPath: ${player.avatarPath}`);
    }
  } else if (database && player.icon?.id != null) {
    try {
      next.avatarDataUri = bytesDataUri(await database.getAsset("icon", player.icon.id));
    } catch (error) {
      if (!allowPlaceholder) {
        throw new DrawError(`Failed to load icon asset for icon id=${player.icon.id}`, {
          cause: error,
        });
      }
    }
  }

  return next;
}
