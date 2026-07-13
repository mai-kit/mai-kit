import { MaiKitError } from "@mai-kit/shared";

/** {@link MaimaiDatabaseError} 构造参数 */
export interface MaimaiDatabaseErrorInit {
  /** 数据源业务错误码 */
  code?: number;
  /** HTTP 状态码 */
  status?: number;
  /** 面向开发者的错误信息 */
  message: string;
  /** 底层网络、缓存或解析异常 */
  cause?: unknown;
}

/**
 * 静态数据 / 素材访问的通用错误（HTTP 或业务失败）。
 *
 * 各适配可抛出本类的子类（如 `LxnsDatabaseError`、`DivingFishDatabaseError`）以区分数据源；
 * {@link isMaimaiDatabaseError} 对子类同样为 true。
 *
 * @see {@link isMaimaiDatabaseError}
 * @see {@link MaiKitError}
 */
export class MaimaiDatabaseError extends MaiKitError {
  declare readonly code?: number;
  /** HTTP 状态码（若适用） */
  readonly status?: number;

  /**
   * @param init - 消息与可选码值
   */
  constructor(init: MaimaiDatabaseErrorInit) {
    super(init.message, { code: init.code, cause: init.cause });
    this.name = "MaimaiDatabaseError";
    this.status = init.status;
  }
}

/**
 * 类型守卫：是否为 {@link MaimaiDatabaseError}（含各适配子类）。
 *
 * @param error - 任意捕获值
 * @returns 是否为 database 错误
 *
 * @example
 * ```ts
 * try {
 *   await database.getSong(114);
 * } catch (error) {
 *   if (isMaimaiDatabaseError(error)) console.error(error.status, error.message);
 * }
 * ```
 */
export function isMaimaiDatabaseError(error: unknown): error is MaimaiDatabaseError {
  return error instanceof MaimaiDatabaseError;
}

/** {@link MaimaiDatabaseNotImplementedError} 构造参数 */
export interface MaimaiDatabaseNotImplementedErrorInit {
  /**
   * 未实现的 {@link MaimaiDatabase} 方法名（不含括号），如 `"getAliasList"`。
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
 * 当前数据源**无法实现** {@link MaimaiDatabase} 某一方法时抛出的包级错误。
 *
 * 供各适配在「接口必须实现、上游无对等能力」时使用；调用方可用
 * {@link isMaimaiDatabaseNotImplementedError} 做能力降级（与 HTTP/业务失败区分）。
 *
 * @example 适配内
 * ```ts
 * throw new MaimaiDatabaseNotImplementedError({
 *   method: "getAliasList",
 *   adapter: "Diving-Fish",
 * });
 * ```
 *
 * @example 调用方
 * ```ts
 * try {
 *   aliases = await db.getAliasList();
 * } catch (error) {
 *   if (isMaimaiDatabaseNotImplementedError(error)) {
 *     // 换数据源或跳过
 *   }
 * }
 * ```
 *
 * @see {@link isMaimaiDatabaseNotImplementedError}
 * @see {@link MaimaiDatabaseError}
 */
export class MaimaiDatabaseNotImplementedError extends MaimaiDatabaseError {
  /** 未实现的方法名 */
  readonly method: string;
  /** 适配显示名（若构造时传入） */
  readonly adapter?: string;

  /**
   * @param init - 方法名与可选适配名 / 文案
   */
  constructor(init: MaimaiDatabaseNotImplementedErrorInit) {
    const message =
      init.message ??
      (init.adapter
        ? `${init.adapter} does not implement MaimaiDatabase.${init.method}()`
        : `MaimaiDatabase.${init.method}() is not implemented`);
    super({ message, cause: init.cause });
    this.name = "MaimaiDatabaseNotImplementedError";
    this.method = init.method;
    this.adapter = init.adapter;
  }
}

/**
 * 类型守卫：是否为 {@link MaimaiDatabaseNotImplementedError}。
 *
 * @param error - 任意捕获值
 */
export function isMaimaiDatabaseNotImplementedError(
  error: unknown,
): error is MaimaiDatabaseNotImplementedError {
  return error instanceof MaimaiDatabaseNotImplementedError;
}
