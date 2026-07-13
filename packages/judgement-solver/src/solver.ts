import type { FCType } from "@mai-kit/shared";
import { calculateAchievement, calculateChartDxScore, normalizeAchievement } from "@mai-kit/utils";
import {
  normalizeChartJudgements,
  normalizeChartNoteCounts,
  noteTotalFromCounts,
  type ChartJudgements,
  type ChartNoteCounts,
  type NoteJudgements,
  type NoteType,
  type PartialChartJudgements,
} from "@mai-kit/utils/judgement";
import type {
  JudgementConstraintViolation,
  JudgementConstraints,
  JudgementLimitOptions,
  JudgementLimitSolution,
  JudgementPlanEvaluation,
  JudgementTarget,
} from "./models";

const NOTE_TYPES = ["tap", "hold", "slide", "touch", "break"] as const;
const STANDARD_NOTE_TYPES = ["tap", "hold", "slide", "touch"] as const;
const STANDARD_JUDGEMENTS = ["perfect", "great", "good", "miss"] as const;
const BREAK_JUDGEMENTS = [
  "perfect-1",
  "perfect-2",
  "great-1",
  "great-2",
  "great-3",
  "good",
  "miss",
] as const;
const NOTE_JUDGEMENTS = ["criticalPerfect", "perfect", "great", "good", "miss"] as const;
const ALL_BREAK_JUDGEMENTS = ["criticalPerfect", ...BREAK_JUDGEMENTS] as const;
const FC_LEVELS: Readonly<Record<FCType, number>> = {
  fc: 1,
  fcp: 2,
  ap: 3,
  app: 4,
};

/** 所有可查询的非 Critical Perfect 单项目标。 */
export const JUDGEMENT_TARGETS = [
  ...STANDARD_NOTE_TYPES.flatMap((noteType) =>
    STANDARD_JUDGEMENTS.map((judgement) => ({ noteType, judgement })),
  ),
  ...BREAK_JUDGEMENTS.map((judgement) => ({ noteType: "break" as const, judgement })),
] as const satisfies readonly JudgementTarget[];

interface PreparedJudgements {
  existing: ChartJudgements;
  remaining: ChartNoteCounts;
}

interface NormalizedConstraints {
  minimumAchievement: number;
  minimumDxScore?: number;
  minimumFc?: FCType;
}

/**
 * 检查一套任意混合判定是否满足成绩约束。
 *
 * `judgements` 中已经列出的判定视为固定结果；每种 Note 类型尚未分配的数量全部补为
 * Critical Perfect。因此既可以传完整判定，也可以只传 GREAT / GOOD / MISS 等已知失误。
 *
 * @param noteCounts - 谱面各 Note 类型物量
 * @param judgements - 已知判定；未分配的 Note 自动补为 Critical Perfect
 * @param constraints - 最低达成率，以及可选 DX 分 / FC 标记约束
 * @returns 完整判定、成绩、FC 标记和未满足约束
 * @throws {RangeError} 物量为空、某类判定超过对应物量或约束越界
 *
 * @example 检查混合失误能否保持 SSS+
 * ```ts
 * const result = evaluateJudgementPlan(
 *   notes,
 *   {
 *     tap: { great: 3, good: 1 },
 *     break: { "perfect-1": 2 },
 *   },
 *   { minimumAchievement: 100.5 },
 * );
 *
 * console.log(result.satisfied, result.violations);
 * ```
 */
export function evaluateJudgementPlan(
  noteCounts: Partial<ChartNoteCounts>,
  judgements: PartialChartJudgements,
  constraints: JudgementConstraints,
): JudgementPlanEvaluation {
  const counts = normalizeCounts(noteCounts);
  const prepared = prepareJudgements(counts, judgements);
  const plan = completeJudgements(prepared.existing, prepared.remaining);
  const normalizedConstraints = normalizeConstraints(constraints, plan);
  return evaluateCompletedPlan(counts, plan, normalizedConstraints);
}

/**
 * 求一种非 Critical Perfect 判定在已有判定基础上还能出现多少个。
 *
 * 省略 `existingJudgements` 时得到理论单项容错；传入已有 GREAT / GOOD / MISS 后，得到
 * 实际剩余容错。新增目标判定以外的尚未分配 Note 均按 Critical Perfect 计算。
 *
 * @param noteCounts - 谱面各 Note 类型物量
 * @param target - 需要求剩余容错的 Note 类型与判定
 * @param options - 已有判定与成绩约束
 * @returns 最大剩余容错方案；已有判定已违反约束时返回 `null`
 * @throws {RangeError} 物量为空、已有判定超过物量、约束越界或目标判定非法
 *
 * @example 已有失误后的剩余容错
 * ```ts
 * const solution = solveJudgementLimit(
 *   { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 },
 *   { noteType: "tap", judgement: "great" },
 *   {
 *     minimumAchievement: 90,
 *     existingJudgements: { tap: { great: 2 } },
 *   },
 * );
 *
 * solution?.remainingCount; // 3（最终共 5 个 GREAT）
 * ```
 */
