# @mai-kit/database

提供舞萌 DX 游戏数据与素材访问。`MaimaiDatabase` 定义统一接口，内置适配负责连接具体数据源。

覆盖曲目、谱面、社区谱面标签、别名、收藏品、素材（封面 / 头像等），**不包含**玩家成绩（见 `@mai-kit/prober`）。

## 安装

```bash
pnpm add @mai-kit/database
```

## 接口用法

```ts
// db: MaimaiDatabase（任意适配实现）
const { songs, genres, versions } = await db.getSongList({ notes: true });
const song = await db.getSong(114);
const [tags] = await db.getChartTags([
  { song_name: "ウミユリ海底譚", type: "standard", level_index: 3 },
]);
const jacket = await db.getAsset("jacket", 114);
```

## 内置适配

```ts
import { LxnsMaimaiDatabase, DivingFishMaimaiDatabase } from "@mai-kit/database";

const lxns = new LxnsMaimaiDatabase();
const df = new DivingFishMaimaiDatabase(); // 曲目 music_data + 封面 covers
```

Diving-Fish 适配支持 `getSongList` / `getSong` / `getAsset("jacket")` / `getChartTags`；
别名与收藏品列表水鱼无对等接口，调用会抛错。

## 缓存

缓存是 database 包的通用能力，通过适配器创建参数显式开启。省略 `cache` 时不进行任何
缓存：

```ts
import { LxnsMaimaiDatabase, MemoryCacheStore } from "@mai-kit/database";

const db = new LxnsMaimaiDatabase({
  cache: {
    store: new MemoryCacheStore({ maxEntries: 500 }),
    ttlMs: 24 * 60 * 60 * 1000,
  },
});
```

- `MemoryCacheStore`：Node / Web 双端可用的内存 LRU；`maxEntries` 必传。
- `ttlMs`：可选，省略表示条目不过期。
- 远程 JSON 与 jacket / icon 等素材均缓存；包内 DXRating 标签快照不重复缓存。
- 同一个键的并发请求只执行一次；失败不写入缓存。
- JSON 与 `Uint8Array` 每次读取都返回独立值，调用方修改不会污染缓存。

需要文件、IndexedDB 或 Redis 等持久化方案时，实现 `DatabaseCacheStore` 并通过相同的
`cache.store` 注入。缓存是否启用完全由用户创建的 database 决定，draw 无需额外配置。

## 接入其他数据源

`MaimaiDatabase` 不包含数据源特有字段；每个适配器负责实现该接口。

| 适配器               | 数据源                                            | 鉴权 |
| -------------------- | ------------------------------------------------- | ---- |
| `LxnsMaimaiDatabase` | LXNS 公共 API + 素材 CDN + 本地 DXRating 标签快照 | 无需 |

接入新的 API、CDN 或本地数据集时，实现 `MaimaiDatabase`；上层仍按同一接口读取数据。

## 与 @mai-kit/draw 配合

将 `MaimaiDatabase` 实例传给 draw：

```ts
const playerDraw = await new Draw({ database }).withPlayer(profile, bests);
const png = await playerDraw.render("poster");
```

详见 `@mai-kit/draw` 文档。

## 错误处理

- 包级基类：`MaimaiDatabaseError`（继承 `MaiKitError`）
- 适配子类：`LxnsDatabaseError` / `DivingFishDatabaseError`（`isMaimaiDatabaseError` 对子类同样为 true）
- 缓存 / 标签快照等包内通用路径仍抛基类

```ts
import {
  isMaimaiDatabaseError,
  isLxnsDatabaseError,
  isDivingFishDatabaseError,
} from "@mai-kit/database";
import { isMaiKitError } from "@mai-kit/shared";

try {
  await db.getSong(114);
} catch (error) {
  if (isDivingFishDatabaseError(error)) {
    /* 仅水鱼适配 */
  } else if (isLxnsDatabaseError(error)) {
    /* 仅 LXNS 适配 */
  } else if (isMaimaiDatabaseError(error)) {
    console.log(error.code, error.status, error.message);
  }
  if (isMaiKitError(error)) {
    /* 任意 mai-kit 包错误统一兜底 */
  }
}
```

字段：`message`、`code`（业务错误码）、`status`（HTTP 状态码）、`cause`。

## 更新 DXRating 标签快照

```bash
pnpm --filter @mai-kit/database sync:dxrating-tags
```

根目录 `.github/workflows/sync-dxrating-tags.yml` 每周运行该命令；只有快照实际变化时才提交。
同步脚本严格转换 `曲名 + std/dx + difficulty`，不会在运行时做模糊标题匹配。

## 导出

- `MaimaiDatabase`：与数据源无关的统一接口。
- `LxnsMaimaiDatabase`：LXNS 适配。
- `DivingFishMaimaiDatabase`：Diving-Fish（水鱼）适配。
- `MaimaiDatabaseError` / `isMaimaiDatabaseError`：包级错误与类型守卫。
- `LxnsDatabaseError` / `DivingFishDatabaseError` 及对应 `is*`：适配专用子类。
- `DatabaseCacheStore` / `DatabaseCacheOptions`：通用缓存接口与配置。
- `DatabaseCache`：适配器可复用的缓存读写、TTL 与并发合并执行器。
- `MemoryCacheStore`：双端内存 LRU 实现。
- `getChartTagSnapshot` / `getLocalChartTags`：包内 DXRating 标签快照。
- 领域模型：`Song`、`SongDifficulty`、`ChartTag`、`Alias`、`Collection`、`CollectionGenre`、`AssetType` 等。
