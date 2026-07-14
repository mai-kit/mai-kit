import { normalizeAchievement } from "@mai-kit/utils";
import {
  BREAK_BASE_SCORES,
  BREAK_BONUS_SCORES,
  calculateAchievement,
  calculateChartDxScore,
  calculateMaxAchievementScores,
  dxMaxFromNoteCounts,
  normalizeChartNoteCounts,
  noteTotalFromCounts,
  NOTE_BASE_SCORES,
  NOTE_JUDGEMENT_RATES,
  type BreakJudgements,
  type ChartJudgements,
  type ChartNoteCounts,
  type NoteJudgements,
} from "@mai-kit/utils/judgement";
import type { LP, Options as GlpkOptions, Result as GlpkResult } from "glpk.js/node";
import { JudgementInferenceError, JudgementInferenceNoExactSolutionError } from "./error";
import type {
  JudgementCountConstraint,
  JudgementInferenceFailureReason,
  JudgementInferenceOptions,
  JudgementInferenceSolverStatus,
  JudgementInferenceTarget,
} from "./models";
import { createRetryableCachedLoader } from "./solver-runtime";

const NORMAL_TYPES = ["tap", "hold", "slide", "touch"] as const;
const NORMAL_JUDGEMENTS = ["criticalPerfect", "perfect", "great", "good", "miss"] as const;
const BREAK_JUDGEMENTS = [
  "criticalPerfect",
  "perfect-1",
  "perfect-2",
  "great-1",
  "great-2",
  "great-3",
  "good",
  "miss",
] as const;
const AGGREGATE_JUDGEMENTS = ["criticalPerfect", "perfect", "great", "good", "miss"] as const;
const DEFAULT_TIME_LIMIT_MS = 10_000;
const NODE_GLPK_SPECIFIER = "glpk.js/node";

type NormalType = (typeof NORMAL_TYPES)[number];
type NormalJudgement = (typeof NORMAL_JUDGEMENTS)[number];
type BreakJudgement = (typeof BREAK_JUDGEMENTS)[number];
type AggregateJudgement = (typeof AGGREGATE_JUDGEMENTS)[number];

type VariableInfo =
  | { name: string; noteType: NormalType; judgement: NormalJudgement }
  | { name: string; noteType: "break"; judgement: BreakJudgement };

interface GlpkModule {
  readonly GLP_MIN: number;
  readonly GLP_DB: number;
  readonly GLP_FX: number;
  readonly GLP_LO: number;
  readonly GLP_UP: number;
  readonly GLP_FEAS: number;
  readonly GLP_OPT: number;
  readonly GLP_INFEAS: number;
  readonly GLP_NOFEAS: number;
  readonly GLP_UNDEF: number;
  readonly GLP_UNBND: number;
  readonly GLP_MSG_OFF: number;
  solve(lp: LP, options?: number | GlpkOptions): GlpkResult | Promise<GlpkResult>;
}

interface DetailMatch {
  achievement: number;
  dxScore: number;
  judgementCounts: NoteJudgements;
  matched: boolean;
}

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions !== null &&
    typeof process.versions.node === "string"
  );
}

async function loadGlpk(): Promise<GlpkModule> {
  try {
    const module = isNodeRuntime()
      ? await import(/* @vite-ignore */ NODE_GLPK_SPECIFIER)
      : await import("glpk.js");
    const loader: unknown = module.default;
    if (typeof loader !== "function") {
      throw new JudgementInferenceError("glpk.js module did not provide a loader");
    }
    const loaded: unknown = await loader();
    if (!isGlpkModule(loaded)) {
      throw new JudgementInferenceError("glpk.js loader returned an invalid solver");
    }
    return loaded;
  } catch (error) {
    if (error instanceof JudgementInferenceError) throw error;
    throw new JudgementInferenceError("failed to load or initialize glpk.js solver", {
      cause: error,
    });
  }
}

const getGlpk = createRetryableCachedLoader(loadGlpk);

