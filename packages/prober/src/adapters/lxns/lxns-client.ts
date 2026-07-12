import type { FullProberPlayer } from "../../prober-player";
import { LxnsProberError } from "./error";
import { LXNS_DEFAULT_BASE_URL, LxnsHttp } from "./lxns-http";
import { LxnsDevApi } from "./lxns-dev-api";
import type { LxnsDevQueries } from "./lxns-dev-api";
import { LxnsPersonalPlayer } from "./lxns-player";

/**
 * LXNS 适配的客户端选项（至少提供一种 token）。
 *
 * | 字段 | 用途 |
 * |------|------|
 * | `personalAccessToken` | 个人令牌 → 暴露 `me(): FullProberPlayer` |
 * | `devAccessToken` | 开发者令牌 → 暴露按好友码查询 |
 * | `baseURL` | API 根，默认官方地址 |
 */
export interface LxnsClientOptions {
  /** 个人访问令牌（请求头 `X-User-Token`） */
  personalAccessToken?: string;
  /** 开发者访问令牌（请求头 `Authorization`） */
  devAccessToken?: string;
  /** API 根地址；默认官方 LXNS */
  baseURL?: string;
}

/**
 * LXNS 适配客户端类型：按构造时传入的 token **条件暴露方法**。
 *
 * - 有 `personalAccessToken` → `me(): FullProberPlayer`（已绑定当前用户）
 * - 有 `devAccessToken` → 按好友码的查询方法
 * - 未传的能力在类型上不存在，编译期即可发现误用
 */
export type LxnsClient<O extends LxnsClientOptions> = ([O["personalAccessToken"]] extends [
  NonNullable<O["personalAccessToken"]>,
]
  ? {
      /** 获取与个人令牌绑定的当前玩家查询对象。 */
      me(): FullProberPlayer;
    }
  : object) &
  ([O["devAccessToken"]] extends [NonNullable<O["devAccessToken"]>] ? LxnsDevQueries : object);

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
 * const profile = await client.getPlayer(friendCode);
 * const bests = await client.getBests(friendCode);
 * ```
 */
export function createLxnsClient<O extends LxnsClientOptions>(options: O): LxnsClient<O> {
  const baseURL = options.baseURL ?? LXNS_DEFAULT_BASE_URL;

  const devHttp =
    options.devAccessToken !== undefined
      ? new LxnsHttp({
          baseURL,
          pathPrefix: "maimai/",
          headers: { Authorization: options.devAccessToken },
        })
      : undefined;

  const personalHttp =
    options.personalAccessToken !== undefined
      ? new LxnsHttp({
          baseURL,
          pathPrefix: "user/maimai/",
          headers: { "X-User-Token": options.personalAccessToken },
        })
      : undefined;

  if (!devHttp && !personalHttp) {
    throw new LxnsProberError({
      message: "At least one of devAccessToken or personalAccessToken is required.",
    });
  }

  const client = (devHttp ? new LxnsDevApi(devHttp) : {}) as {
    me?: () => FullProberPlayer;
  } & Partial<LxnsDevQueries>;

  if (personalHttp) {
    client.me = () => new LxnsPersonalPlayer(personalHttp);
  }

  // 条件类型工厂的固有断言：运行时按 token 构造，类型上无法静态验证
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return client as LxnsClient<O>;
}
