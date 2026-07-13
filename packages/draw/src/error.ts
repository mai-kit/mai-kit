import { MaiKitError } from "@mai-kit/shared";

/**
 * 绘制层错误：字体加载、satori、resvg 或玩家数据聚合（如雷达标签不足）失败时抛出。
 * @see {@link isDrawError}
 */
export class DrawError extends MaiKitError {
  constructor(message: string, options?: { code?: number | string; cause?: unknown }) {
    super(message, options);
    this.name = "DrawError";
  }
}

/**
 * 类型守卫：是否为 {@link DrawError}。
 *
 * @example
 * ```ts
 * try {
 *   await draw.poster(profile, bests);
 * } catch (error) {
 *   if (isDrawError(error)) console.error(error.message);
 * }
 * ```
 */
export function isDrawError(error: unknown): error is DrawError {
  return error instanceof DrawError;
}