/**
 * 根据目标达成率、可选 DX 分与判定总数，反推一组满足条件的完整判定分布。
 *
 * 同一成绩通常对应多组判定；返回值只是任意一组经过 `@mai-kit/utils` 回算验证的可行解，
 * 不代表玩家实际产生的原始判定。精确解失败时默认直接抛错；只有显式开启
 * `findNearestOnFailure` 才会额外求最近解。
 *
 * @param noteCounts - 谱面各 Note 类型物量
 * @param target - 必须精确满足的达成率，以及可选 DX 分 / 汇总判定约束
 * @param options - 求解时间与最近解选项
 * @returns 一组完整的分类型判定
 * @throws {RangeError} 输入物量、目标或约束非法
 * @throws {JudgementInferenceNoExactSolutionError} 没有返回精确解
 * @throws {JudgementInferenceError} 求解器加载或运行失败
 *
 * @example 反推 10 个 TAP 的一组 90% 判定
 * ```ts
 * const judgements = await inferJudgementDistribution(
 *   { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 },
 *   {
 *     achievement: 90,
 *     dxScore: 20,
 *     judgementCounts: { great: 5 },
 *   },
 * );
 *
 * judgements.tap.great; // 5
 * ```
 */
export async function inferJudgementDistribution(
  noteCounts: Partial<ChartNoteCounts>,
  target: JudgementInferenceTarget,
  options?: JudgementInferenceOptions,
): Promise<ChartJudgements> {
  const counts = normalizeCounts(noteCounts);
  const normalizedTarget = normalizeTarget(counts, target);
  const normalizedOptions = normalizeOptions(options);
  const glpk = await getGlpk();
  const model = buildExactModel(glpk, counts, normalizedTarget);

  let exactStatus: number | undefined;
  let exactMatch: DetailMatch | undefined;
  try {
    const result = await glpk.solve(
      model.lp,
      solveOptions(glpk, normalizedOptions.timeLimitMs, 0.2),
    );
    exactStatus = result.result.status;
    if (exactStatus === glpk.GLP_OPT || exactStatus === glpk.GLP_FEAS) {
      const judgements = buildJudgements(model.variables, result.result.vars);
      exactMatch = evaluateMatch(counts, judgements, normalizedTarget);
      if (exactMatch.matched) return judgements;
    }
  } catch (error) {
    throw new JudgementInferenceNoExactSolutionError(
      "judgement inference solver failed before returning an exact solution",
      {
        reason: "solverError",
        solverStatus: statusFromCode(glpk, exactStatus),
        provenInfeasible: false,
      },
      { cause: error },
    );
  }

  const reason = failureReason(glpk, exactStatus, exactMatch);
  const solverStatus = statusFromCode(glpk, exactStatus);
  const provenInfeasible = exactStatus === glpk.GLP_NOFEAS;

  if (!normalizedOptions.findNearestOnFailure) {
    throw new JudgementInferenceNoExactSolutionError(
      `judgement inference did not find an exact solution: ${solverStatus}`,
      { reason, solverStatus, provenInfeasible },
    );
  }

  let nearestJudgements: ChartJudgements | undefined;
  try {
    const nearestModel = buildNearestModel(glpk, model, counts, normalizedTarget);
    const nearestResult = await glpk.solve(
      nearestModel,
      solveOptions(glpk, normalizedOptions.timeLimitMs, 0),
    );
    // GLP_FEAS may only be a timeout incumbent; “nearest” requires a proven optimum.
    if (nearestResult.result.status === glpk.GLP_OPT) {
      nearestJudgements = buildJudgements(model.variables, nearestResult.result.vars);
      if (evaluateMatch(counts, nearestJudgements, normalizedTarget).matched) {
        return nearestJudgements;
      }
    }
  } catch (error) {
    throw new JudgementInferenceError(
      "judgement inference failed while searching for the requested nearest solution",
      { cause: error },
    );
  }

  throw new JudgementInferenceNoExactSolutionError(
    `judgement inference did not find an exact solution: ${solverStatus}`,
    {
      reason,
      solverStatus,
      provenInfeasible,
      ...(nearestJudgements === undefined ? {} : { nearestJudgements }),
    },
  );
}

