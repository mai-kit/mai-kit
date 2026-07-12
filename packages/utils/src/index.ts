/**
 * @packageDocumentation
 *
 * `@mai-kit/utils` 提供 maimai 成绩计算相关的纯函数，支持 Node 和浏览器。
 *
 * ## 常用
 *
 * ```ts
 * import {
 *   normalizeAchievement,
 *   dxMaxFromNoteTotal,
 *   calculateDxRating,
 *   rateFromAchievement,
 * } from "@mai-kit/utils";
 *
 * normalizeAchievement(1_008_621); // 100.8621
 * dxMaxFromNoteTotal(761);         // 2283
 * calculateDxRating(14.5, 100.5);  // 单曲 Rating（游戏内取整）
 * rateFromAchievement(100.5);      // "sssp"
 * ```
 *
 * 海报场景下 **填 chart.dx_max 仍由 `@mai-kit/draw` 完成**（内部调用本包）；
 * 只做公式计算时可以单独安装本包。
 *
 * 包根只导出常用稳定公式；完整判定工具与谱面索引分别见
 * `@mai-kit/utils/judgement`、`@mai-kit/utils/song`。
 */

export { normalizeAchievement } from "./achievement";
export { dxMaxFromNoteTotal, dxScorePercentage, dxStarFromScore, type DxStar } from "./dx-score";
export { parseLevelString } from "./level";
export {
  calculateAchievement,
  calculateChartDxScore,
  type ChartNoteCounts,
  type PartialChartJudgements,
} from "./judgement";
export { minimumAchievementForRate, rateFromAchievement } from "./rate";
export { calculateDxRating, dxRatingCoefficient, requiredLevelValue } from "./rating";
