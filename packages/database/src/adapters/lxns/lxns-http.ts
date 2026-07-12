import { LxnsDatabaseError } from "./error";

/** LXNS API 默认根地址 */
export const LXNS_DEFAULT_BASE_URL = "https://maimai.lxns.net/api/v0/";

/** 查询参数仅允许可安全 stringify 的原始值 */
type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * LXNS 公共数据 HTTP 客户端（database 适配器专用）。
 *
 * 公共接口的响应约定：成功（2xx）直接返回原始 JSON 数据（无信封）；
 * 错误（非 2xx）返回 `{ success: false, code, message }`。因此成功路径直接返回
 * body，错误路径从错误信封取 code/message 并抛出 {@link LxnsDatabaseError}。
 */
export class LxnsHttp {
  readonly baseURL: string;

  constructor(options: { baseURL?: string } = {}) {
    this.baseURL = options.baseURL ?? LXNS_DEFAULT_BASE_URL;
  }

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`maimai/${path}`, this.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (error) {
      throw new LxnsDatabaseError({
        message: `Network request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: error,
      });
    }

    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
    }

    if (!response.ok) {
      const errBody = body && typeof body === "object" ? body : null;
      const code =
        errBody && "code" in errBody && typeof errBody.code === "number"
          ? errBody.code
          : response.status;
      const message =
        errBody && "message" in errBody && typeof errBody.message === "string"
          ? errBody.message
          : `Lxns API HTTP error (status: ${response.status})`;
      throw new LxnsDatabaseError({ code, status: response.status, message });
    }

    // 公共接口成功：直接返回原始 JSON（无信封）
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return body as T;
  }
}