interface NormalizedTarget {
  achievement: number;
  dxScore?: number;
  judgementCounts?: JudgementCountConstraint;
}

interface NormalizedOptions {
  timeLimitMs: number;
  findNearestOnFailure: boolean;
}

interface BuiltModel {
  lp: LP;
  variables: VariableInfo[];
  achievementTerms: Array<{ name: string; coef: number }>;
  dxTerms: Array<{ name: string; coef: number }>;
  judgementTerms: Record<AggregateJudgement, string[]>;
  typeTerms: Record<NormalType | "break", string[]>;
  bounds: NonNullable<LP["bounds"]>;
  generals: string[];
  achievementLower: number;
  achievementUpper: number;
}

function normalizeCounts(noteCounts: Partial<ChartNoteCounts>): ChartNoteCounts {
  const counts = normalizeChartNoteCounts(noteCounts);
  if (noteTotalFromCounts(counts) === 0) {
    throw new RangeError("chart must contain at least one note");
  }
  return counts;
}

function normalizeTarget(
  counts: ChartNoteCounts,
  target: JudgementInferenceTarget,
): NormalizedTarget {
  const achievement = normalizeAchievement(target.achievement);
  if (!Number.isFinite(achievement) || achievement < 0 || achievement > 101) {
    throw new RangeError("achievement must be between 0 and 101");
  }

  const dxMax = dxMaxFromNoteCounts(counts);
  if (
    target.dxScore !== undefined &&
    (!Number.isInteger(target.dxScore) || target.dxScore < 0 || target.dxScore > dxMax)
  ) {
    throw new RangeError(`dxScore must be an integer between 0 and ${dxMax}`);
  }

  if (target.judgementCounts !== undefined) {
    validateJudgementCounts(noteTotalFromCounts(counts), target.judgementCounts);
  }

  return {
    achievement,
    ...(target.dxScore === undefined ? {} : { dxScore: target.dxScore }),
    ...(target.judgementCounts === undefined
      ? {}
      : { judgementCounts: { ...target.judgementCounts } }),
  };
}

function normalizeOptions(options?: JudgementInferenceOptions): NormalizedOptions {
  const timeLimitMs = options?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    throw new RangeError("timeLimitMs must be greater than 0");
  }
  return {
    timeLimitMs,
    findNearestOnFailure: options?.findNearestOnFailure === true,
  };
}

function validateJudgementCounts(totalNotes: number, targets: JudgementCountConstraint): void {
  let specifiedTotal = 0;
  for (const judgement of AGGREGATE_JUDGEMENTS) {
    const count = targets[judgement];
    if (count === undefined) continue;
    if (!Number.isInteger(count) || count < 0 || count > totalNotes) {
      throw new RangeError(`${judgement} count must be an integer between 0 and ${totalNotes}`);
    }
    specifiedTotal += count;
  }
  if (specifiedTotal > totalNotes) {
    throw new RangeError("specified judgement counts exceed chart note total");
  }
  if (
    AGGREGATE_JUDGEMENTS.every((judgement) => targets[judgement] !== undefined) &&
    specifiedTotal !== totalNotes
  ) {
    throw new RangeError("fully specified judgement counts must equal chart note total");
  }
}

