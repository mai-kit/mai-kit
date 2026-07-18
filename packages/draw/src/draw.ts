import { createElement } from "react";
import satori from "satori";
import type { SatoriOptions } from "satori";
import type { Bests, PlayerProfile as ProberProfile } from "@mai-kit/prober";
import { buildSongDxMaxMap, buildSongLevelMap, scoreMapKey } from "@mai-kit/utils/song";
import { loadFonts } from "./assets";
import { BestBoard, BEST_HEIGHT, BEST_WIDTH } from "./components/best-board";
import { ChartCardPoster, CHART_CARD_HEIGHT, CHART_CARD_WIDTH } from "./components/chart-card";
import { B50Poster, POSTER_HEIGHT, POSTER_WIDTH } from "./components/poster";
import {
  UpgradesBoard,
  UPGRADES_BOARD_HEIGHT,
  UPGRADES_BOARD_WIDTH,
} from "./components/upgrades-board";
import { DrawError } from "./error";
import { buildPlayerData } from "./player-data";
import { rasterizeSvgToPng } from "./rasterize";
import { resolveChartCover, resolveChartCovers, resolvePlayerAvatar } from "./resolve-assets";
import type {
  AssetFallback,
  DrawSource,
  PlayerProfile,
  PosterData,
  PosterDataSource,
  ScoreChart,
  UpgradeBoardData,
} from "./types";

export type { AssetFallback } from "./types";

/**
 * {@link Draw} 构造配置。
 *
 * `database` 须满足 {@link DrawSource}（素材；海报另需标签；推荐带曲目列表）。
 * 常见做法是传入任意 `@mai-kit/database` 的 `MaimaiDatabase` 实现。
 */
export interface DrawOptions {
  /**
   * 绘制所需数据源：
   * - `getAsset`：封面 / 头像（渲染时拉取）
   * - `getChartTags`：完整海报雷达（仅 {@link Draw.poster} 需要）
   * - `getSongList`：有则自动填 `dx_max` / `level_value`（推荐）
   */
  database: DrawSource;
}

/**
 * 各出图方法共用的渲染选项（末位参数；均可省略）。
 *
 * | 字段 | 默认 | 说明 |
 * |------|------|------|
 * | `scale` | `2` | 相对 1920×1080 的像素倍率（2 → 3840×2160） |
 * | `fonts` | assets 默认字体 | 自定义 satori 字体表 |
 * | `header` | 不绘制 | 画布左上品牌页眉 |
 * | `footerLeft` | 不绘制 | 画布左下页脚 |
 * | `footerRight` | 不绘制 | 画布右下页脚；左右都不传则无页脚 |
 * | `assetFallback` | `"error"` | 见 {@link AssetFallback}：封面/头像失败时抛错或占位图 |
 *
 * @example
 * ```ts
 * await draw.poster(profile, bests, {
 *   scale: 1,
 *   header: "my-bot",
 *   footerLeft: "my-bot",
 *   footerRight: "mai-kit",
 *   assetFallback: "placeholder",
 * });
 * await draw.best15({ name: profile.name, rating: profile.rating }, bests, {
 *   scale: 1,
 *   header: "my-bot",
 *   footerLeft: "my-bot",
 * });
 * ```
 */
export interface RenderOptions {
  /**
   * 输出像素相对逻辑画布（1920×1080）的缩放倍数。
   * @defaultValue 2 → 3840×2160
   */
  scale?: number;
  /**
   * 自定义 satori 字体表；不传则使用 `@mai-kit/assets` 默认字体（Noto Sans SC + Comfortaa）。
   */
  fonts?: SatoriOptions["fonts"];
  /**
   * 画布左上品牌页眉文案。
   * 不传时不绘制品牌页眉；Best 板仍保留成绩页标题与玩家资料。
   */
  header?: string;
  /**
   * 页脚左侧文案（画布左下）。
   * 与 `footerRight` 都不传时不绘制页脚栏。
   */
  footerLeft?: string;
  /**
   * 页脚右侧文案（画布右下）。
   * 与 `footerLeft` 都不传时不绘制页脚栏。
   */
  footerRight?: string;
  /**
   * 从 database / 本地路径加载封面、头像失败时的策略（{@link AssetFallback}）。
   * - `"error"`（默认）：抛 {@link DrawError}
   * - `"placeholder"`：用内置占位图继续渲染
   * @defaultValue `"error"`
   */
  assetFallback?: AssetFallback;
}

