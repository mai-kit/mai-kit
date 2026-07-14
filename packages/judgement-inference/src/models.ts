import type { NoteJudgements } from "@mai-kit/utils/judgement";

/** 可按全谱面汇总判定数量施加的精确约束。 */
export type JudgementCountConstraint = Partial<NoteJudgements>;

/** 反向求解必须满足的目标成绩。 */
export interface JudgementInferenceTarget {
  /** 目标达成率；接受百分数或万分位整数，精确匹配四位小数。 */
  achievement: number;
  /** 目标 DX 分；省略时不限制 DX 分。 */
  dxScore?: number;
  /** 全谱面 CP / P / GREAT / GOOD / MISS 汇总数量；缺省项不限制。 */
  judgementCounts?: JudgementCountConstraint;
}

/** 反向求解的运行选项。 */
export interface JudgementInferenceOptions {
  /** 单次 GLPK 求解时间上限（毫秒），默认 10000。 */
  timeLimitMs?: number;
  /**
   * 精确解失败后是否继续求最近解并附在错误中，默认 false。
   * 距离按达成率四位小数单位、DX 分和已指定汇总判定数的绝对差之和计算。
   */
  findNearestOnFailure?: boolean;
}

/** 精确解失败的归一化原因。 */
export type JudgementInferenceFailureReason =
  | "provenInfeasible"
  | "searchIncomplete"
  | "solverError"
  | "candidateMismatch";

/** 底层求解器状态的稳定文本。 */
export type JudgementInferenceSolverStatus =
  | "optimal"
  | "feasible"
  | "infeasible"
  | "noFeasible"
  | "undefined"
  | "unbounded"
  | "unknown";
