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

`Song` / `SongDifficulty` 中的数据源可选字段（如数字版本 id、谱师、BPM）只在上游实际
提供时存在；`SongList.genres` / `versions` 同理。调用方需要版本判定时应先确认所选
database 提供数字版本，而不是把缺失字段当作 `0`。

## 内置适配

```ts
import { LxnsMaimaiDatabase, DivingFishMaimaiDatabase } from "@mai-kit/database";

const lxns = new LxnsMaimaiDatabase();
const df = new DivingFishMaimaiDatabase(); // 曲目、谱面统计与封面
```

Diving-Fish 适配支持通用的 `getSongList` / `getSong` / `getAsset("jacket")` /
`getChartTags`，并额外提供水鱼社区统计：

```ts
const stats = await df.getChartStats();
const master = stats.charts["11451"]?.[3];
console.log(master?.fit_diff, master?.avg);
```

`getChartStats()` 是适配专属能力：它保留水鱼的拟合难度、平均达成率与成绩分布语义，
不加入通用 `MaimaiDatabase`。别名、收藏品及 jacket 以外的素材没有对等公开接口，调用
对应通用方法会抛包级 `MaimaiDatabaseNotImplementedError`（可用
`isMaimaiDatabaseNotImplementedError` 做降级，与 HTTP 失败区分）。

水鱼曲目映射不会为缺少的数字版本、谱师、艺术家或 BPM 填 `0` / 空字符串；未知谱面
类型、非法 id、难度数组错位或非法物量会抛 `DivingFishDatabaseError`。

## HTTP 超时 / 重试（可选）

默认不超时、不重试。可在适配构造时开启；相同 URL 的并发 JSON / 封面请求会合并：

```ts
const lxns = new LxnsMaimaiDatabase({ timeoutMs: 10_000, retries: 1 });
const df = new DivingFishMaimaiDatabase({ timeoutMs: 8_000, retries: 2 });
```

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

内置存储：

| 实现                   | 环境        | 说明                                               |
| ---------------------- | ----------- | -------------------------------------------------- |
| `MemoryCacheStore`     | Node + Web  | 内存 LRU；`maxEntries` **必传**                    |
| `FileSystemCacheStore` | **仅 Node** | 落盘到指定目录；可选 `maxEntries`（按 mtime 淘汰） |

```ts
// Node：进程间可复用的磁盘缓存
import { FileSystemCacheStore, LxnsMaimaiDatabase } from "@mai-kit/database";

const db = new LxnsMaimaiDatabase({
  cache: {
    store: new FileSystemCacheStore({
      directory: "/var/cache/mai-kit", // 推荐绝对路径
      maxEntries: 2_000,
    }),
    ttlMs: 24 * 60 * 60 * 1000,
  },
});
```

- `ttlMs`：可选，省略表示条目不过期（由 `DatabaseCache` 写入 `expiresAt`）。
- 远程 JSON 与 jacket / icon 等素材均缓存；包内 DXRating 标签快照不重复缓存。
- 同一个键的并发请求只执行一次；失败不写入缓存。
- JSON 与 `Uint8Array` 每次读取都返回独立值，调用方修改不会污染缓存。
- 缓存 I/O 失败会抛 `MaimaiDatabaseError`，**不会**静默跳过缓存。

需要 IndexedDB / Redis 等时，实现 `DatabaseCacheStore` 并通过相同的 `cache.store` 注入。
缓存是否启用完全由用户创建的 database 决定，draw 无需额外配置。

## 接入其他数据源

`MaimaiDatabase` 不包含数据源特有字段；每个适配器负责实现该接口。

| 适配器                     | 数据源                                            | 鉴权 |
| -------------------------- | ------------------------------------------------- | ---- |
| `LxnsMaimaiDatabase`       | LXNS 公共 API + 素材 CDN + 本地 DXRating 标签快照 | 无需 |
| `DivingFishMaimaiDatabase` | 水鱼曲目 / 谱面统计 API + 封面 + 本地标签快照     | 无需 |

接入新的 API、CDN 或本地数据集时，实现 `MaimaiDatabase`；上层仍按同一接口读取数据。

## 与 @mai-kit/draw 配合

将 `MaimaiDatabase` 实例传给 draw：

```ts
const png = await new Draw({ database }).poster(profile, bests);
```

详见 `@mai-kit/draw` 文档。

## 错误处理

- 包级基类：`MaimaiDatabaseError`（继承 `MaiKitError`）
- 包级未实现：`MaimaiDatabaseNotImplementedError`（适配无法实现某 `MaimaiDatabase` 方法时使用）
- 适配子类：`LxnsDatabaseError` / `DivingFishDatabaseError`（HTTP / 业务失败）
- 缓存 / 标签快照等包内通用路径仍抛基类

```ts
import {
  isMaimaiDatabaseError,
  isMaimaiDatabaseNotImplementedError,
  isLxnsDatabaseError,
  isDivingFishDatabaseError,
} from "@mai-kit/database";
import { isMaiKitError } from "@mai-kit/shared";

try {
  await db.getAliasList();
} catch (error) {
  if (isMaimaiDatabaseNotImplementedError(error)) {
    /* 当前源无此能力：error.method / error.adapter */
  } else if (isDivingFishDatabaseError(error)) {
    /* 仅水鱼 HTTP / 业务失败 */
  } else if (isLxnsDatabaseError(error)) {
    /* 仅 LXNS */
  } else if (isMaimaiDatabaseError(error)) {
    console.log(error.code, error.status, error.message);
  }
  if (isMaiKitError(error)) {
    /* 任意 mai-kit 包错误统一兜底 */
  }
}
```

字段：`message`、`code`（业务错误码）、`status`（HTTP 状态码）、`cause`；
未实现错误另有 `method`、可选 `adapter`。

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
- `DivingFishChartStats` / `DivingFishChartStat`：水鱼社区谱面统计模型。
- `MaimaiDatabaseError` / `isMaimaiDatabaseError`：包级错误与类型守卫。
- `LxnsDatabaseError` / `DivingFishDatabaseError` 及对应 `is*`：适配专用子类。
- `DatabaseCacheStore` / `DatabaseCacheOptions`：通用缓存接口与配置。
- `DatabaseCache`：适配器可复用的缓存读写、TTL 与并发合并执行器。
- `MemoryCacheStore`：双端内存 LRU 实现。
- `FileSystemCacheStore`：Node 磁盘实现（目录 + 可选容量上限）。
- 谱面标签：经 `MaimaiDatabase.getChartTags`（本地 DXRating 快照在适配内使用，不单独导出）。
- 领域模型：`Song`、`SongDifficulty`、`ChartTag`、`Alias`、`Collection`、`CollectionGenre`、`AssetType` 等。