function buildExactModel(
  glpk: GlpkModule,
  counts: ChartNoteCounts,
  target: NormalizedTarget,
): BuiltModel {
  const maximum = calculateMaxAchievementScores(counts);
  const hasBreakBonus = maximum.bonus > 0;
  const achievementTerms: Array<{ name: string; coef: number }> = [];
  const dxTerms: Array<{ name: string; coef: number }> = [];
  const judgementTerms: Record<AggregateJudgement, string[]> = {
    criticalPerfect: [],
    perfect: [],
    great: [],
    good: [],
    miss: [],
  };
  const typeTerms: Record<NormalType | "break", string[]> = {
    tap: [],
    hold: [],
    slide: [],
    touch: [],
    break: [],
  };
  const bounds: NonNullable<LP["bounds"]> = [];
  const generals: string[] = [];
  const variables: VariableInfo[] = [];
  let variableIndex = 0;

  const addVariable = (
    noteType: NormalType | "break",
    createVariable: (name: string) => VariableInfo,
    upperBound: number,
  ): string => {
    const name = `x${++variableIndex}`;
    variables.push(createVariable(name));
    generals.push(name);
    bounds.push({ name, type: glpk.GLP_DB, lb: 0, ub: upperBound });
    typeTerms[noteType].push(name);
    return name;
  };

  for (const noteType of NORMAL_TYPES) {
    for (const judgement of NORMAL_JUDGEMENTS) {
      const variableName = addVariable(
        noteType,
        (name) => ({ name, noteType, judgement }),
        counts[noteType],
      );
      achievementTerms.push({
        name: variableName,
        coef: (NOTE_BASE_SCORES[noteType] * NOTE_JUDGEMENT_RATES[judgement] * 100) / maximum.base,
      });
      dxTerms.push({ name: variableName, coef: dxCoefficient(judgement) });
      judgementTerms[judgement].push(variableName);
    }
  }

  for (const judgement of BREAK_JUDGEMENTS) {
    const variableName = addVariable(
      "break",
      (name) => ({ name, noteType: "break", judgement }),
      counts.break,
    );
    achievementTerms.push({
      name: variableName,
      coef:
        (BREAK_BASE_SCORES[judgement] * 100) / maximum.base +
        (hasBreakBonus ? BREAK_BONUS_SCORES[judgement] / maximum.bonus : 0),
    });
    dxTerms.push({ name: variableName, coef: dxCoefficient(aggregateBreakJudgement(judgement)) });
    judgementTerms[aggregateBreakJudgement(judgement)].push(variableName);
  }

  const achievementLower = target.achievement;
  const achievementUpper = target.achievement + 0.0001 - 1e-10;
  const subjectTo: LP["subjectTo"] = [];

  for (const noteType of [...NORMAL_TYPES, "break"] as const) {
    subjectTo.push({
      name: `${noteType}_sum`,
      vars: typeTerms[noteType].map((name) => ({ name, coef: 1 })),
      bnds: { type: glpk.GLP_FX, lb: counts[noteType], ub: counts[noteType] },
    });
  }
  subjectTo.push({
    name: "achievement_lower",
    vars: achievementTerms,
    bnds: { type: glpk.GLP_LO, lb: achievementLower, ub: 0 },
  });
  subjectTo.push({
    name: "achievement_upper",
    vars: achievementTerms,
    bnds: { type: glpk.GLP_UP, lb: 0, ub: achievementUpper },
  });

  if (target.dxScore !== undefined) {
    subjectTo.push({
      name: "dx_score",
      vars: dxTerms,
      bnds: { type: glpk.GLP_FX, lb: target.dxScore, ub: target.dxScore },
    });
  }
  if (target.judgementCounts !== undefined) {
    for (const judgement of AGGREGATE_JUDGEMENTS) {
      const count = target.judgementCounts[judgement];
      if (count === undefined) continue;
      subjectTo.push({
        name: `judgement_${judgement}`,
        vars: judgementTerms[judgement].map((name) => ({ name, coef: 1 })),
        bnds: { type: glpk.GLP_FX, lb: count, ub: count },
      });
    }
  }

  const lp: LP = {
    name: "mai_kit_judgement_inference_exact",
    objective: {
      direction: glpk.GLP_MIN,
      name: "feasibility",
      vars: [{ name: variables[0]?.name ?? "x1", coef: 1 }],
    },
    subjectTo,
    bounds,
    generals,
  };

  return {
    lp,
    variables,
    achievementTerms,
    dxTerms,
    judgementTerms,
    typeTerms,
    bounds,
    generals,
    achievementLower,
    achievementUpper,
  };
}

