/**
 * `@mai-kit/judgement-inference` 根据谱面物量与目标成绩，使用 GLPK/WASM 反推一组可行的
 * 完整判定分布。它与纯 TypeScript 的 `@mai-kit/judgement-solver` 分离，保持重依赖与
 * GPL-3.0-only 许可证只存在于最终应用按需使用的叶子包。
 *
 * 同一达成率和 DX 分可能对应多组判定；本包返回经过 `@mai-kit/utils` 回算验证的一组可行解，
 * 不声称还原玩家真实原始判定。Node 动态加载 `glpk.js/node`，浏览器动态加载内置 Web Worker
 * 的 `glpk.js`，公开 API 在两端一致。
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * import { inferJudgementDistribution } from "@mai-kit/judgement-inference";
 *
 * const judgements = await inferJudgementDistribution(
 *   { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 },
 *   { achievement: 90, dxScore: 20, judgementCounts: { great: 5 } },
 * );
 *
 * console.log(judgements.tap.great); // 5
 * ```
 */

export {
  JudgementInferenceError,
  JudgementInferenceNoExactSolutionError,
  isJudgementInferenceError,
  isJudgementInferenceNoExactSolutionError,
} from "./error";
export { inferJudgementDistribution } from "./inference";
export type {
  JudgementCountConstraint,
  JudgementInferenceFailureReason,
  JudgementInferenceOptions,
  JudgementInferenceSolverStatus,
  JudgementInferenceTarget,
} from "./models";
