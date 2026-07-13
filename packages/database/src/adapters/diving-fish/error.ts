import { MaimaiDatabaseError, type MaimaiDatabaseErrorInit } from "../../error";

/**
 * Diving-Fish（水鱼）静态数据 / 素材适配专用错误（继承 {@link MaimaiDatabaseError}）。
 *
 * @see {@link isDivingFishDatabaseError}
 */
export class DivingFishDatabaseError extends MaimaiDatabaseError {
  /**
   * @param init - 与 {@link MaimaiDatabaseError} 相同的构造参数
   */
  constructor(init: MaimaiDatabaseErrorInit) {
    super(init);
    this.name = "DivingFishDatabaseError";
  }
}

/**
 * 类型守卫：是否为 {@link DivingFishDatabaseError}。
 *
 * @param error - 任意捕获值
 * @returns 是否为 Diving-Fish database 适配错误
 */
export function isDivingFishDatabaseError(error: unknown): error is DivingFishDatabaseError {
  return error instanceof DivingFishDatabaseError;
}