/**
 * 成绩海报绘制入口：构造时注入 `database`，**一种图一个方法**（成对提供 PNG / SVG）。
 *
 * | 方法 | 需要的数据 | 说明 |
 * |------|------------|------|
 * | {@link poster} / {@link posterSvg} | `profile` + `bests`，或已聚合的 {@link PosterData} | 完整 B50 海报（含雷达） |
 * | {@link best15} / {@link best15Svg} | 署名 + prober `Bests` | 取 `dx` 前最多 15，不排序 |
 * | {@link best35} / {@link best35Svg} | 署名 + prober `Bests` | 取 `standard` 前最多 35，不排序 |
 * | {@link best50} / {@link best50Svg} | 署名 + prober `Bests` | 新 15 + 旧 35 拼接，不排序 |
 * | {@link chart} / {@link chartSvg} | 单曲成绩 | 无玩家栏的单曲成绩卡 |
 * | {@link upgrades} / {@link upgradesSvg} | {@link UpgradeBoardData} | 加分板（宿主先算候选） |
 *
 * Best 板**只切割、不重排**；数量不足则有几画几（不补假数据、不满员不报错）。
 *
 * @example
 * ```ts
 * const draw = new Draw({ database });
 * const png = await draw.poster(profile, bests, {
 *   header: "my-app",
 *   footerLeft: "my-app",
 * });
 * const head = { name: profile.name, rating: profile.rating };
 * const b15 = await draw.best15(head, bests);
 * ```
 */
export class Draw {
  private readonly database: DrawSource;

  /**
   * @param options - 必须提供 `database`（素材；海报还需要标签能力）
   */
  constructor(options: DrawOptions) {
    this.database = options.database;
  }

  // ── 完整海报 ──────────────────────────────────────────────────────────

  /**
   * 渲染完整 B50 海报 PNG。
   *
   * 可传 prober 的 `profile` + `bests`（内部聚合雷达 / summary），
   * 或已组装好的 {@link PosterData}。
   */
  async poster(
    profileOrData: ProberProfile | PosterData,
    bestsOrOptions?: Bests | RenderOptions,
    options?: RenderOptions,
  ): Promise<Uint8Array> {
    const { data, opts } = await this.resolvePosterInput(profileOrData, bestsOrOptions, options);
    const scale = opts.scale ?? 2;
    const svg = await this.renderPosterSvg(data, opts);
    return rasterizeSvgToPng(svg, Draw.getPosterSize(scale).width);
  }

  /** 渲染完整 B50 海报 SVG。参数同 {@link poster}。 */
  async posterSvg(
    profileOrData: ProberProfile | PosterData,
    bestsOrOptions?: Bests | RenderOptions,
    options?: RenderOptions,
  ): Promise<string> {
    const { data, opts } = await this.resolvePosterInput(profileOrData, bestsOrOptions, options);
    return this.renderPosterSvg(data, opts);
  }

  // ── Best 板 ───────────────────────────────────────────────────────────

