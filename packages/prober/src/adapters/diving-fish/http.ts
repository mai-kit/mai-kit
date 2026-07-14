import { DivingFishProberError } from "./error";
import type {
  DivingFishPlayerPayload,
  DivingFishPlayerQuery,
  DivingFishRatingRankEntry,
  DivingFishRecord,
  DivingFishVersionRecord,
} from "./types";
import { fetchWithResilience, RequestCoalescer, type HttpResilienceOptions } from "@mai-kit/shared";

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
  async queryPlayer(query: DivingFishPlayerQuery): Promise<DivingFishPlayerPayload> {
    const body = await this.requestJson<unknown>("query/player", {
      method: "POST",
      body: {
        ...queryIdentity(query),
        b50: true,
      },
    });
    return parsePlayerPayload(body, "query/player", "charts");
  }

  /**
   * 官方联调数据：`GET /player/test_data`（无需鉴权）。
   *
   * @returns 完整成绩载荷
   * @throws {DivingFishProberError} 网络或 HTTP 错误
   */
  async testData(): Promise<DivingFishPlayerPayload> {
    const body = await this.requestJson<unknown>("player/test_data");
    return parsePlayerPayload(body, "player/test_data", "records");
  }

  /**
   * Import-Token 完整成绩：`GET /player/records`。
   *
   * @returns 含 `records` 的玩家载荷
   * @throws {DivingFishProberError} 未配置 `importToken`、token 无效、网络错误
   */
  async importRecords(): Promise<DivingFishPlayerPayload> {
    if (!this.importToken) {
      throw new DivingFishProberError({ message: "importToken is required for /player/records" });
    }
    const body = await this.requestJson<unknown>("player/records", {
      headers: { "Import-Token": this.importToken },
    });
    return parsePlayerPayload(body, "player/records", "records");
  }

  /**
   * Developer-Token 完整成绩：`GET /dev/player/records`。
   *
   * @param query - 用户名或 QQ
   * @returns 含 `records` 的玩家载荷
   * @throws {DivingFishProberError} 未配置 `developerToken`、用户不存在、网络错误
   */
  async devRecords(query: DivingFishPlayerQuery): Promise<DivingFishPlayerPayload> {
    if (!this.developerToken) {
      throw new DivingFishProberError({
        message: "developerToken is required for /dev/player/records",
      });
    }
    const body = await this.requestJson<unknown>("dev/player/records", {
      headers: { "Developer-Token": this.developerToken },
      query: queryIdentity(query),
    });
    return parsePlayerPayload(body, "dev/player/records", "records");
  }

  /**
   * Developer-Token 单曲 / 多曲成绩：`POST /dev/player/record`。
   *
   * @param query - 用户名或 QQ
   * @param songIds - 一个或多个曲目 id
   * @returns 指定曲目的所有已上传谱面成绩
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
    const body = await this.requestJson<unknown>("dev/player/record", {
      method: "POST",
      headers: { "Developer-Token": this.developerToken },
      body: {
        ...queryIdentity(query),
        music_id: ids.length === 1 ? String(ids[0]) : ids.map(String),
      },
    });
    if (!isRecord(body)) throw unexpectedPlayerPayload("dev/player/record");
    const records: DivingFishRecord[] = [];
    for (const value of Object.values(body)) {
      if (!Array.isArray(value) || !value.every(isDivingFishRecord)) {
        throw unexpectedPlayerPayload("dev/player/record");
      }
      records.push(...value);
    }
    return records;
  }

  /**
   * Developer-Token 按游戏版本查询成绩：`POST /query/plate`。
   *
   * 当前官方路由要求 Developer-Token；旧版文档曾标为无需鉴权。
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
    const body = await this.requestJson<unknown>("query/plate", {
      method: "POST",
      headers: { "Developer-Token": this.developerToken },
      body: { ...queryIdentity(query), version: [...versions] },
    });
    if (!isRecord(body) || !Array.isArray(body.verlist) || !body.verlist.every(isVersionRecord)) {
      throw unexpectedPlayerPayload("query/plate");
    }
    return body.verlist;
  }

  /**
   * 曲目表：`GET /music_data`（用于 `is_new` 拆 B50）。
   *
   * @returns 上游 JSON（通常为曲目数组）
   * @throws {DivingFishProberError} 网络或 HTTP 错误
   */
  async musicData(): Promise<unknown> {
    return this.requestJson<unknown>("music_data");
  }

  /**
   * 公开 Rating 排行：`GET /rating_ranking`。
   *
   * @returns 未开启隐私且 Rating 非零的玩家排行
   * @throws {DivingFishProberError} 网络、HTTP 或响应结构错误
   */
  async ratingRanking(): Promise<DivingFishRatingRankEntry[]> {
    const body = await this.requestJson<unknown>("rating_ranking");
    if (!Array.isArray(body) || !body.every(isRatingRankEntry)) {
      throw new DivingFishProberError({
        message: "Diving-Fish rating_ranking: unexpected response structure",
      });
    }
    return [...body].sort((a, b) => b.ra - a.ra || a.username.localeCompare(b.username));
  }

  /**
   * @param path - 相对 {@link baseURL} 的路径
   * @param init - method / headers / body / query
   * @returns 解析后的 JSON
   * @throws {DivingFishProberError} 网络失败或非 2xx
   */
  private async requestJson<T>(
    path: string,
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

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return body as T;
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

function normalizeSongIds(songIds: number | readonly number[]): number[] {
  const ids = typeof songIds === "number" ? [songIds] : [...songIds];
  if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id < 0)) {
    throw new DivingFishProberError({ message: "songIds must contain safe non-negative integers" });
  }
  return ids;
}

