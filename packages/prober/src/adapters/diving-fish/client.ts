import type { ProberPlayer, ScoresProberPlayer } from "../../prober-player";
import { DivingFishHttp } from "./http";
import { DivingFishDeveloperPlayerImpl, DivingFishPlayer, DivingFishScoresPlayer } from "./player";
import type { DivingFishDeveloperPlayer } from "./player";
import type { DivingFishPlayerQuery, DivingFishRatingRankEntry } from "./types";

/**
 * Diving-Fish 适配客户端选项。
 *
 * | 字段 | 用途 |
 * |------|------|
 * | （无 token） | `getPlayer` 公开 B50 查询 |
 * | `importToken` | 暴露 `me()` → 当前账号完整成绩 |
 * | `developerToken` | `getPlayer` 走 `/dev/player/records` |
 * | `baseURL` | API 根，默认官方 maimaidxprober |
 */
export interface DivingFishClientOptions {
  /**
   * 用户 Import-Token（查分器「编辑个人资料」中生成）。
   * 传入后客户端类型上存在 `me(): ScoresProberPlayer`。
   */
  importToken?: string;
  /**
   * 开发者 Token（水鱼申请）。
   * 传入后 `getPlayer` 使用完整成绩接口（支持 `getScores`）。
   */
  developerToken?: string;
  /** API 根地址；默认官方 `maimaidxprober` */
  baseURL?: string;
  /** 单次 HTTP 超时（毫秒）；省略不限制 */
  timeoutMs?: number;
  /** 网络 / 5xx 额外重试次数（默认 `0`） */
  retries?: number;
}

/**
 * Diving-Fish 适配客户端类型。
 *
 * - 始终具备 `getPlayer` / `getTestPlayer`
 * - 始终具备 `getRatingRanking`（水鱼公开排行）
 * - 构造时传入 `importToken` 时额外有 `me()`
 *
 * @typeParam O - 构造选项，用于条件暴露 `me`
 */
export type DivingFishClient<O extends DivingFishClientOptions = DivingFishClientOptions> = {
  /**
   * 按用户名或 QQ 查询玩家。
   *
   * @param query - `{ username }` 或 `{ qq }`
   * @returns 已绑定身份的 {@link ProberPlayer}
   * @throws {DivingFishProberError} 用户不存在、隐私限制、网络错误等
   */
  getPlayer(
    query: DivingFishPlayerQuery,
  ): Promise<
    [O["developerToken"]] extends [NonNullable<O["developerToken"]>]
      ? DivingFishDeveloperPlayer
      : ProberPlayer
  >;
  /**
   * 官方固定测试数据（完整 records，无需鉴权）。
   *
   * @returns 测试用 {@link ScoresProberPlayer}
   * @throws {DivingFishProberError} 网络错误
   */
  getTestPlayer(): Promise<ScoresProberPlayer>;
  /**
   * 获取水鱼公开 Rating 排行。
   *
   * 这是水鱼适配专属能力，不属于玩家对象。
   *
   * @returns 未开启隐私且 Rating 非零的玩家排行
   */
  getRatingRanking(): Promise<DivingFishRatingRankEntry[]>;
} & ([O["importToken"]] extends [NonNullable<O["importToken"]>]
  ? {
      /**
       * 当前 Import-Token 对应用户。
       *
       * @returns 已绑定的 {@link ProberPlayer}
       */
      me(): ScoresProberPlayer;
    }
  : object);

/**
 * 创建 **Diving-Fish（水鱼）查分适配**客户端。
 *
 * 将水鱼 API 映射为通用 {@link ProberPlayer} / `PlayerProfile` / `Bests`。
 *
 * @typeParam O - 选项类型（决定是否暴露 `me`）
 * @param options - 可选 Import-Token / Developer-Token / baseURL
 * @returns 条件类型客户端，见 {@link DivingFishClient}
 *
 * @example 公开查 B50
 * ```ts
 * const client = createDivingFishClient();
 * const player = await client.getPlayer({ username: "someone" });
 * const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
 * ```
 *
 * @example Import-Token 查自己
 * ```ts
 * const me = createDivingFishClient({ importToken }).me();
 * const bests = await me.getBests();
 * ```
 *
 * @example Developer-Token 按 QQ 查完整成绩
 * ```ts
 * const client = createDivingFishClient({ developerToken });
 * const player = await client.getPlayer({ qq: 123456789 });
 * const scores = await player.getScores();
 * ```
 */
export function createDivingFishClient<O extends DivingFishClientOptions>(
  options?: O,
): DivingFishClient<O> {
  const opts: DivingFishClientOptions = options ?? {};
  const http = new DivingFishHttp(opts);

  const client: {
    getPlayer(query: DivingFishPlayerQuery): Promise<ProberPlayer>;
    getTestPlayer(): Promise<ScoresProberPlayer>;
    getRatingRanking(): Promise<DivingFishRatingRankEntry[]>;
    me?: () => ScoresProberPlayer;
  } = {
    async getPlayer(query) {
      if (opts.developerToken) {
        return new DivingFishDeveloperPlayerImpl(http, query);
      }
      const payload = await http.queryPlayer(query);
      return DivingFishPlayer.fromQueryPayload(payload);
    },
    async getTestPlayer() {
      const payload = await http.testData();
      return DivingFishScoresPlayer.fromRecordsPayload(http, payload);
    },
    async getRatingRanking() {
      return http.ratingRanking();
    },
  };

  if (opts.importToken) {
    client.me = () => DivingFishScoresPlayer.fromImportToken(http);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return client as DivingFishClient<O>;
}
