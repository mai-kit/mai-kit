# 包与职责

mai-kit 按数据来源和处理阶段拆包。只安装实际需要的部分；生成海报时，再把玩家数据、
游戏数据和渲染包组合起来。

## 选择需要的包

| 需求                            | 包                                        |
| ------------------------------- | ----------------------------------------- |
| 查询玩家档案、Best50 和历史成绩 | `@mai-kit/prober`                         |
| 读取曲目、封面、头像和谱面标签  | `@mai-kit/database`                       |
| 生成成绩海报或 Best 图          | `@mai-kit/draw`                           |
| 重算 B50、分析升分和比较快照    | `@mai-kit/analysis`                       |
| 计算 Rating、达成率和 DX 分     | `@mai-kit/utils`                          |
| 直接读取徽章、字体或 resvg wasm | `@mai-kit/assets`                         |
| 引用错误基类和 maimai 公共类型  | `@mai-kit/shared`（通常由其他包间接安装） |

## 包职责

### `@mai-kit/prober`

查询玩家档案、Best50、成绩记录等只读数据。公开的玩家模型不依赖具体查分服务，服务差异由适配器处理。

目前内置两个适配：

- [落雪查分器（LXNS）](https://maimai.lxns.net/)：个人令牌 / 开发者令牌
- [Diving-Fish（水鱼）](https://www.diving-fish.com/maimaidx/prober/)：公开 B50 / Rating 排行、Import-Token、Developer-Token

两种适配返回相同形态的 `profile` 和 `bests`，可以直接传给 `Draw.poster()`。

### `@mai-kit/database`

读取曲目、定数、物量、谱面标签、封面和头像等非玩家数据。这些接口通常不需要玩家令牌。

包内提供 LXNS 和 Diving-Fish 实现，也可以自行实现 `MaimaiDatabase`。水鱼适配另有社区谱面
统计；这类数据源特有能力留在适配器上，不进入通用接口。渲染海报时，将数据源传入
`new Draw({ database })`。

### `@mai-kit/draw`

把玩家数据与曲目、素材和谱面标签组合成 PNG 或 SVG：

1. `new Draw({ database })` — `database` 提供素材 / 标签等能力
2. 按产物调用扁平方法：`poster` / `best15` / `chart` / `upgrades` 等（末位共用 `RenderOptions`：`scale` / 页脚 / `fonts` / `assetFallback`）

返回值是 `Uint8Array` 或 SVG 字符串；保存文件、上传和下载由应用处理。

### `@mai-kit/utils`

提供达成率归一、单曲 Rating、DX 满分、DX 星级和判定计算。所有函数都没有 I/O，可在 Node 和浏览器中直接使用。
`Draw.poster()` 等会根据曲目物量补齐 `dx_max`，生成海报前不需要调用方自行计算。

- `@mai-kit/utils`：常用稳定公式
- `@mai-kit/utils/judgement`：完整判定、规范化与判定计分
- `@mai-kit/utils/song`：谱面查找、key 与曲目索引

### `@mai-kit/analysis`

消费已经取得的成绩与谱面定数，提供 Best50 重算、单谱面升分评估、候选排序和两份 B50
快照对比。它不请求查分器或曲目 API；玩家成绩来自 prober，当前版本与定数由调用方通过
database 等来源准备。

### `@mai-kit/assets`

提供段位、评级等徽章，以及 draw 使用的默认字体和 resvg wasm。`Draw` 已经接入这些资源；只有直接使用素材或布局层 API 时才需要单独导入。

### `@mai-kit/shared`

定义 `MaiKitError`、谱面类型、难度索引、评级码等跨包共享类型，避免 database、prober 和 draw 分别维护同一套定义。

## 组合方式

| 用法              | 依赖                                     |
| ----------------- | ---------------------------------------- |
| 查询并生成海报    | prober + database + draw                 |
| 查询后自行展示    | prober；需要曲名或封面时再加入 database  |
| Rating 或成绩计算 | utils                                    |
| B50 与升分分析    | prober + analysis；定数通常来自 database |

## 运行环境

各库均以 ES2023 为目标，支持 **Node.js** 和现代浏览器，公开 API 在两端保持相同语义。

- 保存图片到磁盘：在 Node 里用你自己的写文件方式；浏览器里可做成下载或上传。
- 本地文件路径读图（例如本机封面路径）仅 Node 可用；Web 请使用 URL 或已准备好的图片数据。

## 错误处理

prober、database 和 draw 分别定义自己的错误类型，并统一继承 `MaiKitError`。调用方既可以按包处理，
也可以用 `isMaiKitError()` 捕获所有 mai-kit 错误。

database / prober 还提供包级 **未实现** 错误（`MaimaiDatabaseNotImplementedError` /
`ProberNotImplementedError`）：适配在「通用接口必须挂上、上游无对等能力」时抛出，便于与
HTTP / 业务失败区分。具体类型见 [API 参考](/api/)。

第三方来源与致谢见 [关于](./about)。
