import { LxnsProberError } from "./error";
import { LXNS_DEFAULT_BASE_URL, LxnsHttp } from "./lxns-http";
import { LxnsDevApi } from "./lxns-dev-api";
import type { LxnsDevClient } from "./lxns-dev-api";
import { LxnsPersonalPlayerImpl } from "./lxns-player";
import type { LxnsPersonalPlayer } from "./lxns-player";

/**
 * LXNS 适配的客户端选项（至少提供一种 token）。
 *
 * | 字段 | 用途 |
 * |------|------|
 * | `personalAccessToken` | 个人令牌 → 暴露 `me(): LxnsPersonalPlayer` |
 * | `devAccessToken` | 开发者令牌 → 暴露按好友码 / QQ 绑定玩家 |
 * | `baseURL` | API 根，默认官方地址 |
 */
export interface LxnsClientOptions {
  /** 个人访问令牌（请求头 `X-User-Token`） */
  personalAccessToken?: string;
  /** 开发者访问令牌（请求头 `Authorization`） */
  devAccessToken?: string;
  /** API 根地址；默认官方 LXNS */
  baseURL?: string;
  /**
   * 单次 HTTP 超时（毫秒）。省略则不限制。
   * @see HttpResilienceOptions
   */
  timeoutMs?: number;
  /**
   * 网络 / 5xx 额外重试次数（默认 `0`）。
   * @see HttpResilienceOptions
   */
  retries?: number;
}

/**
 * LXNS 适配客户端类型：按构造时传入的 token **条件暴露方法**。
 *
 * - 有 `personalAccessToken` → `me(): LxnsPersonalPlayer`（已绑定当前用户）
 * - 有 `devAccessToken` → `getPlayer(friendCode)` / `getPlayerByQQ(qq)`
 * - 未传的能力在类型上不存在，编译期即可发现误用
 */
export type LxnsClient<O extends LxnsClientOptions> = ([O["personalAccessToken"]] extends [
  NonNullable<O["personalAccessToken"]>,
]
  ? {
      /** 获取与个人令牌绑定的当前玩家查询对象。 */
      me(): LxnsPersonalPlayer;
    }
  : object) &
  ([O["devAccessToken"]] extends [NonNullable<O["devAccessToken"]>] ? LxnsDevClient : object);

/**
 * 创建 **LXNS 查分适配**客户端（将 LXNS API 映射为 {@link ProberPlayer} 等通用类型）。
 *
 * @param options - 至少一个 token；可同时提供 personal + dev
 * @returns 条件类型客户端，见 {@link LxnsClient}
 * @throws {LxnsProberError} 两个 token 都未提供时
 *
 * @example 查自己
 * ```ts
 * const me = createLxnsClient({ personalAccessToken: token }).me();
 * const [profile, bests] = await Promise.all([me.getProfile(), me.getBests()]);
 * ```
 *
 * @example 按好友码查别人
 * ```ts
 * const client = createLxnsClient({ devAccessToken: token });
 * const player = client.getPlayer(friendCode);
 * const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
 * ```
 */
export function createLxnsClient<O extends LxnsClientOptions>(options: O): LxnsClient<O> {
  const baseURL = options.baseURL ?? LXNS_DEFAULT_BASE_URL;

  const resilience = { timeoutMs: options.timeoutMs, retries: options.retries };

  const devHttp =
    options.devAccessToken !== undefined
      ? new LxnsHttp({
          baseURL,
          pathPrefix: "maimai/",
          headers: { Authorization: options.devAccessToken },
          ...resilience,
        })
      : undefined;

  const personalHttp =
    options.personalAccessToken !== undefined
      ? new LxnsHttp({
          baseURL,
          pathPrefix: "user/maimai/",
          headers: { "X-User-Token": options.personalAccessToken },
          ...resilience,
        })
      : undefined;

  if (!devHttp && !personalHttp) {
    throw new LxnsProberError({
      message: "At least one of devAccessToken or personalAccessToken is required.",
    });
  }

  const client = (devHttp ? new LxnsDevApi(devHttp) : {}) as {
    me?: () => LxnsPersonalPlayer;
  } & Partial<LxnsDevClient>;

  if (personalHttp) {
    client.me = () => new LxnsPersonalPlayerImpl(personalHttp);
  }

  // 条件类型工厂的固有断言：运行时按 token 构造，类型上无法静态验证
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return client as LxnsClient<O>;
}
