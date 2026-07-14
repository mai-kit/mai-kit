import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import type { ScoreQuery } from "../../models";
import { assertScoreQuery } from "../../score-query";
import { LxnsProberError } from "./error";
import * as z from "zod/mini";

/** LXNS API 默认根地址 */
export const LXNS_DEFAULT_BASE_URL = "https://maimai.lxns.net/api/v0/";

const lxnsEnvelopeSchema = z.object({
  success: z.boolean(),
  code: z.number(),
  message: z.optional(z.string()),
  data: z.optional(z.unknown()),
});

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface LxnsHttpOptions extends HttpResilienceOptions {
  baseURL: string;
  /** 路径前缀，dev 为 `maimai/`，personal 为 `user/maimai/`。 */
  pathPrefix: string;
  /** 鉴权头 */
  headers: Record<string, string>;
}

/** LXNS dev/personal 接口 HTTP 客户端。 */
export class LxnsHttp {
  private readonly coalescer = new RequestCoalescer();

  constructor(private readonly options: LxnsHttpOptions) {}

  async get<T>(path: string, schema: z.ZodMiniType<T>, params?: QueryParams): Promise<T> {
    const url = this.buildUrl(path, params);
    const key = `GET ${url.href}`;
    return this.coalescer.run(key, async () => this.getOnce(url, schema));
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

  private async request(url: URL, accept = "application/json"): Promise<Response> {
    try {
      return await fetchWithResilience(
        url,
        { headers: { ...this.options.headers, Accept: accept } },
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
  }

  private async getOnce<T>(url: URL, schema: z.ZodMiniType<T>): Promise<T> {
    const response = await this.request(url);
    const envelope = lxnsEnvelopeSchema.safeParse(parseJson(await response.text()));
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

  private async getBytesOnce(url: URL): Promise<Uint8Array> {
    const response = await this.request(url, "*/*");
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || isJsonContentType(contentType)) {
      const envelope = lxnsEnvelopeSchema.safeParse(parseJson(await response.text()));
      if (envelope.success && !envelope.data.success) {
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
          ? "Lxns API binary endpoint returned JSON instead of bytes"
          : `Lxns API HTTP error (status: ${response.status})`,
      });
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isJsonContentType(contentType: string): boolean {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
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
  assertScoreQuery(query);
  const params: Record<string, string | number> = {};
  if (query.songId !== undefined) params.song_id = query.songId;
  if (query.songName !== undefined) params.song_name = query.songName;
  if (query.songType !== undefined) params.song_type = query.songType;
  if (query.levelIndex !== undefined) params.level_index = query.levelIndex;
  return params;
}
