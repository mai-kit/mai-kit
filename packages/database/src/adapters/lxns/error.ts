import { MaimaiDatabaseError, type MaimaiDatabaseErrorInit } from "../../error";

/**
 * LXNS 静态数据 / 素材适配专用错误（继承 {@link MaimaiDatabaseError}）。
 *
 * @see {@link isLxnsDatabaseError}
 */
export class LxnsDatabaseError extends MaimaiDatabaseError {
  /**
   * @param init - 与 {@link MaimaiDatabaseError} 相同的构造参数
   */
  constructor(init: MaimaiDatabaseErrorInit) {
    super(init);
    this.name = "LxnsDatabaseError";
  }
}

/**
 * 类型守卫：是否为 {@link LxnsDatabaseError}。
 *
 * @param error - 任意捕获值
 * @returns 是否为 LXNS database 适配错误
 */
export function isLxnsDatabaseError(error: unknown): error is LxnsDatabaseError {
  return error instanceof LxnsDatabaseError;
}
