/**
 * 创建一个惰性异步加载器：成功结果会复用，失败结果不会被永久缓存。
 *
 * @internal
 */
export function createRetryableCachedLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | undefined;

  return async () => {
    const attempt = (current ??= loader());
    try {
      return await attempt;
    } catch (error) {
      if (current === attempt) current = undefined;
      throw error;
    }
  };
}
