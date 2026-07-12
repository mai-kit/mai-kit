import { MaiKitError } from "@mai-kit/shared";

/** {@link ProberError} 构造参数 */
export interface ProberErrorInit {
  /** 数据源返回的机器可读错误码 */
  code?: number;
  /** HTTP 状态码（若适用） */
  status?: number;
  /** 面向开发者的错误信息 */
  message: string;
  /** 底层网络或解析异常 */
  cause?: unknown;
}

/**
 * 查分器通用错误（鉴权失败、HTTP / 业务错误等）。
 *
 * 各适配可抛出本类的子类（如 `LxnsProberError`、`DivingFishProberError`）以区分数据源；
 * {@link isProberError} 对子类同样为 true。
 *
 * @param init - 错误信息与可选 `code` / `status` / `cause`
 * @see isProberError
 * @see MaiKitError
 */
export class ProberError extends MaiKitError {
  declare readonly code?: number;
  /** HTTP 状态码（若适用） */
  readonly status?: number;

  /**
   * @param init - 消息与可选码值
   */
  constructor(init: ProberErrorInit) {
    super(init.message, { code: init.code, cause: init.cause });
    this.name = "ProberError";
    this.status = init.status;
  }
}

/**
 * 类型守卫：是否为 {@link ProberError}（含各适配子类）。
 *
 * @param error - 任意捕获值
 * @returns 是否为查分器错误
 *
 * @example
 * ```ts
 * try {
 *   await player.getBests();
 * } catch (error) {
 *   if (isProberError(error)) console.error(error.status, error.message);
 * }
 * ```
 */
export function isProberError(error: unknown): error is ProberError {
  return error instanceof ProberError;
}
