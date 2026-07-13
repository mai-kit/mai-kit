/**
 * 可选 HTTP 超时 / 重试 / 同键并发合并。
 *
 * 供 database / prober 等适配在构造参数中显式开启；**默认不启用**。
 * 不绑定任何数据源 URL 或业务错误类型——调用方负责把失败映射为包级错误。
 */

/** 请求韧性选项；全部可选，省略即不启用对应能力。 */
export interface HttpResilienceOptions {
  /**
   * 单次请求超时（毫秒）。省略则不限制。
   * 超时错误 message 含 `timed out`，`cause` 为底层 abort（若运行时支持）。
   */
  timeoutMs?: number;
  /**
   * 首次失败后的**额外**重试次数（默认 `0` = 不重试）。
   * 仅网络失败或 HTTP 5xx 会重试；4xx 立即返回该响应。
   */
  retries?: number;
}

/**
 * 同键 in-flight 请求合并：并发相同 key 只执行一次 `fn`。
 *
 * 合并的应是「已读完 body 的结果」或单次消费的 Promise，不要合并裸 `Response`
 *（body 只能读一次）。
 */
export class RequestCoalescer {
  private readonly inflight = new Map<string, Promise<unknown>>();

  /**
   * 执行或加入进行中的同键任务。
   *
   * @typeParam T - `fn` 的成功返回类型
   * @param key - 合并键（如 `GET ${url}`）
   * @param fn - 实际请求；仅首个调用方会执行
   * @returns 与首个调用方共享的同一 Promise 结果
   */
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return existing as Promise<T>;
    }
    const pending = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }
}

/**
 * 带可选超时与重试的 `fetch`。
 *
 * @param input - 请求 URL
 * @param init - fetch init（勿与本函数的 timeout 抢用外部 `signal`）
 * @param options - 韧性选项
 * @returns Response（调用方读 body / 映射业务错误）
 */
export async function fetchWithResilience(
  input: string | URL,
  init: RequestInit | undefined,
  options: HttpResilienceOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 0;
  if (retries < 0 || !Number.isInteger(retries)) {
    throw new RangeError("retries must be a non-negative integer");
  }
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new RangeError("timeoutMs must be a positive finite number");
  }

  return attemptFetch(input, init, options.timeoutMs, retries);
}

async function attemptFetch(
  input: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number | undefined,
  retriesLeft: number,
): Promise<Response> {
  try {
    const response = await fetchOnce(input, init, timeoutMs);
    if (response.ok || response.status < 500 || retriesLeft === 0) {
      return response;
    }
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    if (retriesLeft === 0) throw error;
    return attemptFetch(input, init, timeoutMs, retriesLeft - 1);
  }
  return attemptFetch(input, init, timeoutMs, retriesLeft - 1);
}

async function fetchOnce(
  input: string | URL,
  init: RequestInit | undefined,
  timeoutMs?: number,
): Promise<Response> {
  if (timeoutMs === undefined) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