function buildNearestModel(
  glpk: GlpkModule,
  exact: BuiltModel,
  counts: ChartNoteCounts,
  target: NormalizedTarget,
): LP {
  const subjectTo: LP["subjectTo"] = [];
  for (const noteType of [...NORMAL_TYPES, "break"] as const) {
    subjectTo.push({
      name: `${noteType}_sum`,
      vars: exact.typeTerms[noteType].map((name) => ({ name, coef: 1 })),
      bnds: { type: glpk.GLP_FX, lb: counts[noteType], ub: counts[noteType] },
    });
  }

  const bounds = [...exact.bounds];
  const objectiveTerms: Array<{ name: string; coef: number }> = [];
  const addSlack = (name: string, coefficient: number): string => {
    bounds.push({ name, type: glpk.GLP_LO, lb: 0, ub: 0 });
    objectiveTerms.push({ name, coef: coefficient });
    return name;
  };

  const achievementUnder = addSlack("slack_achievement_under", 10_000);
  const achievementOver = addSlack("slack_achievement_over", 10_000);
  subjectTo.push({
    name: "achievement_lower_soft",
    vars: [...exact.achievementTerms, { name: achievementUnder, coef: 1 }],
    bnds: { type: glpk.GLP_LO, lb: exact.achievementLower, ub: 0 },
  });
  subjectTo.push({
    name: "achievement_upper_soft",
    vars: [...exact.achievementTerms, { name: achievementOver, coef: -1 }],
    bnds: { type: glpk.GLP_UP, lb: 0, ub: exact.achievementUpper },
  });

  if (target.dxScore !== undefined) {
    const dxPositive = addSlack("slack_dx_positive", 1);
    const dxNegative = addSlack("slack_dx_negative", 1);
    subjectTo.push({
      name: "dx_score_soft",
      vars: [...exact.dxTerms, { name: dxPositive, coef: -1 }, { name: dxNegative, coef: 1 }],
      bnds: { type: glpk.GLP_FX, lb: target.dxScore, ub: target.dxScore },
    });
  }

  if (target.judgementCounts !== undefined) {
    for (const judgement of AGGREGATE_JUDGEMENTS) {
      const count = target.judgementCounts[judgement];
      if (count === undefined) continue;
      const positive = addSlack(`slack_${judgement}_positive`, 1);
      const negative = addSlack(`slack_${judgement}_negative`, 1);
      subjectTo.push({
        name: `judgement_${judgement}_soft`,
        vars: [
          ...exact.judgementTerms[judgement].map((name) => ({ name, coef: 1 })),
          { name: positive, coef: -1 },
          { name: negative, coef: 1 },
        ],
        bnds: { type: glpk.GLP_FX, lb: count, ub: count },
      });
    }
  }

  return {
    name: "mai_kit_judgement_inference_nearest",
    objective: {
      direction: glpk.GLP_MIN,
      name: "distance",
      vars: objectiveTerms,
    },
    subjectTo,
    bounds,
    generals: exact.generals,
  };
}

function buildJudgements(
  variables: VariableInfo[],
  values: Record<string, number>,
): ChartJudgements {
  const judgements: ChartJudgements = {
    tap: emptyNormalJudgements(),
    hold: emptyNormalJudgements(),
    slide: emptyNormalJudgements(),
    touch: emptyNormalJudgements(),
    break: emptyBreakJudgements(),
  };
  for (const variable of variables) {
    const value = normalizeZero(Math.round(values[variable.name] ?? 0));
    if (variable.noteType === "break") {
      judgements.break[variable.judgement] = value;
    } else {
      judgements[variable.noteType][variable.judgement] = value;
    }
  }
  return judgements;
}

function evaluateMatch(
  counts: ChartNoteCounts,
  judgements: ChartJudgements,
  target: NormalizedTarget,
): DetailMatch {
  const achievement = calculateAchievement(counts, judgements);
  const { dxScore } = calculateChartDxScore(judgements);
  const judgementCounts = aggregateJudgements(judgements);
  const judgementMatched =
    target.judgementCounts === undefined ||
    AGGREGATE_JUDGEMENTS.every((judgement) => {
      const expected = target.judgementCounts?.[judgement];
      return expected === undefined || judgementCounts[judgement] === expected;
    });
  return {
    achievement,
    dxScore,
    judgementCounts,
    matched:
      achievement === target.achievement &&
      (target.dxScore === undefined || dxScore === target.dxScore) &&
      judgementMatched,
  };
}

