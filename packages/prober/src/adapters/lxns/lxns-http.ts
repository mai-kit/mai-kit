import { LxnsProberError } from "./error";
import type { ScoreQuery } from "../../models";
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import * as z from "zod/mini";

/** LXNS API 默认根地址 */
export const LXNS_DEFAULT_BASE_URL = "https://maimai.lxns.net/api/v0/";

const lxnsEnvelopeSchema = z.object({
  success: z.boolean(),
  code: z.number(),
  message: z.optional(z.string()),
  data: z.optional(z.unknown()),
});

/** 查询参数仅允许可安全 stringify 的原始值 */
type QueryParams = Record<string, string | number | boolean | null | undefined>;

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

  async get<T>(path: string, schema: z.ZodMiniType<T>, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.options.pathPrefix}${path}`, this.options.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const key = `GET ${url.href}`;
    return this.coalescer.run(key, async () => this.getOnce(url, schema));
  }

  private async getOnce<T>(url: URL, schema: z.ZodMiniType<T>): Promise<T> {
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

    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
    }

    const envelope = lxnsEnvelopeSchema.safeParse(body);
    if (envelope.success) {
      if (envelope.data.success) {
        if (envelope.data.data === undefined) {
          throw new LxnsProberError({
            code: envelope.data.code,
            status: response.status,
            message: "Lxns API success response is missing data",
          });
        }
        const parsed = schema.safeParse(envelope.data.data);
        if (!parsed.success) {
          throw new LxnsProberError({
            code: envelope.data.code,
            status: response.status,
            message: `Lxns API ${url.pathname}: unexpected response structure (${formatIssues(parsed.error.issues)})`,
            cause: parsed.error,
          });
        }
        return parsed.data;
      }
      throw new LxnsProberError({
        code: envelope.data.code,
        status: response.status,
        message: envelope.data.message ?? `Lxns API error (code: ${envelope.data.code})`,
      });
    }

    throw new LxnsProberError({
      code: response.status,
      status: response.status,
      message: response.ok
        ? `Lxns API returned an invalid response envelope (status: ${response.status}; ${formatIssues(envelope.error.issues)})`
        : `Lxns API HTTP error (status: ${response.status})`,
      cause: response.ok ? envelope.error : undefined,
    });
  }
}

function formatIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 3)
    .map(
      (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "response"}: ${issue.message}`,
    )
    .join("; ");
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