export function solveJudgementLimit(
  noteCounts: Partial<ChartNoteCounts>,
  target: JudgementTarget,
  options: JudgementLimitOptions,
): JudgementLimitSolution | null {
  const counts = normalizeCounts(noteCounts);
  assertTarget(target);
  const prepared = prepareJudgements(counts, options.existingJudgements);
  const baselinePlan = completeJudgements(prepared.existing, prepared.remaining);
  const constraints = normalizeConstraints(options, baselinePlan);
  const baseline = evaluateCompletedPlan(counts, baselinePlan, constraints);
  return solvePreparedLimit(counts, prepared, target, constraints, baseline);
}

/**
 * 生成所有非 Critical Perfect 判定的独立剩余容错表。
 *
 * 每个结果都从同一份 `existingJudgements` 单独求解，彼此不能相加。适合曲目详情页、Bot
 * 命令候选和两张谱面的容错对比。
 *
 * @param noteCounts - 谱面各 Note 类型物量
 * @param options - 已有判定与成绩约束
 * @returns 与 {@link JUDGEMENT_TARGETS} 同序的独立结果；已有判定已违反约束时返回 `null`
 * @throws {RangeError} 物量为空、已有判定超过物量或约束越界
 *
 * @example 生成 SSS+ 独立容错表
 * ```ts
 * const limits = solveJudgementLimits(notes, { minimumAchievement: 100.5 });
 * const tapGreat = limits?.find(
 *   ({ target }) => target.noteType === "tap" && target.judgement === "great",
 * );
 * ```
 */
export function solveJudgementLimits(
  noteCounts: Partial<ChartNoteCounts>,
  options: JudgementLimitOptions,
): JudgementLimitSolution[] | null {
  const counts = normalizeCounts(noteCounts);
  const prepared = prepareJudgements(counts, options.existingJudgements);
  const baselinePlan = completeJudgements(prepared.existing, prepared.remaining);
  const constraints = normalizeConstraints(options, baselinePlan);
  const baseline = evaluateCompletedPlan(counts, baselinePlan, constraints);
  if (!baseline.satisfied) return null;

  const solutions: JudgementLimitSolution[] = [];
  for (const target of JUDGEMENT_TARGETS) {
    const solution = solvePreparedLimit(counts, prepared, target, constraints, baseline);
    if (solution === null) return null;
    solutions.push(solution);
  }
  return solutions;
}

function solvePreparedLimit(
  counts: ChartNoteCounts,
  prepared: PreparedJudgements,
  target: JudgementTarget,
  constraints: NormalizedConstraints,
  baseline: JudgementPlanEvaluation,
): JudgementLimitSolution | null {
  if (!baseline.satisfied) return null;

  const upperBound = satisfiesFcTarget(target, constraints.minimumFc)
    ? prepared.remaining[target.noteType]
    : 0;
  let low = 0;
  let high = upperBound;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const plan = completeJudgements(prepared.existing, prepared.remaining, target, middle);
    const evaluation = evaluateCompletedPlan(counts, plan, constraints);
    if (evaluation.satisfied) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  const plan = completeJudgements(prepared.existing, prepared.remaining, target, low);
  return {
    target,
    remainingCount: low,
    ...evaluateCompletedPlan(counts, plan, constraints),
  };
}

function normalizeCounts(noteCounts: Partial<ChartNoteCounts>): ChartNoteCounts {
  const counts = normalizeChartNoteCounts(noteCounts);
  if (noteTotalFromCounts(counts) === 0) {
    throw new RangeError("chart must contain at least one note");
  }
  return counts;
}

function prepareJudgements(
  counts: ChartNoteCounts,
  input?: PartialChartJudgements,
): PreparedJudgements {
  const existing = normalizeChartJudgements(input);
  const remaining: ChartNoteCounts = { tap: 0, hold: 0, slide: 0, touch: 0, break: 0 };

  for (const noteType of NOTE_TYPES) {
    const assigned = judgementTotal(existing, noteType);
    if (assigned > counts[noteType]) {
      throw new RangeError(
        `${noteType} judgement total ${assigned} exceeds chart count ${counts[noteType]}`,
      );
    }
    remaining[noteType] = counts[noteType] - assigned;
  }

  return { existing, remaining };
}

function completeJudgements(
  existing: ChartJudgements,
  remaining: ChartNoteCounts,
  target?: JudgementTarget,
  targetCount = 0,
): ChartJudgements {
  const judgements = cloneJudgements(existing);
  const unassigned = { ...remaining };

  if (target !== undefined) {
    if (targetCount > unassigned[target.noteType]) {
      throw new RangeError(`${target.noteType} target count exceeds remaining note count`);
    }
    unassigned[target.noteType] -= targetCount;
    if (target.noteType === "break") {
      judgements.break[target.judgement] += targetCount;
    } else {
      judgements[target.noteType][target.judgement] += targetCount;
    }
  }

  for (const noteType of NOTE_TYPES) {
    judgements[noteType].criticalPerfect += unassigned[noteType];
  }
  return judgements;
}

