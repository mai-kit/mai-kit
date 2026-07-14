import { LxnsProberError } from "./error";
import type { ScoreQuery } from "../../models";
import { assertScoreQuery } from "../../score-query";
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";

/** LXNS API 默认根地址 */
export const LXNS_DEFAULT_BASE_URL = "https://maimai.lxns.net/api/v0/";

/** LXNS dev/personal 响应信封 */
interface LxnsEnvelope<T> {
  success: boolean;
  code: number;
  message?: string;
  data?: T;
}

/** 查询参数仅允许可安全 stringify 的原始值 */
type QueryParams = Record<string, string | number | boolean | null | undefined>;

function isLxnsEnvelope(body: unknown): body is LxnsEnvelope<unknown> {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  if (!("success" in body)) {
    return false;
  }
  return typeof body.success === "boolean";
}

export interface LxnsHttpOptions extends HttpResilienceOptions {
  baseURL: string;
  /** 路径前缀，dev 为 "maimai/"，personal 为 "user/maimai/" */
  pathPrefix: string;
  /** 鉴权头 */
  headers: Record<string, string>;
}

/**
 * LXNS dev/personal 接口 HTTP 客户端（prober 适配器专用）。
 *
 * dev/personal 接口的响应约定：成功返回 `{ success: true, code, data }`（需拆出 data）；
 * 错误返回 `{ success: false, code, message }`。成功路径拆 data，错误路径抛 {@link LxnsProberError}。
 *
 * 可选 `timeoutMs` / `retries`：默认关闭；相同 GET URL 的并发请求会合并为一次网络调用。
 */
export class LxnsHttp {
  private readonly coalescer = new RequestCoalescer();

  constructor(private readonly options: LxnsHttpOptions) {}

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const url = this.buildUrl(path, params);
    const key = `GET ${url.href}`;
    return this.coalescer.run(key, async () => this.getOnce<T>(url));
  }

  async getBytes(path: string, params?: QueryParams): Promise<Uint8Array> {
    const url = this.buildUrl(path, params);
    const key = `GET bytes ${url.href}`;
    return this.coalescer.run(key, async () => this.getBytesOnce(url));
  }

  private buildUrl(path: string, params?: QueryParams): URL {
    const url = new URL(`${this.options.pathPrefix}${path}`, this.options.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url;
  }

  private async request(url: URL): Promise<Response> {
    let response: Response;
    try {
      response = await fetchWithResilience(
        url,
        {
          headers: { Accept: "application/json", ...this.options.headers },
        },
        { timeoutMs: this.options.timeoutMs, retries: this.options.retries },
      );
    } catch (error) {
      throw new LxnsProberError({
        message: `Network request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: error,
      });
    }

    return response;
  }

  private async getOnce<T>(url: URL): Promise<T> {
    const response = await this.request(url);

    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
    }

    if (isLxnsEnvelope(body)) {
      if (body.success) {
        if (body.data === undefined) {
          throw new LxnsProberError({
            code: body.code,
            status: response.status,
            message: "Lxns API success response is missing data",
          });
        }
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return body.data as T;
      }
      throw new LxnsProberError({
        code: body.code,
        status: response.status,
        message: body.message ?? `Lxns API error (code: ${body.code})`,
      });
    }

    throw new LxnsProberError({
      code: response.status,
      status: response.status,
      message: response.ok
        ? `Lxns API returned an invalid response envelope (status: ${response.status})`
        : `Lxns API HTTP error (status: ${response.status})`,
    });
  }

  private async getBytesOnce(url: URL): Promise<Uint8Array> {
    const response = await this.request(url);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || contentType.includes("application/json")) {
      const text = await response.text();
      let body: unknown;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = undefined;
        }
      }
      if (isLxnsEnvelope(body) && !body.success) {
        throw new LxnsProberError({
          code: body.code,
          status: response.status,
          message: body.message ?? `Lxns API error (code: ${body.code})`,
        });
      }
      throw new LxnsProberError({
        code: response.status,
        status: response.status,
        message: response.ok
          ? "Lxns API binary endpoint returned JSON instead of bytes"
          : `Lxns API HTTP error (status: ${response.status})`,
      });
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

/** 谱面定位 / 查询 → LXNS 查询参数 */
export function scoreSearchParams(query: ScoreQuery): Record<string, string | number> {
  assertScoreQuery(query);
  const params: Record<string, string | number> = {};
  if (query.songId !== undefined) {
    params.song_id = query.songId;
  }
  if (query.songName !== undefined) {
    params.song_name = query.songName;
  }
  if (query.songType !== undefined) {
    params.song_type = query.songType;
  }
  if (query.levelIndex !== undefined) {
    params.level_index = query.levelIndex;
  }
  return params;
}
