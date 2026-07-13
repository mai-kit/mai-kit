/**
 * `@mai-kit/judgement-solver` 将谱面物量、已有判定和成绩目标组合成确定性的判定预算：
 * 可检查任意混合判定、求某一判定的剩余容错，并生成所有判定的独立容错表。
 *
 * 包内使用纯 TypeScript 和 `@mai-kit/utils` 的统一计分公式，无网络、文件系统、原生 addon
 * 或 WASM；Node 与现代浏览器返回相同结果。
 *
 * @packageDocumentation
 *
 * @example 已有失误后的剩余容错
 * ```ts
 * import { solveJudgementLimit } from "@mai-kit/judgement-solver";
 *
 * const solution = solveJudgementLimit(
 *   { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 },
 *   { noteType: "tap", judgement: "great" },
 *   {
 *     minimumAchievement: 90,
 *     existingJudgements: { tap: { great: 2 } },
 *   },
 * );
 *
 * console.log(solution?.remainingCount); // 3
 * ```
 */

export {
  evaluateJudgementPlan,
  JUDGEMENT_TARGETS,
  solveJudgementLimit,
  solveJudgementLimits,
} from "./solver";
export type {
  BreakJudgement,
  JudgementConstraints,
  JudgementConstraintViolation,
  JudgementLimitOptions,
  JudgementLimitSolution,
  JudgementPlanEvaluation,
  JudgementTarget,
  StandardJudgement,
  StandardNoteType,
} from "./models";
