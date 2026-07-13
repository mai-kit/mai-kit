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
 * @see {@link isProberError}
 * @see {@link MaiKitError}
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

/** {@link ProberNotImplementedError} 构造参数 */
export interface ProberNotImplementedErrorInit {
  /**
   * 未实现的方法名（不含括号），如 `"getHeatmap"` 或能力接口上的查询名。
   */
  method: string;
  /**
   * 可选适配显示名（仅文案，不绑定具体适配类型），如 `"Diving-Fish"`。
   */
  adapter?: string;
  /** 覆盖默认 message */
  message?: string;
  /** 底层原因 */
  cause?: unknown;
}

/**
 * 当前查分源**无法实现**某查询能力时抛出的包级错误。
 *
 * 供各适配在「运行时仍被调用、但上游无对等接口」时使用。
 * 优先仍应用类型收窄（条件 client / `*Capability`）避免挂上不存在的方法；
 * 本错误用于必须实现完整接口或兼容层里的显式失败。
 *
 * 调用方可用 {@link isProberNotImplementedError} 与 HTTP/鉴权失败区分。
 *
 * @example 适配内
 * ```ts
 * throw new ProberNotImplementedError({
 *   method: "getHeatmap",
 *   adapter: "Diving-Fish",
 * });
 * ```
 *
 * @see {@link isProberNotImplementedError}
 * @see {@link ProberError}
 */
export class ProberNotImplementedError extends ProberError {
  /** 未实现的方法名 */
  readonly method: string;
  /** 适配显示名（若构造时传入） */
  readonly adapter?: string;

  /**
   * @param init - 方法名与可选适配名 / 文案
   */
  constructor(init: ProberNotImplementedErrorInit) {
    const message =
      init.message ??
      (init.adapter
        ? `${init.adapter} does not implement ${init.method}()`
        : `${init.method}() is not implemented`);
    super({ message, cause: init.cause });
    this.name = "ProberNotImplementedError";
    this.method = init.method;
    this.adapter = init.adapter;
  }
}

/**
 * 类型守卫：是否为 {@link ProberNotImplementedError}。
 *
 * @param error - 任意捕获值
 */
export function isProberNotImplementedError(error: unknown): error is ProberNotImplementedError {
  return error instanceof ProberNotImplementedError;
}