function cloneJudgements(input: ChartJudgements): ChartJudgements {
  return {
    tap: { ...input.tap },
    hold: { ...input.hold },
    slide: { ...input.slide },
    touch: { ...input.touch },
    break: { ...input.break },
  };
}

function judgementTotal(judgements: ChartJudgements, noteType: NoteType): number {
  if (noteType === "break") {
    return ALL_BREAK_JUDGEMENTS.reduce((sum, judgement) => sum + judgements.break[judgement], 0);
  }
  return NOTE_JUDGEMENTS.reduce((sum, judgement) => sum + judgements[noteType][judgement], 0);
}

function normalizeConstraints(
  constraints: JudgementConstraints,
  completedPlan: ChartJudgements,
): NormalizedConstraints {
  const minimumAchievement = normalizeAchievement(constraints.minimumAchievement);
  if (!Number.isFinite(minimumAchievement) || minimumAchievement < 0 || minimumAchievement > 101) {
    throw new RangeError("minimumAchievement must be between 0 and 101");
  }
  if (constraints.minimumFc !== undefined && !Object.hasOwn(FC_LEVELS, constraints.minimumFc)) {
    throw new RangeError("minimumFc must be fc, fcp, ap, or app");
  }

  const { dxMax } = calculateChartDxScore(completedPlan);
  if (
    constraints.minimumDxScore !== undefined &&
    (!Number.isInteger(constraints.minimumDxScore) ||
      constraints.minimumDxScore < 0 ||
      constraints.minimumDxScore > dxMax)
  ) {
    throw new RangeError(`minimumDxScore must be an integer between 0 and ${dxMax}`);
  }

  return {
    minimumAchievement,
    minimumDxScore: constraints.minimumDxScore,
    minimumFc: constraints.minimumFc,
  };
}

function evaluateCompletedPlan(
  counts: ChartNoteCounts,
  judgements: ChartJudgements,
  constraints: NormalizedConstraints,
): JudgementPlanEvaluation {
  const achievement = calculateAchievement(counts, judgements);
  const { dxScore, dxMax } = calculateChartDxScore(judgements);
  const fc = fcFromJudgements(judgements);
  const violations: JudgementConstraintViolation[] = [];

  if (achievement < constraints.minimumAchievement) violations.push("achievement");
  if (constraints.minimumDxScore !== undefined && dxScore < constraints.minimumDxScore) {
    violations.push("dxScore");
  }
  if (
    constraints.minimumFc !== undefined &&
    (fc === null || FC_LEVELS[fc] < FC_LEVELS[constraints.minimumFc])
  ) {
    violations.push("fc");
  }

  return {
    judgements,
    achievement,
    dxScore,
    dxMax,
    fc,
    satisfied: violations.length === 0,
    violations,
  };
}

function fcFromJudgements(judgements: ChartJudgements): FCType | null {
  if (hasStandardJudgement(judgements, "miss") || judgements.break.miss > 0) return null;
  if (hasStandardJudgement(judgements, "good") || judgements.break.good > 0) return "fc";
  if (
    hasStandardJudgement(judgements, "great") ||
    judgements.break["great-1"] > 0 ||
    judgements.break["great-2"] > 0 ||
    judgements.break["great-3"] > 0
  ) {
    return "fcp";
  }
  if (
    hasStandardJudgement(judgements, "perfect") ||
    judgements.break["perfect-1"] > 0 ||
    judgements.break["perfect-2"] > 0
  ) {
    return "ap";
  }
  return "app";
}

function hasStandardJudgement(
  judgements: ChartJudgements,
  judgement: keyof NoteJudgements,
): boolean {
  return STANDARD_NOTE_TYPES.some((noteType) => judgements[noteType][judgement] > 0);
}

function satisfiesFcTarget(target: JudgementTarget, minimumFc?: FCType): boolean {
  if (minimumFc === undefined) return true;
  return judgementFcLevel(target) >= FC_LEVELS[minimumFc];
}

function judgementFcLevel(target: JudgementTarget): number {
  const judgement = target.judgement;
  if (judgement === "miss") return 0;
  if (judgement === "good") return FC_LEVELS.fc;
  if (judgement === "great" || judgement.startsWith("great-")) return FC_LEVELS.fcp;
  return FC_LEVELS.ap;
}

function assertTarget(target: JudgementTarget): void {
  if (target === null || typeof target !== "object") {
    throw new RangeError("target must be a judgement target");
  }
  if (target.noteType === "break") {
    if (!BREAK_JUDGEMENTS.includes(target.judgement)) {
      throw new RangeError(`invalid break judgement: ${target.judgement}`);
    }
    return;
  }

  if (!STANDARD_NOTE_TYPES.includes(target.noteType)) {
    throw new RangeError(`invalid note type: ${target.noteType}`);
  }
  if (!STANDARD_JUDGEMENTS.includes(target.judgement)) {
    throw new RangeError(`invalid standard judgement: ${target.judgement}`);
  }
}
