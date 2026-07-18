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
| 检查判定组合并计算剩余容错      | `@mai-kit/judgement-solver`               |
| 根据成绩反推一组完整判定        | `@mai-kit/judgement-inference`（GPL-3.0） |
| 直接读取徽章、字体或 resvg wasm | `@mai-kit/assets`                         |
| 引用错误基类和 maimai 公共类型  | `@mai-kit/shared`（通常由其他包间接安装） |

## 包职责

### `@mai-kit/prober`

查询玩家档案、Best50、成绩记录等只读数据。公开的玩家模型不依赖具体查分服务，服务差异由适配器处理。

目前内置两个适配：

- [落雪查分器（LXNS）](https://maimai.lxns.net/)：个人令牌的完整成绩 / 历史 / 排行，以及开发者令牌的按玩家查询
- [Diving-Fish（水鱼）](https://www.diving-fish.com/maimaidx/prober/)：公开 B50 / Rating 排行、Import-Token、Developer-Token（完整、按曲目、按版本）

两种适配返回相同形态的 `profile` 和 `bests`，可以直接传给 `Draw.poster()`。
通用档案只要求昵称与 Rating；好友码、段位、阶级和装备 id 仅在数据源实际提供时存在，
适配器不会用 `0` 或占位名称伪装缺失数据。

各 token 的额外能力按返回类型收窄：例如 LXNS 个人 API 没有 Recent 50，开发者 `/scores`
只有精简字段；水鱼按版本成绩也不是完整 `Score`。这些差异保留在能力接口或适配专属类型中，
不会为了统一方法名补默认字段。

### `@mai-kit/database`

读取曲目、定数、物量、谱面标签、封面和头像等非玩家数据。这些接口通常不需要玩家令牌。

包内提供 LXNS 和 Diving-Fish 实现，也可以自行实现 `MaimaiDatabase`。水鱼适配另有社区谱面
统计；这类数据源特有能力留在适配器上，不进入通用接口。渲染海报时，将数据源传入
`new Draw({ database })`。
曲目模型中的数字版本、谱师、BPM 及 `SongList.genres` / `versions` 同样按数据源能力可选。

### `@mai-kit/draw`

把玩家数据与曲目、素材和谱面标签组合成 PNG 或 SVG：

1. `new Draw({ database })` — `database` 提供素材 / 标签等能力
2. 按产物调用扁平方法：`poster` / `best15` / `chart` / `upgrades` 等（末位共用 `RenderOptions`：`scale` / 页眉 / 页脚 / `fonts` / `assetFallback`）

返回值是 `Uint8Array` 或 SVG 字符串；保存文件、上传和下载由应用处理。

### `@mai-kit/utils`

提供达成率归一、单曲 Rating、DX 满分、DX 星级和判定计算。所有函数都没有 I/O，可在 Node 和浏览器中直接使用。
`Draw.poster()` 等会根据曲目物量补齐 `dx_max`，生成海报前不需要调用方自行计算。

- `@mai-kit/utils`：常用稳定公式
- `@mai-kit/utils/judgement`：完整判定、规范化与判定计分
- `@mai-kit/utils/song`：谱面查找、key 与曲目索引

### `@mai-kit/judgement-solver`

根据谱面物量、已有判定和最低达成率，以及可选的 DX 分与 FC/AP 约束，检查任意混合
判定是否达标、求某一判定的剩余容错，并生成全部判定的独立容错表。正向计分复用 utils，
不维护第二套公式。

实现为纯 TypeScript，无 I/O、原生 addon 或 WASM，Node 与浏览器返回相同结果；网页、Bot
和谱面对比只需准备物量并消费相同结果。

### `@mai-kit/judgement-inference`

根据谱面物量、目标达成率、可选 DX 分与汇总判定数量，使用 GLPK/WASM 返回一组经过 utils
回算验证的完整判定。结果是满足约束的一组可行解，不代表玩家真实原始判定。

本包因 `glpk.js` 单独使用 GPL-3.0-only，并保持为其他库包不得依赖的可选叶子包。Node 与 Web
共用 `inferJudgementDistribution`；Node 动态加载同步求解器，浏览器动态加载内置 Web Worker。

### `@mai-kit/analysis`

消费已经取得的成绩与谱面定数，提供 Best50 重算、单谱面升分评估、候选排序和两份 B50
快照对比。它不请求查分器或曲目 API；玩家成绩来自 prober，当前版本与定数由调用方通过
database 等来源准备。

### `@mai-kit/assets`

提供段位、评级等徽章，以及 draw 使用的默认字体和 resvg wasm。构建时会把徽章 PNG 合并
为单一运行时清单，浏览器只需加载一次。`Draw` 已经接入这些资源；只有直接使用素材或
布局层 API 时才需要单独导入。

### `@mai-kit/shared`

定义 `MaiKitError`、谱面类型、难度索引、评级码等跨包共享类型，避免 database、prober 和 draw 分别维护同一套定义。

## 组合方式

| 用法               | 依赖                                     |
| ------------------ | ---------------------------------------- |
| 查询并生成海报     | prober + database + draw                 |
| 查询后自行展示     | prober；需要曲名或封面时再加入 database  |
| Rating 或成绩计算  | utils                                    |
| 判定组合与容错预算 | judgement-solver + utils                 |
| 成绩反推完整判定   | judgement-inference + utils（最终应用）  |
| B50 与升分分析     | prober + analysis；定数通常来自 database |

## 运行环境

各库均以 ES2023 为目标，支持 **Node.js** 和现代浏览器，公开 API 在两端保持相同语义。
CI 通过 `pnpm test:web` 使用 Vite + headless Chrome 验证 judgement-solver、
judgement-inference、assets、database 标签快照与 draw WASM 栅格化路径。

- 保存图片到磁盘：在 Node 里用你自己的写文件方式；浏览器里可做成下载或上传。
- 本地文件路径读图（例如本机封面路径）仅 Node 可用；Web 请使用 URL 或已准备好的图片数据。

## 错误处理

prober、database 和 draw 分别定义自己的错误类型，并统一继承 `MaiKitError`。调用方既可以按包处理，
也可以用 `isMaiKitError()` 捕获所有 mai-kit 错误。

database / prober 还提供包级 **未实现** 错误（`MaimaiDatabaseNotImplementedError` /
`ProberNotImplementedError`）：适配在「通用接口必须挂上、上游无对等能力」时抛出，便于与
HTTP / 业务失败区分。具体类型见 [API 参考](/api/)。

第三方来源与致谢见 [关于](./about)。
