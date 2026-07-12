import { ProberError, type ProberErrorInit } from "../../error";

/**
 * Diving-Fish（水鱼）查分适配专用错误（继承 {@link ProberError}）。
 *
 * 调用方可用 {@link isDivingFishProberError} 区分数据源；
 * 也可用 {@link isProberError} / `isMaiKitError` 做更宽捕获。
 *
 * @see isDivingFishProberError
 */
export class DivingFishProberError extends ProberError {
  /**
   * @param init - 与 {@link ProberError} 相同的构造参数
   */
  constructor(init: ProberErrorInit) {
    super(init);
    this.name = "DivingFishProberError";
  }
}

/**
 * 类型守卫：是否为 {@link DivingFishProberError}。
 *
 * @param error - 任意捕获值
 * @returns 是否为 Diving-Fish 适配错误
 */
export function isDivingFishProberError(error: unknown): error is DivingFishProberError {
  return error instanceof DivingFishProberError;
}
