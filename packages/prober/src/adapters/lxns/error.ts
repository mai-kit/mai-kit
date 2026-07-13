import { ProberError, type ProberErrorInit } from "../../error";

/**
 * LXNS 查分适配专用错误（继承 {@link ProberError}）。
 *
 * 调用方可用 {@link isLxnsProberError} 区分数据源；
 * 也可用 {@link isProberError} / `isMaiKitError` 做更宽捕获。
 *
 * @see {@link isLxnsProberError}
 */
export class LxnsProberError extends ProberError {
  /**
   * @param init - 与 {@link ProberError} 相同的构造参数
   */
  constructor(init: ProberErrorInit) {
    super(init);
    this.name = "LxnsProberError";
  }
}

/**
 * 类型守卫：是否为 {@link LxnsProberError}。
 *
 * @param error - 任意捕获值
 * @returns 是否为 LXNS 适配错误
 */
export function isLxnsProberError(error: unknown): error is LxnsProberError {
  return error instanceof LxnsProberError;
}
