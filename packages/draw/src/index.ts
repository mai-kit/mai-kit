/**
 * @packageDocumentation
 *
 * `@mai-kit/draw` — 舞萌 DX 成绩海报 / Best 板绘制。
 *
 * 输入包括玩家档案、Best50，以及提供曲目、素材和谱面标签的 `database`。
 * 数据可以来自任意 prober 和 database 适配。
 *
 * ## 用法
 *
 * ```ts
 * // profile / bests：任意 prober 适配
 * // database：实现 Draw 所需能力的数据源（如任意 MaimaiDatabase）
 * const playerDraw = await new Draw({ database }).withPlayer(profile, bests);
 *
 * const png = await playerDraw.render("poster");
 * // 亦可 "best15" | "best35" | "best50"
 * const svg = await playerDraw.renderSvg("poster");
 * ```
 *
 * - **聚合**：`Draw.withPlayer`（补全展示用字段、雷达等）
 * - **出图**：`PlayerDraw.render`（PNG）/ `renderSvg`（SVG）
 * - **落盘**：只返回 `Uint8Array` / 字符串，由宿主保存或上传
 *
 * ## 处理 PNG 结果
 *
 * Node 落盘：
 *
 * ```ts
 * import { writeFile } from "node:fs/promises";
 *
 * const png = await playerDraw.render("poster");
 * await writeFile("poster.png", png);
 * ```
 *
 * Web 预览：
 *
 * ```ts
 * const png = await playerDraw.render("poster");
 * const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
 * image.src = url;
 * ```
 *
 * [成绩海报指南](/guide/getting-started) · [包与职责](/guide/architecture)
 */

export * from "./types";
export * from "./error";
export { Draw, PlayerDraw } from "./draw";
export type { DrawLayout, DrawOptions, RenderOptions } from "./draw";
/** 布局组件使用的成绩格式化函数。 */
export { formatChartRating, formatDxScore, formatLevelConstant } from "./formatters";
/** 海报 JSX 布局与尺寸常量。 */
export { B50Poster, POSTER_WIDTH, POSTER_HEIGHT } from "./components/poster";
/** Best 板 JSX 布局、尺寸与网格几何。 */
export { BestBoard, BEST_WIDTH, BEST_HEIGHT, bestBoardLayout } from "./components/best-board";
/** Best 板页种与布局类型。 */
export type { BestPage, BestBoardLayout } from "./components/best-board";
