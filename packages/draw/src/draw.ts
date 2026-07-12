import { createElement } from "react";
import satori from "satori";
import type { SatoriOptions } from "satori";
import type { Bests, PlayerProfile } from "@mai-kit/prober";
import { loadFonts, loadLocalImage } from "./assets";
import { buildPlayerData } from "./player-data";
import { BestBoard, BEST_HEIGHT, BEST_WIDTH, type BestPage } from "./components/best-board";
import { B50Poster, POSTER_HEIGHT, POSTER_WIDTH } from "./components/poster";
import { bytesDataUri } from "./encoding";
import { DrawError } from "./error";
import { rasterizeSvgToPng } from "./rasterize";
import type { AssetSource, DrawSource, PosterData } from "./types";

/**
 * {@link Draw} 构造配置。
 *
 * `database` 须满足 {@link DrawSource}（素材 + 标签；推荐带曲目列表）。
 * 常见做法是传入任意 `@mai-kit/database` 的 `MaimaiDatabase` 实现。
 */
export interface DrawOptions {
  /**
   * 绘制所需数据源：
   * - `getChartTags`：谱面倾向雷达（必选）
   * - `getSongList`：有则自动填 `dx_max` / `level_value`（推荐）
   * - `getAsset`：封面 / 头像（渲染时拉取）
   */
  database: DrawSource;
}

/**
 * 单次 `render` / `renderSvg` 的公共选项。
 * 不传 `footerLeft` / `footerRight` 时不绘制页脚。
 *
 * @example
 * ```ts
 * const options: RenderOptions = {
 *   scale: 1,
 *   footerLeft: "my-bot",
 *   footerRight: "2026-07-12",
 * };
 * const png = await playerDraw.render("poster", options);
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
  /** 页脚左侧文案（画布左下） */
  footerLeft?: string;
  /** 页脚右侧文案（画布右下） */
  footerRight?: string;
}

/**
 * 可渲染的版式标识（均为 16:9、逻辑像素 1920×1080）。
 *
 * | layout | 内容 |
 * |--------|------|
 * | `poster` | 完整 B50 海报（左栏档案 + 右栏曲目） |
 * | `best15` | 新曲 B15 曲目板 |
 * | `best35` | 旧曲 B35 曲目板 |
 * | `best50` | B50 全曲板 |
 */
export type DrawLayout = "poster" | BestPage;

/**
 * 绘制入口：注入数据源后，用 {@link Draw.withPlayer} 绑定玩家成绩。
 *
 * 本身不持有成绩；持有成绩、可反复出图的是返回的 {@link PlayerDraw}。
 * `profile` / `bests` 来自任意 prober 适配，与具体查分服务无关。
 *
 * @example
 * ```ts
 * // profile、bests、database 均由你的适配 / 数据层提供
 * const playerDraw = await new Draw({ database }).withPlayer(profile, bests);
 * const png = await playerDraw.render("poster", { footerLeft: "my-app" });
 * // writeFileSync("poster.png", png);
 * ```
 */
export class Draw {
  private readonly database: DrawSource;

  /**
   * @param options - 必须提供 `database`（标签 + 素材；推荐同时支持曲目列表）
   */
  constructor(options: DrawOptions) {
    this.database = options.database;
  }

  /**
   * 将玩家档案与 Best50 聚合为 {@link PlayerDraw}。
   *
   * 会结合 `database` 补全展示所需信息（如谱面标签雷达、曲目定数 / DX 满分等）。
   * 同一 `PlayerDraw` 可多次 `render` / `renderSvg` 不同版式，无需重复聚合。
   *
   * @param profile - 玩家档案（如 `ProberPlayer.getProfile()`）
   * @param bests - Best50（如 `ProberPlayer.getBests()`；`dx` 前 15 + `standard` 前 35）
   * @returns 绑定该玩家数据的绘制对象
   * @throws {DrawError} 聚合所需数据不足等失败时
   */
  async withPlayer(profile: PlayerProfile, bests: Bests): Promise<PlayerDraw> {
    const data = await buildPlayerData(profile, bests, this.database);
    return new PlayerDraw(data, this.database);
  }

  /**
   * 海报版式输出尺寸（逻辑宽高 × scale）。
   * @param scale - 默认 2
   * @example Draw.getPosterSize(); // { width: 3840, height: 2160 }
   */
  static getPosterSize(scale = 2): { width: number; height: number } {
    return { width: POSTER_WIDTH * scale, height: POSTER_HEIGHT * scale };
  }

  /**
   * Best 单图版式输出尺寸（与海报同为 16:9）。
   * @param scale - 默认 2
   * @example Draw.getBestSize(1); // { width: 1920, height: 1080 }
   */
  static getBestSize(scale = 2): { width: number; height: number } {
    return { width: BEST_WIDTH * scale, height: BEST_HEIGHT * scale };
  }

  /**
   * 按版式返回输出尺寸。
   * @see getPosterSize
   * @see getBestSize
   */
  static getSize(layout: DrawLayout, scale = 2): { width: number; height: number } {
    return layout === "poster" ? Draw.getPosterSize(scale) : Draw.getBestSize(scale);
  }
}

