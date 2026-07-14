import { DivingFishProberError } from "./error";
import type {
  DivingFishNewSongEntry,
  DivingFishQueryPlayerPayload,
  DivingFishRecordsPlayerPayload,
} from "./schemas";
import {
  newSongDataSchema,
  queryPlayerPayloadSchema,
  ratingRankingSchema,
  recordsPlayerPayloadSchema,
} from "./schemas";
import type { DivingFishPlayerQuery, DivingFishRatingRankEntry } from "./types";
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import type * as z from "zod/mini";

/** Diving-Fish maimaidxprober API 默认根地址 */
export const DIVING_FISH_DEFAULT_BASE_URL = "https://www.diving-fish.com/api/maimaidxprober/";

/** {@link DivingFishHttp} 构造选项 */
export interface DivingFishHttpOptions extends HttpResilienceOptions {
  /** API 根，默认 {@link DIVING_FISH_DEFAULT_BASE_URL} */
  baseURL?: string;
  /** Import-Token（请求头 `Import-Token`，查自己完整成绩） */
  importToken?: string;
  /** Developer-Token（请求头 `Developer-Token`，按用户名 / QQ 查完整成绩） */
  developerToken?: string;
}

/**
 * Diving-Fish HTTP 客户端（prober 适配专用）。
 *
 * 错误体多为 `{ message, status? }`，统一归一为 {@link DivingFishProberError}。
 */
export class DivingFishHttp {
  /** 实际使用的 API 根 */
  readonly baseURL: string;
  private readonly importToken?: string;
  private readonly developerToken?: string;
  private readonly resilience: HttpResilienceOptions;
  private readonly coalescer = new RequestCoalescer();

  /**
   * @param options - 可选 baseURL、鉴权 token、timeout / retries
   */
  constructor(options: DivingFishHttpOptions = {}) {
    this.baseURL = options.baseURL ?? DIVING_FISH_DEFAULT_BASE_URL;
    this.importToken = options.importToken;
    this.developerToken = options.developerToken;
    this.resilience = { timeoutMs: options.timeoutMs, retries: options.retries };
  }

  /**
   * 公开简略 B50：`POST /query/player`（body 含 `b50`）。
   *
   * @param query - 用户名或 QQ
   * @returns 含 `charts.dx` / `charts.sd` 的玩家载荷
   * @throws {DivingFishProberError} 网络失败、用户不存在、隐私限制等
   */
  async queryPlayer(query: DivingFishPlayerQuery): Promise<DivingFishQueryPlayerPayload> {
    return this.requestJson("query/player", queryPlayerPayloadSchema, {
      method: "POST",
      body: {
        ...queryIdentity(query),
        b50: true,
      },
    });
  }

  /**
   * 官方联调数据：`GET /player/test_data`（无需鉴权）。
   *
   * @returns 完整成绩载荷
   * @throws {DivingFishProberError} 网络或 HTTP 错误
   */
  async testData(): Promise<DivingFishRecordsPlayerPayload> {
    return this.requestJson("player/test_data", recordsPlayerPayloadSchema);
  }

  /**
   * Import-Token 完整成绩：`GET /player/records`。
   *
   * @returns 含 `records` 的玩家载荷
   * @throws {DivingFishProberError} 未配置 `importToken`、token 无效、网络错误
   */
  async importRecords(): Promise<DivingFishRecordsPlayerPayload> {
    if (!this.importToken) {
      throw new DivingFishProberError({ message: "importToken is required for /player/records" });
    }
    return this.requestJson("player/records", recordsPlayerPayloadSchema, {
      headers: { "Import-Token": this.importToken },
    });
  }

  /**
   * Developer-Token 完整成绩：`GET /dev/player/records`。
   *
   * @param query - 用户名或 QQ
   * @returns 含 `records` 的玩家载荷
   * @throws {DivingFishProberError} 未配置 `developerToken`、用户不存在、网络错误
   */
  async devRecords(query: DivingFishPlayerQuery): Promise<DivingFishRecordsPlayerPayload> {
    if (!this.developerToken) {
      throw new DivingFishProberError({
        message: "developerToken is required for /dev/player/records",
      });
    }
    return this.requestJson("dev/player/records", recordsPlayerPayloadSchema, {
      headers: { "Developer-Token": this.developerToken },
      query: queryIdentity(query),
    });
  }

  /**
   * 曲目表：`GET /music_data`（用于 `is_new` 拆 B50）。
   *
   * @returns 上游 JSON（通常为曲目数组）
   * @throws {DivingFishProberError} 网络或 HTTP 错误
   */
  async musicData(): Promise<DivingFishNewSongEntry[]> {
    return this.requestJson("music_data", newSongDataSchema);
  }

  /**
   * 公开 Rating 排行：`GET /rating_ranking`。
   *
   * @returns 未开启隐私且 Rating 非零的玩家排行
   * @throws {DivingFishProberError} 网络、HTTP 或响应结构错误
   */
  async ratingRanking(): Promise<DivingFishRatingRankEntry[]> {
    return this.requestJson("rating_ranking", ratingRankingSchema);
  }

  /**
   * @param path - 相对 {@link baseURL} 的路径
   * @param init - method / headers / body / query
   * @returns 解析后的 JSON
   * @throws {DivingFishProberError} 网络失败或非 2xx
   */
  private async requestJson<T>(
    path: string,
    schema: z.ZodMiniType<T>,
    init: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: unknown;
      query?: Record<string, string | number>;
    } = {},
  ): Promise<T> {
    const url = new URL(path.replace(/^\//u, ""), this.baseURL);
    if (init.query) {
      for (const [key, value] of Object.entries(init.query)) {
        url.searchParams.set(key, String(value));
      }
    }

    const method = init.method ?? "GET";
    const bodyText = init.body !== undefined ? JSON.stringify(init.body) : undefined;
    const coalesceKey = `${method} ${url.href} ${bodyText ?? ""}`;

    return this.coalescer.run(coalesceKey, async () => {
      let response: Response;
      try {
        response = await fetchWithResilience(
          url,
          {
            method,
            headers: {
              Accept: "application/json",
              ...(bodyText !== undefined ? { "Content-Type": "application/json" } : {}),
              ...init.headers,
            },
            body: bodyText,
          },
          this.resilience,
        );
      } catch (error) {
        throw new DivingFishProberError({
          message: `Diving-Fish network request failed: ${
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
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `Diving-Fish HTTP ${response.status}`;
        throw new DivingFishProberError({
          code: response.status,
          status: response.status,
          message,
        });
      }

      if (body === undefined) {
        throw new DivingFishProberError({
          status: response.status,
          message: `Diving-Fish ${path}: invalid JSON response`,
        });
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new DivingFishProberError({
          status: response.status,
          message: `Diving-Fish ${path}: unexpected response structure (${formatIssues(parsed.error.issues)})`,
          cause: parsed.error,
        });
      }
      return parsed.data;
    });
  }
}

/**
 * @param query - 用户名或 QQ
 * @returns 发往上游的 identity 字段
 */
function queryIdentity(query: DivingFishPlayerQuery): Record<string, string | number> {
  if ("username" in query && query.username !== undefined) {
    return { username: query.username };
  }
  return { qq: query.qq };
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
