/**
 * @packageDocumentation
 *
 * `@mai-kit/draw` — 舞萌 DX 成绩海报 / Best 板 / 单曲卡 / 升分板绘制。
 *
 * 入口扁平：`new Draw({ database })` 后 **一种图一个方法**（成对 PNG / SVG）。
 * 末位共用 {@link RenderOptions}（`scale` / `fonts` / 页脚 / `assetFallback`）。
 * 单曲卡只展示谱面成绩，不画玩家栏。
 *
 * ## B50 海报
 *
 * ```ts
 * const draw = new Draw({ database });
 * const png = await draw.poster(profile, bests, {
 *   scale: 1,
 *   footerLeft: "my-app",
 * });
 * ```
 *
 * ## Best 板（署名 + prober `Bests`；库内只切割不排序）
 *
 * ```ts
 * const head = { name: profile.name, rating: profile.rating };
 * const opts = { scale: 1, footerLeft: "my-app" };
 * await draw.best15(head, bests, opts);
 * await draw.best35(head, bests, opts);
 * await draw.best50(head, bests, opts);
 * ```
 *
 * ## 单曲卡
 *
 * ```ts
 * const png = await draw.chart(scoreChart, { scale: 1 });
 * ```
 *
 * ## 加分板（全曲候选，宿主侧 analysis）
 *
 * ```ts
 * // 全曲 + 定数 + 真实 bests 地板；minRate 定目标评级（如 SSS+）
 * const candidates = rankBestsUpgradeCandidates(entries, {
 *   currentBests: bests,
 *   isNewSong,
 *   minRate: "sssp",
 *   limit: 10,
 * });
 * const png = await draw.upgrades({ candidates }, { scale: 1 });
 * ```
 *
 * - **落盘**：只返回 `Uint8Array` / 字符串，由宿主保存或上传
 *
 * ## 处理 PNG 结果
 *
 * Node 落盘：
 *
 * ```ts
 * import { writeFile } from "node:fs/promises";
 *
 * const png = await draw.poster(profile, bests);
 * await writeFile("poster.png", png);
 * ```
 *
 * Web 预览：
 *
 * ```ts
 * const png = await draw.poster(profile, bests);
 * const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
 * image.src = url;
 * ```
 *
 * [成绩海报指南](/guide/getting-started) · [包与职责](/guide/architecture)
 */

export * from "./types";
export * from "./error";
export { Draw } from "./draw";
export type { DrawOptions, RenderOptions } from "./draw";
/** 将 prober 档案 + Best50 聚合成 {@link PosterData}（高级；多数场景直接 `draw.poster`）。 */
export { buildPlayerData as buildPosterData } from "./player-data";
/** 布局组件使用的成绩格式化函数。 */
export { formatChartRating, formatDxScore, formatLevelConstant } from "./formatters";
/** 海报 JSX 布局与尺寸常量。 */
export { B50Poster, POSTER_WIDTH, POSTER_HEIGHT } from "./components/poster";
/** Best 板 JSX 布局、尺寸与网格几何。 */
export { BestBoard, BEST_WIDTH, BEST_HEIGHT, bestBoardLayout } from "./components/best-board";
/** Best 板页种与布局类型。 */
export type { BestPage, BestBoardLayout } from "./components/best-board";
/** 单曲卡 / 升分板布局（高级）。 */
export { ChartCardPoster, CHART_CARD_WIDTH, CHART_CARD_HEIGHT } from "./components/chart-card";
export {
  UpgradesBoard,
  UPGRADES_BOARD_WIDTH,
  UPGRADES_BOARD_HEIGHT,
} from "./components/upgrades-board";