/**
 * 已绑定单个玩家聚合数据（{@link PosterData}）的绘制对象。
 *
 * - {@link render} → PNG `Uint8Array`
 * - {@link renderSvg} → SVG 字符串
 * - 不负责落盘 / 下载；由宿主写文件或上传
 *
 * 通常由 {@link Draw.withPlayer} 创建；若已有完整 `PosterData`，也可直接 `new PlayerDraw(data)`。
 *
 * @example
 * ```ts
 * const playerDraw = await draw.withPlayer(profile, bests);
 * const poster = await playerDraw.render("poster");
 * const b15 = await playerDraw.render("best15", { scale: 1 });
 * const svg = await playerDraw.renderSvg("poster");
 * console.log(playerDraw.data.summary.b50);
 * ```
 */
export class PlayerDraw {
  /**
   * 聚合后的海报数据（成绩字段透传自输入的 profile/bests；部分展示字段可能已注入）。
   * 封面 / 头像 data URI 在首次渲染时解析，不一定已写回此对象。
   */
  readonly data: PosterData;
  private readonly database?: AssetSource;
  private resolvedData?: Promise<PosterData>;

  /**
   * @param data - 完整 {@link PosterData}
   * @param database - 可选；有则渲染时按 id 拉 jacket / icon
   */
  constructor(data: PosterData, database?: AssetSource) {
    this.data = data;
    this.database = database;
  }

  /**
   * 渲染指定版式为 PNG 字节（主路径：satori → SVG → resvg）。
   *
   * @param layout - 版式，见 {@link DrawLayout}
   * @param options - 缩放、页脚、自定义字体等
   * @returns PNG 二进制（非 base64）
   * @throws {DrawError} 字体 / satori / 栅格化失败时
   *
   * @example
   * ```ts
   * const png = await playerDraw.render("best50", { scale: 1 });
   * await writeFile("best50.png", png);
   * ```
   */
  async render(layout: DrawLayout, options: RenderOptions = {}): Promise<Uint8Array> {
    const scale = options.scale ?? 2;
    const svg = await this.renderSvg(layout, options);
    return rasterizeSvgToPng(svg, Draw.getSize(layout, scale).width);
  }

  /**
   * 渲染指定版式为 SVG 字符串（不经 resvg；适合再处理或调试）。
   *
   * @param layout - 版式，见 {@link DrawLayout}
   * @param options - 与 {@link render} 相同；`scale` 不影响 SVG 逻辑尺寸
   * @returns 完整 SVG 文档字符串
   * @throws {DrawError} 字体或 satori 失败时
   *
   * @example
   * ```ts
   * const svg = await playerDraw.renderSvg("poster", { footerLeft: "my-app" });
   * ```
   */
  async renderSvg(layout: DrawLayout, options: RenderOptions = {}): Promise<string> {
    const resolved = await this.resolveAssets();
    try {
      const fonts = options.fonts ?? (await loadFonts());
      const footers = {
        footerLeft: options.footerLeft,
        footerRight: options.footerRight,
      };
      const isPoster = layout === "poster";
      const element = isPoster
        ? createElement(B50Poster, { data: resolved, ...footers })
        : createElement(BestBoard, { data: resolved, page: layout, ...footers });
      return await satori(element, {
        width: isPoster ? POSTER_WIDTH : BEST_WIDTH,
        height: isPoster ? POSTER_HEIGHT : BEST_HEIGHT,
        fonts,
      });
    } catch (error) {
      throw new DrawError(`Failed to render ${layout} to SVG`, { cause: error });
    }
  }

  /**
   * 渲染前解析素材为 data URI（satori 同步，故在此并行完成）。
   * 结果会缓存于实例内，多次 render 只拉一次图。
   */
  private async resolveAssets(): Promise<PosterData> {
    this.resolvedData ??= this.loadAssets();
    return this.resolvedData;
  }

  private async loadAssets(): Promise<PosterData> {
    const { data, database } = this;

    const charts = await Promise.all(
      data.charts.map(async (chart) => {
        if (chart.coverDataUri) return chart;
        const fromPath = await loadLocalImage(chart.coverPath);
        if (fromPath) return { ...chart, coverDataUri: fromPath };
        if (!database) return chart;
        try {
          return {
            ...chart,
            coverDataUri: bytesDataUri(await database.getAsset("jacket", chart.id)),
          };
        } catch {
          return chart;
        }
      }),
    );

    const player = { ...data.player };
    if (!player.avatarDataUri) {
      const fromPath = await loadLocalImage(player.avatarPath);
      if (fromPath) {
        player.avatarDataUri = fromPath;
      } else if (database && player.icon?.id != null) {
        try {
          player.avatarDataUri = bytesDataUri(await database.getAsset("icon", player.icon.id));
        } catch {
          /* 占位头像 */
        }
      }
    }

    return { ...data, charts, player };
  }
}
