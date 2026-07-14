import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";
import { DivingFishProberError } from "./error";
import type {
  DivingFishNewSongEntry,
  DivingFishQueryPlayerPayload,
  DivingFishRecord,
  DivingFishRecordsPlayerPayload,
  DivingFishVersionRecord,
} from "./schemas";
import {
  newSongDataSchema,
  queryPlayerPayloadSchema,
  ratingRankingSchema,
  recordsBySongSchema,
  recordsPlayerPayloadSchema,
  versionRecordsPayloadSchema,
} from "./schemas";
import type { DivingFishPlayerQuery, DivingFishRatingRankEntry } from "./types";
import type * as z from "zod/mini";

/** Diving-Fish maimaidxprober API 默认根地址 */
export const DIVING_FISH_DEFAULT_BASE_URL = "https://www.diving-fish.com/api/maimaidxprober/";

/** {@link DivingFishHttp} 构造选项 */
export interface DivingFishHttpOptions extends HttpResilienceOptions {
  /** API 根，默认 {@link DIVING_FISH_DEFAULT_BASE_URL} */
  baseURL?: string;
  /** Import-Token（请求头 `Import-Token`，查自己完整成绩） */
  importToken?: string;
  /** Developer-Token（水鱼申请）。 */
  developerToken?: string;
}

/**
 * Diving-Fish HTTP 客户端（prober 适配器专用）。
 *
 * 错误体多为 `{ message, status? }`，统一归一为 {@link DivingFishProberError}；
 * 成功响应在返回前由对应 Zod schema 解码。
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
   */
  async queryPlayer(query: DivingFishPlayerQuery): Promise<DivingFishQueryPlayerPayload> {
    return this.requestJson("query/player", queryPlayerPayloadSchema, {
      method: "POST",
      body: { ...queryIdentity(query), b50: true },
    });
  }

  /** @returns 官方联调用完整成绩载荷 */
  async testData(): Promise<DivingFishRecordsPlayerPayload> {
    return this.requestJson("player/test_data", recordsPlayerPayloadSchema);
  }

  /** @returns Import-Token 对应玩家的完整成绩载荷 */
  async importRecords(): Promise<DivingFishRecordsPlayerPayload> {
    if (!this.importToken) {
      throw new DivingFishProberError({ message: "importToken is required for /player/records" });
    }
    return this.requestJson("player/records", recordsPlayerPayloadSchema, {
      headers: { "Import-Token": this.importToken },
    });
  }

  /**
   * @param query - 用户名或 QQ
   * @returns Developer-Token 查询到的完整成绩载荷
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
   * @param query - 用户名或 QQ
   * @param songIds - 一个或多个曲目 id
   * @returns 指定曲目的完整成绩
   */
  async devRecordsBySong(
    query: DivingFishPlayerQuery,
    songIds: number | readonly number[],
  ): Promise<DivingFishRecord[]> {
    if (!this.developerToken) {
      throw new DivingFishProberError({
        message: "developerToken is required for /dev/player/record",
      });
    }
    const ids = normalizeSongIds(songIds);
    const payload = await this.requestJson("dev/player/record", recordsBySongSchema, {
      method: "POST",
      headers: { "Developer-Token": this.developerToken },
      body: {
        ...queryIdentity(query),
        music_id: ids.length === 1 ? String(ids[0]) : ids.map(String),
      },
    });
    return Object.values(payload).flat();
  }

  /**
   * @param query - 用户名或 QQ
   * @param versions - 水鱼版本名称
   * @returns 牌子范围内的已游玩成绩
   */
  async versionRecords(
    query: DivingFishPlayerQuery,
    versions: readonly string[],
  ): Promise<DivingFishVersionRecord[]> {
    if (!this.developerToken) {
      throw new DivingFishProberError({
        message: "developerToken is required for /query/plate",
      });
    }
    if (versions.length === 0 || versions.some((version) => version.trim().length === 0)) {
      throw new DivingFishProberError({ message: "at least one non-empty version is required" });
    }
    const payload = await this.requestJson("query/plate", versionRecordsPayloadSchema, {
      method: "POST",
      headers: { "Developer-Token": this.developerToken },
      body: { ...queryIdentity(query), version: [...versions] },
    });
    return payload.verlist;
  }

  /** @returns `song_id → is_new` 所需的上游曲目项 */
  async musicData(): Promise<DivingFishNewSongEntry[]> {
    return this.requestJson("music_data", newSongDataSchema);
  }

  /** @returns 按 Rating 降序排列的公开排行 */
  async ratingRanking(): Promise<DivingFishRatingRankEntry[]> {
    const entries = await this.requestJson("rating_ranking", ratingRankingSchema);
    return [...entries].sort((a, b) => b.ra - a.ra || a.username.localeCompare(b.username));
  }

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
      const body = parseJson(text);
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

function queryIdentity(query: DivingFishPlayerQuery): Record<string, string | number> {
  if ("username" in query && query.username !== undefined) {
    return { username: query.username };
  }
  return { qq: query.qq };
}

function normalizeSongIds(songIds: number | readonly number[]): number[] {
  const ids = typeof songIds === "number" ? [songIds] : [...songIds];
  if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id < 0)) {
    throw new DivingFishProberError({ message: "songIds must contain safe non-negative integers" });
  }
  return ids;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
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