function aggregateJudgements(judgements: ChartJudgements): NoteJudgements {
  return {
    criticalPerfect:
      judgements.tap.criticalPerfect +
      judgements.hold.criticalPerfect +
      judgements.slide.criticalPerfect +
      judgements.touch.criticalPerfect +
      judgements.break.criticalPerfect,
    perfect:
      judgements.tap.perfect +
      judgements.hold.perfect +
      judgements.slide.perfect +
      judgements.touch.perfect +
      judgements.break["perfect-1"] +
      judgements.break["perfect-2"],
    great:
      judgements.tap.great +
      judgements.hold.great +
      judgements.slide.great +
      judgements.touch.great +
      judgements.break["great-1"] +
      judgements.break["great-2"] +
      judgements.break["great-3"],
    good:
      judgements.tap.good +
      judgements.hold.good +
      judgements.slide.good +
      judgements.touch.good +
      judgements.break.good,
    miss:
      judgements.tap.miss +
      judgements.hold.miss +
      judgements.slide.miss +
      judgements.touch.miss +
      judgements.break.miss,
  };
}

function emptyNormalJudgements(): NoteJudgements {
  return { criticalPerfect: 0, perfect: 0, great: 0, good: 0, miss: 0 };
}

function emptyBreakJudgements(): BreakJudgements {
  return {
    criticalPerfect: 0,
    "perfect-1": 0,
    "perfect-2": 0,
    "great-1": 0,
    "great-2": 0,
    "great-3": 0,
    good: 0,
    miss: 0,
  };
}

function aggregateBreakJudgement(judgement: BreakJudgement): AggregateJudgement {
  if (judgement === "criticalPerfect") return "criticalPerfect";
  if (judgement === "perfect-1" || judgement === "perfect-2") return "perfect";
  if (judgement === "great-1" || judgement === "great-2" || judgement === "great-3") {
    return "great";
  }
  return judgement;
}

function dxCoefficient(judgement: AggregateJudgement): number {
  if (judgement === "criticalPerfect") return 3;
  if (judgement === "perfect") return 2;
  if (judgement === "great") return 1;
  return 0;
}

function solveOptions(glpk: GlpkModule, timeLimitMs: number, mipgap: number): GlpkOptions {
  return {
    msglev: glpk.GLP_MSG_OFF,
    presol: true,
    tmlim: timeLimitMs / 1000,
    mipgap,
  };
}

function statusFromCode(
  glpk: GlpkModule,
  status: number | undefined,
): JudgementInferenceSolverStatus {
  if (status === glpk.GLP_OPT) return "optimal";
  if (status === glpk.GLP_FEAS) return "feasible";
  if (status === glpk.GLP_INFEAS) return "infeasible";
  if (status === glpk.GLP_NOFEAS) return "noFeasible";
  if (status === glpk.GLP_UNDEF) return "undefined";
  if (status === glpk.GLP_UNBND) return "unbounded";
  return "unknown";
}

function failureReason(
  glpk: GlpkModule,
  status: number | undefined,
  match: DetailMatch | undefined,
): JudgementInferenceFailureReason {
  if (match !== undefined && !match.matched) return "candidateMismatch";
  if (status === glpk.GLP_NOFEAS) return "provenInfeasible";
  return "searchIncomplete";
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function isGlpkModule(value: unknown): value is GlpkModule {
  if (typeof value !== "object" || value === null) return false;
  return (
    "solve" in value &&
    typeof value.solve === "function" &&
    "GLP_MIN" in value &&
    typeof value.GLP_MIN === "number" &&
    "GLP_OPT" in value &&
    typeof value.GLP_OPT === "number" &&
    "GLP_NOFEAS" in value &&
    typeof value.GLP_NOFEAS === "number"
  );
}
