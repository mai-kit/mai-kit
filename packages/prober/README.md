# @mai-kit/prober

提供舞萌 DX 玩家数据的只读查询。`ProberPlayer`、`PlayerProfile`、`Score` 和 `Bests`
不依赖具体查分服务，LXNS 与 Diving-Fish 的差异由各自适配器处理。

本包不包含成绩写入或 OAuth 流程。

## 安装

```bash
pnpm add @mai-kit/prober
```

## 查询玩家数据

所有适配器返回的 `ProberPlayer` 都能读取档案与 Best50：

```ts
const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
// 交给 @mai-kit/draw 的 Draw.poster(profile, bests)
```

全量成绩、最近成绩、走势、热力图与单谱面历史拆成独立能力接口。客户端会按 token 和
数据源在返回类型上暴露实际能力，不支持的方法不会挂在对象类型上。完整 records 路径可用：

```ts
const scores = await player.getScores({ songId: 11451, levelIndex: 3 });
```

## LXNS 适配

`createLxnsClient` 按传入 token **条件暴露方法**（类型上未提供的 token 对应方法不存在）：

| 用途       | 选项                  | 调用方式                           |
| ---------- | --------------------- | ---------------------------------- |
| 查自己     | `personalAccessToken` | `client.me()` → `FullProberPlayer` |
| 按好友码查 | `devAccessToken`      | 如 `getPlayer` / `getBests(fc)` 等 |

```ts
import { createLxnsClient } from "@mai-kit/prober";

// 个人令牌 → 当前用户
const me = createLxnsClient({ personalAccessToken: "<user-token>" }).me();
await me.getProfile();
await me.getBests();

// 开发者令牌 → 按好友码
const client = createLxnsClient({ devAccessToken: "<dev-token>" });
await client.getPlayer(1234567890);
await client.getBests(1234567890);

// 两种都有
const both = createLxnsClient({
  personalAccessToken: "<user-token>",
  devAccessToken: "<dev-token>",
});
both.me().getBests();
both.getBests(friendCode);
```

鉴权与路径约定以 LXNS 文档为准；本适配将结果映射为包内通用模型。

## Diving-Fish 适配

```ts
import { createDivingFishClient } from "@mai-kit/prober";

// 公开 B50（无需 token；受对方隐私设置影响）
const client = createDivingFishClient();
const player = await client.getPlayer({ username: "someone" });
// 或 { qq: "123456" }

// Import-Token：查自己完整成绩
const me = createDivingFishClient({ importToken: "<import-token>" }).me();
await me.getBests();
await me.getScores();

// Developer-Token：按用户名 / QQ 拉完整成绩
const dev = createDivingFishClient({ developerToken: "<dev-token>" });
const other = await dev.getPlayer({ qq: 123456 });

// 公开 Rating 排行（无需 token）
const ranking = await client.getRatingRanking();
```

联调可用 `getTestPlayer()`（官方固定测试数据）。  
水鱼没有 `getRecents` / `getTrend` / `getHeatmap` / `getScoreHistory` 的对等公开接口，因此
返回类型不包含这些方法。公开 B50 查询也不暴露 `getScores`；Import-Token、Developer-Token
和 `getTestPlayer()` 返回 `ScoresProberPlayer`，可以查询并筛选完整 records。

`getRatingRanking()` 是水鱼适配专属的站点排行能力，返回未开启隐私且 Rating 非零的
用户；它不属于绑定某一玩家的 `ProberPlayer`。

适配器保持只读：水鱼的账号资料修改、成绩导入 / 删除等写入接口不在本包范围内。

水鱼 HTTP 字段到通用 `Score` / `Bests` 的映射函数为**适配内部实现**，不从包根导出；
请使用 `createDivingFishClient` 得到 `ProberPlayer` / `ScoresProberPlayer`。

## HTTP 超时 / 重试（可选）

默认不超时、不重试。需要时在客户端构造参数中显式开启；相同 URL（及 POST body）的并发请求会合并为一次网络调用：

```ts
const client = createLxnsClient({
  personalAccessToken: token,
  timeoutMs: 10_000,
  retries: 2, // 网络失败或 5xx 额外重试 2 次
});

const df = createDivingFishClient({ timeoutMs: 8_000, retries: 1 });
```

## 错误处理

- 包级基类：`ProberError`（继承 `MaiKitError`）
- 包级未实现：`ProberNotImplementedError`（适配无法实现某查询能力时使用；优先仍用类型收窄避免挂上不存在的方法）
- 适配子类：`LxnsProberError` / `DivingFishProberError`（鉴权 / HTTP / 业务失败）

```ts
import {
  isProberError,
  isProberNotImplementedError,
  isLxnsProberError,
  isDivingFishProberError,
} from "@mai-kit/prober";
import { isMaiKitError } from "@mai-kit/shared";

try {
  await player.getProfile();
} catch (e) {
  if (isProberNotImplementedError(e)) {
    /* 当前源无此能力：e.method / e.adapter */
  } else if (isDivingFishProberError(e)) {
    /* 仅水鱼适配 */
  } else if (isLxnsProberError(e)) {
    /* 仅 LXNS 适配 */
  } else if (isProberError(e)) {
    console.log(e.code, e.status, e.message);
  }
  if (isMaiKitError(e)) {
    /* 任意 mai-kit 包错误统一兜底 */
  }
}
```

## 与 @mai-kit/draw 配合

```ts
const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
const png = await new Draw({ database }).poster(profile, bests);
```

`player` 和 `database` 可以分别使用任意 prober、database 适配。
