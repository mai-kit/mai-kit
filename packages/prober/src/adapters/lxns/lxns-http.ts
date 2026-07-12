import { LxnsProberError } from "./error";
import type { ScoreQuery } from "../../models";

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

export interface LxnsHttpOptions {
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
 */
export class LxnsHttp {
  constructor(private readonly options: LxnsHttpOptions) {}

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.options.pathPrefix}${path}`, this.options.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json", ...this.options.headers },
      });
    } catch (error) {
      throw new LxnsProberError({
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

    if (isLxnsEnvelope(body)) {
      if (body.success) {
        // dev/personal 成功：拆出 data
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return body.data as T;
      }
      throw new LxnsProberError({
        code: body.code,
        status: response.status,
        message: body.message ?? `Lxns API error (code: ${body.code})`,
      });
    }

    if (response.ok) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return body as T;
    }

    throw new LxnsProberError({
      code: response.status,
      status: response.status,
      message: `Lxns API HTTP error (status: ${response.status})`,
    });
  }
}

/** 谱面定位 / 查询 → LXNS 查询参数 */
export function scoreSearchParams(query: ScoreQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.songId !== undefined) {
    params.song_id = query.songId;
  }
  if (query.songType !== undefined) {
    params.song_type = query.songType;
  }
  if (query.levelIndex !== undefined) {
    params.level_index = query.levelIndex;
  }
  return params;
}
