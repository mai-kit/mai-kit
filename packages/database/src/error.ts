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
 * @see isMaimaiDatabaseError
 * @see MaiKitError
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