  /**
   * 新曲 B15 板 PNG。
   * 从 `bests.dx` **按原顺序**取前最多 15 首；不足则少画，不排序、不补全。
   */
  async best15(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<Uint8Array> {
    return this.renderBestPng("best15", player, chartsFromBests("best15", bests), options);
  }

  /** 新曲 B15 板 SVG。语义同 {@link best15}。 */
  async best15Svg(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<string> {
    return this.renderBestSvg("best15", player, chartsFromBests("best15", bests), options);
  }

  /**
   * 旧曲 B35 板 PNG。
   * 从 `bests.standard` **按原顺序**取前最多 35 首；不足则少画，不排序、不补全。
   */
  async best35(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<Uint8Array> {
    return this.renderBestPng("best35", player, chartsFromBests("best35", bests), options);
  }

  /** 旧曲 B35 板 SVG。语义同 {@link best35}。 */
  async best35Svg(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<string> {
    return this.renderBestSvg("best35", player, chartsFromBests("best35", bests), options);
  }

  /**
   * B50 全曲板 PNG。
   * `dx` 前最多 15 + `standard` 前最多 35，**按源顺序拼接**；不足则少画，不排序、不补全。
   */
  async best50(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<Uint8Array> {
    return this.renderBestPng("best50", player, chartsFromBests("best50", bests), options);
  }

  /** B50 全曲板 SVG。语义同 {@link best50}。 */
  async best50Svg(
    player: PlayerProfile,
    bests: Bests,
    options: RenderOptions = {},
  ): Promise<string> {
    return this.renderBestSvg("best50", player, chartsFromBests("best50", bests), options);
  }

  // ── 单曲卡 ────────────────────────────────────────────────────────────

  /**
   * 单曲成绩卡 PNG。
   * 若 `database` 提供 `getSongList`，会尽量补全 `dx_max` / `level_value`。
   */
  async chart(chart: ScoreChart, options: RenderOptions = {}): Promise<Uint8Array> {
    const scale = options.scale ?? 2;
    const svg = await this.chartSvg(chart, options);
    return rasterizeSvgToPng(svg, Draw.getBoardSize(scale).width);
  }

  /** 单曲成绩卡 SVG。 */
  async chartSvg(chart: ScoreChart, options: RenderOptions = {}): Promise<string> {
    const fallback = options.assetFallback ?? "error";
    const [enriched] = await enrichCharts([chart], this.database);
    const [resolvedChart, fonts] = await Promise.all([
      resolveChartCover(enriched, this.database, fallback),
      options.fonts ?? loadFonts(),
    ]);
    try {
      const element = createElement(ChartCardPoster, {
        chart: resolvedChart,
        header: options.header,
        footerLeft: options.footerLeft,
        footerRight: options.footerRight,
      });
      return await satori(element, {
        width: CHART_CARD_WIDTH,
        height: CHART_CARD_HEIGHT,
        fonts,
      });
    } catch (error) {
      if (error instanceof DrawError) throw error;
      throw new DrawError("Failed to render chart card to SVG", { cause: error });
    }
  }

  // ── 加分板 ────────────────────────────────────────────────────────────

  /**
   * 加分推荐板 PNG。
   * 候选须由宿主事先算好（推荐 `@mai-kit/analysis` 的 `rankBestsUpgradeCandidates`，
   * 即能抬 B15/B35 的全曲候选）；draw **不**依赖 analysis，也不重新排序。
   */
  async upgrades(data: UpgradeBoardData, options: RenderOptions = {}): Promise<Uint8Array> {
    const scale = options.scale ?? 2;
    const svg = await this.upgradesSvg(data, options);
    return rasterizeSvgToPng(svg, Draw.getBoardSize(scale).width);
  }

  /** 加分推荐板 SVG。 */
  async upgradesSvg(data: UpgradeBoardData, options: RenderOptions = {}): Promise<string> {
    assertUniformUpgradeTarget(data);
    const fallback = options.assetFallback ?? "error";
    const enriched = await enrichCharts(
      data.candidates.map((row) => ({ ...row.score, level_value: row.levelValue })),
      this.database,
    );
    const [scores, fonts] = await Promise.all([
      resolveChartCovers(enriched, this.database, fallback),
      options.fonts ?? loadFonts(),
    ]);
    const candidates = data.candidates.map((row, index) => ({
      ...row,
      score: scores[index],
    }));
    const resolved: UpgradeBoardData = { candidates };
    try {
      const element = createElement(UpgradesBoard, {
        data: resolved,
        header: options.header,
        footerLeft: options.footerLeft,
        footerRight: options.footerRight,
      });
      return await satori(element, {
        width: UPGRADES_BOARD_WIDTH,
        height: UPGRADES_BOARD_HEIGHT,
        fonts,
      });
    } catch (error) {
      if (error instanceof DrawError) throw error;
      throw new DrawError("Failed to render upgrades board to SVG", { cause: error });
    }
  }

  // ── 尺寸 ──────────────────────────────────────────────────────────────

  /** 海报输出尺寸（逻辑宽高 × scale）。@param scale 默认 2 */
  static getPosterSize(scale = 2): { width: number; height: number } {
    return { width: POSTER_WIDTH * scale, height: POSTER_HEIGHT * scale };
  }

  /** Best 板输出尺寸（与海报同为 16:9）。@param scale 默认 2 */
  static getBestSize(scale = 2): { width: number; height: number } {
    return { width: BEST_WIDTH * scale, height: BEST_HEIGHT * scale };
  }

  /** 单曲卡 / 加分板输出尺寸（1920×1080 × scale）。@param scale 默认 2 */
  static getBoardSize(scale = 2): { width: number; height: number } {
    return { width: CHART_CARD_WIDTH * scale, height: CHART_CARD_HEIGHT * scale };
  }

  // ── 内部 ──────────────────────────────────────────────────────────────

  private async resolvePosterInput(
    profileOrData: ProberProfile | PosterData,
    bestsOrOptions?: Bests | RenderOptions,
    options?: RenderOptions,
  ): Promise<{ data: PosterData; opts: RenderOptions }> {
    if (isPosterData(profileOrData)) {
      return {
        data: profileOrData,
        opts: isRenderOptions(bestsOrOptions) ? bestsOrOptions : {},
      };
    }
    if (!isBests(bestsOrOptions)) {
      throw new DrawError("poster(profile, bests) requires a Bests object as the second argument");
    }
    if (!isPosterDataSource(this.database)) {
      throw new DrawError("poster(profile, bests) requires database.getChartTags()");
    }
    const data = await buildPlayerData(profileOrData, bestsOrOptions, this.database);
    return { data, opts: options ?? {} };
  }

  private async renderPosterSvg(data: PosterData, options: RenderOptions): Promise<string> {
    const fallback = options.assetFallback ?? "error";
    const [charts, player, fonts] = await Promise.all([
      resolveChartCovers(data.charts, this.database, fallback),
      resolvePlayerAvatar(data.player, this.database, fallback),
      options.fonts ?? loadFonts(),
    ]);
    const resolved: PosterData = { ...data, charts, player };
    try {
      const element = createElement(B50Poster, {
        data: resolved,
        header: options.header,
        footerLeft: options.footerLeft,
        footerRight: options.footerRight,
      });
      return await satori(element, {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        fonts,
      });
    } catch (error) {
      if (error instanceof DrawError) throw error;
      throw new DrawError("Failed to render poster to SVG", { cause: error });
    }
  }

  private async renderBestPng(
    page: "best15" | "best35" | "best50",
    player: PlayerProfile,
    charts: readonly ScoreChart[],
    options: RenderOptions,
  ): Promise<Uint8Array> {
    const scale = options.scale ?? 2;
    const svg = await this.renderBestSvg(page, player, charts, options);
    return rasterizeSvgToPng(svg, Draw.getBestSize(scale).width);
  }

  private async renderBestSvg(
    page: "best15" | "best35" | "best50",
    player: PlayerProfile,
    charts: readonly ScoreChart[],
    options: RenderOptions,
  ): Promise<string> {
    const fallback = options.assetFallback ?? "error";
    const enriched = await enrichCharts(charts, this.database);
    const [resolvedCharts, resolvedPlayer, fonts] = await Promise.all([
      resolveChartCovers(enriched, this.database, fallback),
      resolvePlayerAvatar(player, this.database, fallback),
      options.fonts ?? loadFonts(),
    ]);
    try {
      const element = createElement(BestBoard, {
        player: resolvedPlayer,
        charts: resolvedCharts,
        page,
        header: options.header,
        footerLeft: options.footerLeft,
        footerRight: options.footerRight,
      });
      return await satori(element, {
        width: BEST_WIDTH,
        height: BEST_HEIGHT,
        fonts,
      });
    } catch (error) {
      if (error instanceof DrawError) throw error;
      throw new DrawError(`Failed to render ${page} to SVG`, { cause: error });
    }
  }
}

/**
 * 从 prober `Bests` 切出 Best 板成绩列表。
 * **只 slice / 拼接，不排序**；长度可小于页种上限。
 */
function chartsFromBests(page: "best15" | "best35" | "best50", bests: Bests): ScoreChart[] {
  if (page === "best15") return bests.dx.slice(0, 15);
  if (page === "best35") return bests.standard.slice(0, 35);
  return [...bests.dx.slice(0, 15), ...bests.standard.slice(0, 35)] as ScoreChart[];
}

function isPosterData(value: ProberProfile | PosterData): value is PosterData {
  return (
    typeof value === "object" &&
    value !== null &&
    "charts" in value &&
    "summary" in value &&
    "radar" in value &&
    Array.isArray(value.charts)
  );
}

function isBests(value: Bests | RenderOptions | undefined): value is Bests {
  return (
    typeof value === "object" &&
    value !== null &&
    "dx" in value &&
    "standard" in value &&
    Array.isArray(value.dx)
  );
}

function isRenderOptions(value: Bests | RenderOptions | undefined): value is RenderOptions {
  return typeof value === "object" && value !== null && !isBests(value);
}

function isPosterDataSource(source: DrawSource): source is DrawSource & PosterDataSource {
  return typeof source.getChartTags === "function";
}

function assertUniformUpgradeTarget(data: UpgradeBoardData): void {
  const target = data.candidates[0]?.targetAchievement;
  if (
    target !== undefined &&
    data.candidates.some((candidate) => candidate.targetAchievement !== target)
  ) {
    throw new DrawError("upgrades candidates must use the same targetAchievement");
  }
}

async function enrichCharts(
  charts: readonly ScoreChart[],
  source: DrawSource,
): Promise<ScoreChart[]> {
  if (charts.every((chart) => chart.dx_max != null && chart.level_value != null)) {
    return [...charts];
  }
  if (typeof source.getSongList !== "function") return [...charts];
  const { songs } = await source.getSongList({ notes: true });
  const dxMaxMap = buildSongDxMaxMap(songs);
  const levelMap = buildSongLevelMap(songs);
  return charts.map((chart) => {
    const key = scoreMapKey(chart);
    const dxMax = chart.dx_max ?? dxMaxMap.get(key);
    const levelValue = chart.level_value ?? levelMap.get(key);
    return {
      ...chart,
      ...(dxMax != null ? { dx_max: dxMax } : {}),
      ...(levelValue != null ? { level_value: levelValue } : {}),
    };
  });
}