function isRatingRankEntry(value: unknown): value is DivingFishRatingRankEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    typeof value.username === "string" &&
    "ra" in value &&
    typeof value.ra === "number" &&
    Number.isFinite(value.ra)
  );
}

function parsePlayerPayload(
  value: unknown,
  endpoint: string,
  mode: "charts" | "records",
): DivingFishPlayerPayload {
  if (!isRecord(value) || typeof value.rating !== "number" || !Number.isFinite(value.rating)) {
    throw unexpectedPlayerPayload(endpoint);
  }
  if (value.nickname !== undefined && typeof value.nickname !== "string") {
    throw unexpectedPlayerPayload(endpoint);
  }
  if (value.username !== undefined && typeof value.username !== "string") {
    throw unexpectedPlayerPayload(endpoint);
  }
  if (
    value.additional_rating !== undefined &&
    (typeof value.additional_rating !== "number" || !Number.isFinite(value.additional_rating))
  ) {
    throw unexpectedPlayerPayload(endpoint);
  }
  if (value.plate !== undefined && typeof value.plate !== "string") {
    throw unexpectedPlayerPayload(endpoint);
  }

  if (mode === "records") {
    if (!Array.isArray(value.records) || !value.records.every(isDivingFishRecord)) {
      throw unexpectedPlayerPayload(endpoint);
    }
  } else {
    if (
      !isRecord(value.charts) ||
      !Array.isArray(value.charts.dx) ||
      !Array.isArray(value.charts.sd) ||
      !value.charts.dx.every(isDivingFishRecord) ||
      !value.charts.sd.every(isDivingFishRecord)
    ) {
      throw unexpectedPlayerPayload(endpoint);
    }
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as unknown as DivingFishPlayerPayload;
}

function isDivingFishRecord(value: unknown): value is DivingFishRecord {
  return (
    isRecord(value) &&
    typeof value.achievements === "number" &&
    Number.isFinite(value.achievements) &&
    typeof value.ds === "number" &&
    Number.isFinite(value.ds) &&
    typeof value.dxScore === "number" &&
    Number.isFinite(value.dxScore) &&
    typeof value.fc === "string" &&
    typeof value.fs === "string" &&
    typeof value.level === "string" &&
    typeof value.level_index === "number" &&
    Number.isInteger(value.level_index) &&
    typeof value.ra === "number" &&
    Number.isFinite(value.ra) &&
    typeof value.rate === "string" &&
    typeof value.song_id === "number" &&
    Number.isFinite(value.song_id) &&
    typeof value.title === "string" &&
    typeof value.type === "string"
  );
}

function isVersionRecord(value: unknown): value is DivingFishVersionRecord {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    typeof value.title === "string" &&
    typeof value.level === "string" &&
    typeof value.level_index === "number" &&
    Number.isInteger(value.level_index) &&
    typeof value.type === "string" &&
    typeof value.achievements === "number" &&
    Number.isFinite(value.achievements) &&
    typeof value.fc === "string" &&
    typeof value.fs === "string"
  );
}

function unexpectedPlayerPayload(endpoint: string): DivingFishProberError {
  return new DivingFishProberError({
    message: `Diving-Fish ${endpoint}: unexpected response structure`,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
