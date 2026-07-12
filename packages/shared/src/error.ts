/** {@link MaiKitError} 的构造选项。 */
export interface MaiKitErrorOptions {
  /** 机器可读错误码（HTTP 业务码、内部码等） */
  code?: number | string;
  /** 底层原因（保留原始异常） */
  cause?: unknown;
}

/**
 * mai-kit 领域错误统一基类。
 *
 * 各包（`ProberError` / `MaimaiDatabaseError` / `DrawError` 等）继承本类，
 * 调用方可以用 {@link isMaiKitError} 统一捕获所有 mai-kit 错误。
 *
 * @example
 * ```ts
 * try {
 *   await doSomething();
 * } catch (error) {
 *   if (isMaiKitError(error)) {
 *     console.error(error.name, error.code, error.message);
 *   }
 * }
 * ```
 *
 * @see {@link isMaiKitError}
 */
export class MaiKitError extends Error {
  /** 机器可读错误码 */
  readonly code?: number | string;

  constructor(message: string, options?: MaiKitErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MaiKitError";
    this.code = options?.code;
  }
}

/**
 * 类型守卫：任意包的 mai-kit 错误。
 *
 * @example
 * ```ts
 * try {
 *   await player.getProfile();
 * } catch (error) {
 *   if (isMaiKitError(error)) console.error(error.code, error.message);
 * }
 * ```
 */
export function isMaiKitError(error: unknown): error is MaiKitError {
  return error instanceof MaiKitError;
}
