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

全量成绩、最近成绩、走势、热力图、单谱历史、排行与收藏品进度拆成独立能力接口。客户端会按
token 和数据源在返回类型上暴露实际能力，不支持的方法不会挂在对象类型上。完整 records 路径可用：

```ts
const scores = await player.getScores({ songId: 11451, levelIndex: 3 });
```

## LXNS 适配

`createLxnsClient` 按传入 token **条件暴露方法**（类型上未提供的 token 对应方法不存在）：

| 用途             | 选项                  | 调用方式                                    |
| ---------------- | --------------------- | ------------------------------------------- |
| 查自己           | `personalAccessToken` | `client.me()` → `LxnsPersonalPlayer`        |
| 按好友码 / QQ 查 | `devAccessToken`      | `getPlayer(fc)` / `await getPlayerByQQ(qq)` |

```ts
import { createLxnsClient } from "@mai-kit/prober";

// 个人令牌 → 当前用户
const me = createLxnsClient({ personalAccessToken: "<user-token>" }).me();
await me.getProfile();
await me.getBests();
await me.getScores({ songName: "PANDORA PARADOXXX" });
await me.getScoreRanking({ songId: 834, songType: "standard", levelIndex: 4 });
await me.getCollections("plate");

// 开发者令牌 → 按好友码
const client = createLxnsClient({ devAccessToken: "<dev-token>" });
const player = client.getPlayer(1234567890);
await player.getProfile();
await player.getBests();
await player.getRecents();
await player.getSimpleScores();

// QQ 需要先解析为好友码，因此返回 Promise
const byQQ = await client.getPlayerByQQ(123456789);
await byQQ.getBests({ songId: 834 });

// 两种都有
const both = createLxnsClient({
  personalAccessToken: "<user-token>",
  devAccessToken: "<dev-token>",
});
both.me().getBests();
both.getPlayer(friendCode).getBests();
```

个人 API 提供完整成绩、Best50 / 单曲 Best、单谱排行、历史、趋势、热力图、收藏品、成绩导出和
年度总结；它没有 Recent 50。开发者 API 提供 Recent 50、AP50 与精简全成绩，但 `/scores` 缺少
达成率和 DX 分，因此明确命名为 `getSimpleScores()`，不伪装成 `ScoreListCapability`。

鉴权与路径约定以 [LXNS 舞萌 DX API 文档](https://maimai.lxns.net/docs/api/maimai) 为准；
写入、删除、OAuth 配置、别名和评论不属于本只读 prober。

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
await other.getScores();
await other.getScoresBySongIds([834, 10_834]);
await other.getVersionScores(["maimai でらっくす PRiSM"]);

// 公开 Rating 排行（无需 token）
const ranking = await client.getRatingRanking();
```

联调可用 `getTestPlayer()`（官方固定测试数据）。  
水鱼没有 `getRecents` / `getTrend` / `getHeatmap` / `getScoreHistory` 的对等公开接口，因此
返回类型不包含这些方法。公开 B50 查询也不暴露 `getScores`；Import-Token、Developer-Token
和 `getTestPlayer()` 返回 `ScoresProberPlayer`，可以查询并筛选完整 records。

`getRatingRanking()` 是水鱼适配专属的站点排行能力，返回未开启隐私且 Rating 非零的
用户，并由适配按 Rating 降序排列；它不属于绑定某一玩家的 `ProberPlayer`。

Developer-Token 玩家还映射了官方 `/dev/player/record` 与 `/query/plate`：前者按一个或多个
曲目 id 精确取成绩，后者按官方版本名称取牌子范围成绩。按版本成绩缺少 DX 分、定数和评级，
因此使用 `DivingFishVersionScore`，不会用 `0` 补成完整 `Score`。

水鱼接口以[官方路由实现](https://github.com/Diving-Fish/maimaidx-prober/blob/main/database/routes/maimai.py)
为当前事实来源；字段说明可参考[官方仓库保留的 API 文档版本](https://github.com/Diving-Fish/maimaidx-prober/blob/7fa86a21d609c513c5ea54b6de56af3eb5a524a1/database/zh-api-document.md)。

适配器保持只读：水鱼的登录会话 / 协议状态、账号资料修改、成绩导入 / 删除等账号接口，
以及 `music_data`、`chart_stats` 等静态数据库接口不在本包范围内（后者属于
`@mai-kit/database`）。

通用 `PlayerProfile` 只要求昵称与 Rating。好友码、课段位、阶级、轮回星数以及装备
收藏品 id 仅在数据源实际提供时存在；水鱼只返回牌子文案时会保留 `trophy.name`，不会
伪造收藏品 id、好友码或阶级。`getPlayer({ qq })` 中的 QQ 仅用于定位水鱼账号，不会写入
舞萌好友码。上游曲名仅为空白时省略可选的 `song_name`，不会伪造曲名；适配收到未知谱面
类型、难度、评级或缺失 records/charts 时会抛
`DivingFishProberError`，不会映射成 `BASIC`、`standard` 或空成绩。

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
