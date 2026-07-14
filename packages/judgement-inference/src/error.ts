import { MaiKitError, type MaiKitErrorOptions } from "@mai-kit/shared";
import type { ChartJudgements } from "@mai-kit/utils/judgement";
import type { JudgementInferenceFailureReason, JudgementInferenceSolverStatus } from "./models";

/** 判定反推包的统一错误。 */
export class JudgementInferenceError extends MaiKitError {
  constructor(message: string, options?: MaiKitErrorOptions) {
    super(message, options);
    this.name = "JudgementInferenceError";
  }
}

/** 精确反推没有返回可用判定分布时的结构化错误。 */
export class JudgementInferenceNoExactSolutionError extends JudgementInferenceError {
  /** 精确求解失败原因。 */
  readonly reason: JudgementInferenceFailureReason;
  /** 归一化后的底层求解状态。 */
  readonly solverStatus: JudgementInferenceSolverStatus;
  /** 是否已由求解器证明不存在精确解。 */
  readonly provenInfeasible: boolean;
  /** 调用方显式要求最近解，且求解器已证明最优时的一组最近判定。 */
  readonly nearestJudgements?: ChartJudgements;

  constructor(
    message: string,
    details: {
      reason: JudgementInferenceFailureReason;
      solverStatus: JudgementInferenceSolverStatus;
      provenInfeasible: boolean;
      nearestJudgements?: ChartJudgements;
    },
    options?: MaiKitErrorOptions,
  ) {
    super(message, options);
    this.name = "JudgementInferenceNoExactSolutionError";
    this.reason = details.reason;
    this.solverStatus = details.solverStatus;
    this.provenInfeasible = details.provenInfeasible;
    this.nearestJudgements = details.nearestJudgements;
  }
}

/** 判断错误是否来自判定反推包。 */
export function isJudgementInferenceError(error: unknown): error is JudgementInferenceError {
  return error instanceof JudgementInferenceError;
}

/** 判断错误是否表示没有返回精确反推结果。 */
export function isJudgementInferenceNoExactSolutionError(
  error: unknown,
): error is JudgementInferenceNoExactSolutionError {
  return error instanceof JudgementInferenceNoExactSolutionError;
}
