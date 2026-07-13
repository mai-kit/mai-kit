# AGENTS.md

面向在本仓库协作的 agent / 开发者的项目说明。更细的包 API 见各包 `README.md`；通用 TS monorepo 脚手架约定见 `.agents/skills/ts-library-monorepo/SKILL.md`。

## 项目是什么

**mai-kit**：maimai（舞萌 DX）工具集 monorepo。目标是提供可组合的库包：游戏静态数据、玩家查分、成绩分析、离线徽章素材、成绩海报渲染。

- 语言 / 模块：TypeScript 6，**ESM-only**（各包 `"type": "module"`）
- JavaScript 目标：**ES2023**（Node 24 + 现代浏览器）
- 包管理：pnpm 11 workspaces（`packages/*`）
- 构建：tsdown（rolldown）；类型检查：`tsc --noEmit`（**build-first**）
- 运行时：Node 24（开发/测试）+ **浏览器（库目标，见「双端目标」）**
- 版本：各库包独立 semver（当前初始 `0.1.0`），内部依赖 `workspace:*`；以 monorepo 开发为主

### 双端目标（默认要求）

**所有 `packages/*` 库包默认按 Node 与 Web（浏览器）双端可用来设计与实现。**

| 规则             | 说明                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| 默认双端         | 公开 API、资源加载、依赖选型都优先能在两端跑通                                                   |
| **行为一致优先** | 除非差异巨大（写盘、原生 addon vs WASM），**对外返回值与语义两端应相同**；环境差只关在加载实现里 |
| 明确例外         | 仅当 **文档写明** 为 Node-only / Web-only，或 **事实上无法实现** 时，才可单端或语义分叉          |
| 禁止默认真 Node  | 不要在核心路径静态绑死 `node:fs` / CWD；Node 专用逻辑用 dynamic import 或明确 Node-only API      |
| 资源             | `import.meta.url` 定位；Node `file:` 可读盘，Web `fetch`；**对外仍统一**（如徽章都是 data URI）  |
| 原生依赖         | 仅 Node 有实现时须 Web 替代（WASM 等）或明确 Node-only；**I/O 落盘/下载留给宿主**，库只产出数据  |
| 验证             | Node 单测 + `pnpm test:web` 真实浏览器 smoke；Web 路径不得误打包仅 Node 的静态依赖               |

当前例外示例（须在代码/README 可见）：

- 本地磁盘路径读图（`coverPath` 非 URL）：**仅 Node**；Web 用 data/http(s)/blob URI
- PNG 栅格引擎：Node `resvg-js` / Web `resvg-wasm`（结果都是 `Uint8Array`）
- database `FileSystemCacheStore`：**仅 Node**（`node:fs` 动态 import）；Web 用 `MemoryCacheStore` 或自实现

## 包地图

```
packages/
├── shared/     # 共享：MaiKitError + maimai 领域原语（SongType / RateType / …）
├── utils/      # Rating、达成率、判定、DX 分、谱面索引等纯函数；无 I/O
├── judgement-solver/ # 混合判定检查、剩余容错与独立容错表；纯 TypeScript、无 I/O
├── database/   # 游戏静态数据 + 素材（适配器；LXNS 公共 API，无鉴权）
├── prober/     # 查分器适配层（条件 client；personal / dev token）
├── analysis/   # Best50 重算、升分候选、成绩快照对比；纯分析
├── assets/     # 统一静态资源（徽章 PNG / 字体 / resvg wasm）
└── draw/       # 成绩海报（satori + resvg；不自带 assets/）
```

### 依赖方向（硬约束）

```
shared ← utils ← judgement-solver
shared ← database
shared ← prober ← analysis
utils  ← analysis
shared ← assets ← draw
prober ← draw
utils  ← draw
```

| 规则                  | 说明                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 禁止反向依赖          | 下层不得 import 上层（如 `shared` 不能依赖 `draw`）                                                                                      |
| `database` ↔ `prober` | **互不依赖**。静态数据 vs 玩家数据，边界清晰；draw 只通过最小结构接口连接二者                                                            |
| `draw` → `database`   | **不**把 database 当作硬依赖。draw 只声明最小 `AssetSource` / `ChartTagSource` / `SongListSource`；经注入使用                            |
| `draw` → `prober`     | 有 runtime 依赖（`Draw.poster` 等消费 prober 模型）。字段尽量透传，避免中间 DTO                                                          |
| `draw` → `utils`      | `Draw` 出图时用 utils 算 `dx_max` / 定数 map；**填 dx_max 是 draw 职责**，不要丢给调用方                                                 |
| `analysis`            | 依赖 prober 模型与 utils 公式；只做确定性内存分析，不请求 database / prober API                                                          |
| `judgement-solver`    | 依赖 shared 的 FC 类型与 utils 判定公式；纯 TypeScript 求解，不维护第二套计分，不引入 I/O                                                |
| `utils`               | 仅纯函数；不依赖 database/prober/analysis/judgement-solver/draw                                                                          |
| 领域原语              | 放 `@mai-kit/shared`（`SongType` / `LevelIndex` / `FCType` / `FSType` / `RateType` / `Collection*`），database / prober 再导出，避免漂移 |

新增包或跨包引用时先核对本表，再改 `package.json`。

## 各包职责

### `@mai-kit/shared`

- `MaiKitError` / `isMaiKitError`：全仓库错误基类
- maimai 领域原语（类型 + `LevelIndex` 枚举）
- 可选 HTTP 工具：`fetchWithResilience` / `RequestCoalescer`（无业务、无数据源绑定；适配映射错误）
- 保持精简；**不放**查分/曲目适配或业务流程；不把某一 CDN/API 写进 shared

### `@mai-kit/utils`

- 纯函数：DX Rating / 评级 / 判定明细 / DX 分星级 / Note 扣分 / 谱面索引等
- 代表 API：`calculateDxRating` / `calculateAchievement` / `dxStarFromScore` / `findSongDifficulty`
- 无 I/O、无适配器；包根导出常用稳定公式，高级公共入口为 `@mai-kit/utils/judgement` / `song`
- 未列入 package `exports` 的源码模块属于内部实现；不提供 `internal` 公共入口
- 海报场景下 **注入 chart.dx_max 仍由 draw 完成**（内部调 utils），用户不必拼 map
- 随机成绩、判定预算或重依赖反推不进入 utils；组合检查与剩余容错由 `@mai-kit/judgement-solver` 提供

### `@mai-kit/judgement-solver`

- `evaluateJudgementPlan`：检查任意已有混合判定是否满足达成率 / DX 分 / FC 约束
- `solveJudgementLimit`：在已有判定基础上，求某一目标判定还能新增多少个
- `solveJudgementLimits`：生成全部非 CP 判定的独立剩余容错表，结果不可相加
- 可叠加最低 DX 分与 `FCType`（FC / FC+ / AP / AP+）约束
- 复用 `@mai-kit/utils` 的 `calculateAchievement` / `calculateChartDxScore`，不维护平行公式
- 纯 TypeScript、无 I/O / Node API / 原生 addon / WASM；Node 与 Web 行为一致
- 未分配 Note 明确补为 CP；已有判定不可被求解器删除或改写

### `@mai-kit/database`

- 接口：`MaimaiDatabase`（曲目 / 别名 / 收藏品 / 素材二进制）
- 实现：`LxnsMaimaiDatabase`（公开 API + 素材 CDN）
- 可选缓存：适配器创建参数 `cache: { store, ttlMs? }`；省略即关闭
- 通用缓存接口：`DatabaseCacheStore`；内置 `MemoryCacheStore`（双端 LRU）、`FileSystemCacheStore`（**Node-only** 磁盘）
- **不含**玩家成绩、好友码查询
- 新数据源：实现 `MaimaiDatabase`，放 `src/adapters/<name>/`
- DXRating 社区谱面标签以本地快照发布；GitHub Actions 每周同步，运行时不请求上游

### `@mai-kit/analysis`

- `recalculateBests`：按调用方提供的新曲判定重算 B15 / B35
- `analyzeScoreUpgrade` / `rankUpgradeCandidates`：按精确定数评估升分
- `compareBests`：比较两份 B50 的进入、提升、下降与掉出
- 依赖 `@mai-kit/prober` 模型和 `@mai-kit/utils` 公式；无 I/O，不猜测当前版本

### `@mai-kit/prober`

- 通用模型：`PlayerProfile` / `Score` / `Bests` / …
- 通用接口：`ProberPlayer`（档案 + Best50）；其他查询按 `*Capability` 能力接口组合
- LXNS：`createLxnsClient` — **条件类型**按 token 暴露方法
  - `personalAccessToken` → `client.me(): FullProberPlayer`
  - `devAccessToken` → 按好友码的 dev 查询挂在 client 上
  - 至少一个 token；都没有则抛 `ProberError`
- 仅只读查询；新查分器放 `src/adapters/<name>/`

### `@mai-kit/assets`

- **统一静态资源**：徽章 PNG、默认字体、resvg wasm，都在本包 `assets/`
- 徽章：`get*Badge` → data URI；build 将原始 PNG 合并为单一 `dist/badges.json`，top-level await 只读取一次清单
- 字体 / wasm：`getDefaultFontBuffers` / `getResvgWasmBytes`（按需，模块缓存）
- 双端一致：fs（Node `file:`）或 fetch（Web），API 无分叉
- 不适合走 database CDN 的大批量 per-id 素材（封面 / 头像等）

### `@mai-kit/draw`

- `Draw`：扁平入口，**一种图一个方法**（`poster` / `best15` / `best35` / `best50` / `chart` / `upgrades` + 对应 `*Svg`）
- 末位 `RenderOptions`：`scale`（默认 2）/ `fonts` / `footerLeft` / `footerRight` / `assetFallback`（默认 `"error"`）；单曲卡不画玩家栏
- 按图传最小数据：完整海报要 `profile`+`bests`+标签；Best 板要署名+`Bests`（库内只 slice 不排序，不足则少画）；加分候选由宿主用全曲+定数经 `rankBestsUpgradeCandidates`（**B15/B35 增量**，非单曲理论加分）
- **不自带** `assets/`；默认字体与 wasm 经 `@mai-kit/assets`
- PNG：Node `@resvg/resvg-js`，Web `@resvg/resvg-wasm` + assets 包内 wasm
- 徽章 / 字体 / wasm → `@mai-kit/assets`；封面 / 头像 → `database` / data URI

## 典型数据流

B50 海报（最常见集成路径）：

```
createLxnsClient({ personalAccessToken })
  .me()
  → getProfile() + getBests()
  → new Draw({ database }).poster(profile, bests)
  → Uint8Array (PNG)
```

字段约定：`Score` / `PlayerProfile` 的码值字段（`rate` / `fc` / `fs` / `course_rank` / `achievements` 等）**透传到** draw 的 `ScoreChart` / `PlayerProfile`；展示格式化在渲染时完成，不要在中间层再映射一套平行结构。

## 工具链与命令

根目录 scripts（工具装在 workspace 根，子包不重复装 oxlint/tsdown/typescript）：

| 命令                             | 作用                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `pnpm install`                   | 安装依赖                                                                 |
| `pnpm build`                     | 按 workspace 依赖拓扑构建所有库包                                        |
| `pnpm typecheck`                 | **先 build 再**各包 `tsc --noEmit`                                       |
| `pnpm test`                      | 各包 `test`（无 test 脚本的包会被 pnpm 跳过/报错视配置而定）             |
| `pnpm test:web`                  | 先 build，再用 headless Chrome 验证 solver/assets/database/draw Web 路径 |
| `pnpm test:web:built`            | **CI 内部**：复用已构建 `dist` 跑 Web smoke，不重复 build                |
| `pnpm docs:dev` / `docs:build`   | VitePress + TypeDoc 自动 API 文档（`docs:build` 会先 build）             |
| `pnpm docs:build:built`          | **CI 内部**：复用已构建 `dist` 生成文档并跑 generated-api 测试           |
| `pnpm changeset`                 | 记录待发版变更（写 `.changeset/*.md`）                                   |
| `pnpm ci:version` / `ci:publish` | 发版脚本（由 Release CI 调用；本地也可）                                 |
| `pnpm dev`                       | 各包 `tsdown --watch`                                                    |
| `pnpm clean`                     | 清理各包构建产物                                                         |
| `pnpm lint` / `lint:fix`         | 先 build，再运行 type-aware oxlint                                       |
| `pnpm format` / `format:check`   | oxfmt                                                                    |
| `pnpm check`                     | format:check + build + lint                                              |
| `pnpm fix`                       | format + lint:fix                                                        |

单包：

```bash
pnpm --filter @mai-kit/draw build
pnpm --filter @mai-kit/draw test
pnpm --filter @mai-kit/draw test:integration:lxns   # 真数据集成
```

### 架构硬规则（改工具链前必读）

1. **tsdown 独占 `dist`**；`tsc` 只 `--noEmit`，禁止让 typecheck 写出文件。type-aware lint 同样依赖跨包 `dist/*.d.ts`，所以根 `lint` / `check` 必须 build-first，并在清空 `dist` 后仍能独立通过。
2. **不用 composite Project References 构建**：禁止给包间建立 `references` 依赖图或用 `tsc -b` / tsc emit 接管产物；跨包类型走 `exports` → 已构建的 `dist/*.d.ts`。允许根 `tsconfig.json` 使用 `files: []` + `references` 作为 **IDE solution 索引**，但叶子配置不启用 `composite`，构建脚本也不消费该引用图。
3. JavaScript 基线固定为 **ES2023**：base `target` / `lib` 与每包 tsdown `target` 保持一致。
4. **`moduleResolution: "bundler"`** + `module: "esnext"`；源码相对 import / export 不带扩展名。
5. tsdown 开启 `exports: true`，由入口和产物自动生成各包 `package.json#exports`；`fixedExtension: false`（发布产物为 `.js` 不是 `.mjs`）、`hash: false`（稳定文件名）是必要 override。改配置后务必 build 并检查生成的 manifest 与 `dist/`。
6. **不用 `paths` 指到源码**做跨包 typecheck；保持 build-first。
7. base 只使用语言标准类型（`lib: ["es2023"]`、`types: []`），**不得默认注入 DOM 或 Node 平台类型**。使用 Web API 的包在自身 tsconfig 显式加入 `dom` / `dom.iterable`；源码确实含 Node 专用实现的包再设置 `types: ["node"]`，并在 `devDependencies` 声明 `@types/node`。若只有 Node 单测，子包无需声明，由根 `@types/node` + `tsconfig.test.json` 统一检查；根 solution config 引用该测试配置，保证 IDE 正确归属而不污染生产源码。
8. CI 先用 `actions/setup-node` 读取 `.node-version`，再由 `corepack enable pnpm` 根据根 `packageManager` 启用精确 pnpm 版本；不要再叠加自带旧 pnpm bootstrap 的 setup action。
9. CI 的 `check` 只 build 一次；后续 typecheck/test/docs/Web smoke 必须复用该次 `dist`。本地易用命令保留 build-first，CI 走对应 `*:built` 入口。
10. Release / Pages 只接受本仓库 `main` 的成功 `push` CI；特权 `workflow_run` 必须校验 event、branch、repository，并只消费已验证 SHA / artifact。
11. 细节与脚手架模板见 `.agents/skills/ts-library-monorepo/SKILL.md`。

## 代码约定

### 实现原则（优先遵守）

本仓库偏向 **直白、少层、改根源**。agent 与贡献者写代码时默认按下列执行。

#### 1. 最小重复，拒绝空壳中转

- **不要**为“拆文件/拆层次”而写只做 rename 转发的包装：  
  例如曾出现的 `Draw` 类方法全部 `return coreRenderXxx(...)`、真正逻辑在另一个 `render.tsx` 自由函数里——属于多余一圈，应把实现写在类（或唯一入口）内。
- **一个概念一条实现路径**：公开 API 与实现应尽量重合；需要抽函数时，是为了复用或可测，不是为了再包一层。
- 类型 / 接口放 `types.ts` / `models.ts` 等定义文件；`utils` 只放纯函数，不塞领域接口与半套业务。

#### 2. 有问题改根源，禁止绕一圈“兼容”

- API 或设计不对时：**直接改对的形状**（构造参数、字段名、职责边界），并更新调用方与文档。
- **禁止**用下列方式“兼容旧写法”却保留错误模型：
  - 双 API 并存（旧函数 + 新类，行为相同）
  - 适配层只为迁就历史错误 API
  - 平行 DTO / 二次映射只为避开改上游字段
  - 为迁就错误依赖而加的 shim、facade、再 export 一圈
- 破坏性变更在 monorepo 内可以同步改完；不要为了假兼容把结构弄弯。

#### 3. 分层只服务边界，不服务形式

合理分层示例：

| 合理                     | 不合理                                        |
| ------------------------ | --------------------------------------------- |
| adapter 隔离数据源       | 同包内 A 只调 B、B 只调 C 且无独立复用        |
| `AssetSource` 收窄依赖   | 再包一层 `AssetSourceAdapter` 无行为差异      |
| `Draw.poster()` 直接出图 | `withPlayer()` → 中间对象 → `render` 空壳中转 |
| 组件 / 类持有渲染逻辑    | 类空壳 + 旁路 `render.ts` 重复职责            |

#### 4. 字段与模型：透传优先

- prober 原始字段（`rate` / `fc` / `dx_score` / `course_rank`…）**透传**到 draw；展示格式化在渲染时做。
- 不为海报再发明一套平行命名，除非语义确实不同（如可选的 `dx_max` 是注入字段，不是 prober 已有字段的改名）。

#### 4b. 禁止冗余传参（硬规则）

公开 API / DTO **不得**让调用方（或中间聚合层）为同一事实写两遍。

| 禁止                 | 说明                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| 派生字段与源字段双写 | 如 `charts` 已有成绩，又必填 `ratingDistribution` / 再抄一份 `personalMetrics`                     |
| 两套平行统计         | 如 summary 与 personalMetrics 各算一遍且指标还不一致                                               |
| 同义双 API           | 如 `foo` 与 `fooAlias` 行为完全相同（语义别名也不要；用文档说明场景即可）                          |
| 多路径必填叠加       | 同一资源同时要求 data URI + path + database 拉取都传；应是 **可选互斥回退链**（有 A 用 A，否则 B） |

**正确做法：**

1. 明确 **权威字段**（source of truth）：如 draw 的 `player` / `charts` / `summary` / `radar`。
2. 展示用派生量在 **使用点现算**（渲染 / 格式化层），或只存 **一份** 聚合结果（如 `summary`）。
3. 覆盖入口必须是 **整表替换**（如可选 `personalMetrics`），不是与默认字段平行再抄数。
4. 新增 API 前自问：这个参数能否从已有参数推出？能则不要加。

#### 5. 回退 / 兜底行为：禁止自行设计

**所有 fallback、默认值、静默吞错、占位 UI、降级路径，都必须先与用户确认。**  
没有明确要求时，**不要**自行发明回退逻辑。

包括但不限于：

| 禁止擅自做的         | 例子                                                 |
| -------------------- | ---------------------------------------------------- |
| 失败时「凑合能显示」 | 素材拉取失败 → 自画占位图 / 空白图 / 假数据          |
| 静默吞异常           | `catch { /* 忽略 */ }` 后继续渲染                    |
| 缺字段时编默认       | 无 `course_rank` 显示「未设置」、无名字显示 `Player` |
| 双端/环境自动降级    | Web 失败改走另一套半成品路径且未约定                 |
| 兼容旧错误形态       | 为迁就错误数据再加一层兼容映射                       |

正确做法：

1. **缺规格时先问**：缺图、缺字段、请求失败时，抛错 / 中断还是某种展示？问清楚再写。
2. **已确认的回退**才实现，并在代码/README 写明约定（避免后人再「顺手」加兜底）。
3. **改已有回退**同样要确认，不要默默收紧或放宽。

> 现状：draw 素材失败默认 **抛 `DrawError`**；仅当出图方法传入 `{ assetFallback: "placeholder" }` 时才用内置占位图。
> **新增或扩大**静默回退须确认；改默认策略须确认。

### 包结构

```
packages/<name>/
├── package.json          # exports → dist；files 只含发布产物 / 运行时资源 / README / LICENSE
├── tsconfig.json         # extends ../../tsconfig.base.json
├── tsdown.config.ts
├── src/
│   ├── index.ts          # 公共导出入口
│   ├── error.ts          # 包级错误（若有）
│   ├── models.ts / types.ts  # 领域模型与接口
│   └── adapters/<src>/   # 具体数据源（database / prober）
└── README.md
```

- 公共 API 只从 `src/index.ts` 导出（多 entry 时在 package `exports` / tsdown 明确声明）。
- 常规库包的 `files` **不带 `src`**；只发布 `dist`、README、LICENSE 与确实在运行时读取的 `assets` / `data`。发版前可用 `pnpm pack --dry-run --json` 查看实际 tarball 清单。
- **未从包根 `index` 导出的模块 = 内部实现**（适配内 `mappers`、`chart-tags`、`http` 私有类等）；测试可相对路径引用源码，**不要**为测而扩大公开面。
- 源码相对 import / export **不带扩展名**，由 `moduleResolution: "bundler"` 与 tsdown 解析；发布产物仍是 `.js`。
- draw：入口类 `draw.ts`（无 JSX，`createElement`）；**所有 `.tsx` 布局组件放 `components/`**。

#### 公开面收窄与 API 文档（TypeDoc）（硬规则）

**目标：** 用户 `import` 与 API 站只看到**稳定、必要**的表面；适配内部 map / 快照 / 私有方法既不导出也不进文档。

| 规则                               | 说明                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **包根 `index` = 唯一公开面**      | TypeDoc `entryPoints` 跟 `src/index.ts`（多 entry 时跟 package `exports`）；未从此导出的一律视为内部                                           |
| **private / protected 永不进文档** | `docs/typedoc.json`：`excludePrivate` / `excludeProtected`：`true`。类上 `private loadAssets()` 等**禁止**出现在 API 页                        |
| **@internal 不进文档**             | `excludeInternal`：`true`。包内再导出、构建脚本、仅为类型拼装的 re-export 标 `@internal`；**不要**只靠 `@hidden` 注释指望藏文档                |
| **适配 helper 默认不公开**         | 如 `mapDivingFish*`、`divingFishCoverId`、`getLocalChartTags` / 快照加载等：**不从包根 export**；用户走 `createXxxClient` / `MaimaiDatabase.*` |
| **不为测试扩大公开面**             | 测内部逻辑时用相对路径引用 `src/...`，或只测公开 API；禁止 `export` 仅为了 `import "@scope/pkg"` 方便单测                                      |
| **高级出口要标明**                 | 若必须公开（如 draw 的 `B50Poster`），标 `@beta`，README 写「高级 / 可能变动」                                                                 |

**反例 / 正例：**

```ts
// ❌ 把适配内部 map 挂到包根
export { mapDivingFishRecord } from "./adapters/diving-fish/mappers";

// ✅ 包根只给用户路径
export { createDivingFishClient } from "./adapters/diving-fish";

// ❌ 指望未标注的 private 进文档或不进文档含糊不清
// ✅ 实现细节用 private；跨文件内部符号不 export 或 @internal

// ❌ 为 chart-tags.test 从 index 导出 getLocalChartTags
// ✅ 测试走 db.getChartTags() 或 import "../src/chart-tags.ts"
```

改公开 export 或 TypeDoc 可见性后跑 `pnpm docs:build`（含 generated-api 测试：私有成员 / 未导出 helper 不得出现在 API md）。

### 错误

| 包       | 错误类型                            | 守卫                                  |
| -------- | ----------------------------------- | ------------------------------------- |
| shared   | `MaiKitError`                       | `isMaiKitError`                       |
| database | `MaimaiDatabaseError`               | `isMaimaiDatabaseError`               |
| database | `MaimaiDatabaseNotImplementedError` | `isMaimaiDatabaseNotImplementedError` |
| prober   | `ProberError`                       | `isProberError`                       |
| prober   | `ProberNotImplementedError`         | `isProberNotImplementedError`         |
| draw     | `DrawError`                         | `isDrawError`                         |

- 新包错误 **必须** 继承 `MaiKitError`，`name` 设为类名。
- 适配器把 HTTP / 业务错误归一成**包级基类或其子类**，不把裸 `fetch` 异常抛给调用方（除非刻意透传 `cause`）。
- **适配专用错误**放在 `adapters/<name>/error.ts`，继承包级错误（如 `LxnsProberError extends ProberError`、`DivingFishDatabaseError extends MaimaiDatabaseError`），并导出 `is*` 守卫。

#### 错误分层（硬规则）

```
MaiKitError                          # shared：全仓基类
  └─ <Package>Error                  # 包根 error.ts：HTTP / 业务 / 缓存等
       ├─ <Package>NotImplementedError   # 包根：能力缺失（与数据源无关）
       └─ <Adapter>Error                 # adapters/<name>/error.ts：仅该源的失败
```

| 层级           | 放哪里                     | 何时抛                                             | 调用方守卫                                                            |
| -------------- | -------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| 包级基类       | `src/error.ts`             | 鉴权失败、HTTP、业务码、缓存等「请求/处理失败」    | `isProberError` / `isMaimaiDatabaseError`                             |
| **包级未实现** | `src/error.ts`             | **通用接口方法必须挂上，但当前适配上游无对等能力** | `isProberNotImplementedError` / `isMaimaiDatabaseNotImplementedError` |
| 适配专用       | `adapters/<name>/error.ts` | 该数据源特有的失败（便于区分 LXNS vs 水鱼）        | `isLxns*` / `isDivingFish*`                                           |

**包级未实现错误（`*NotImplementedError`）必须遵守：**

1. **定义在包根 `error.ts`**，继承该包 `*Error`；带 `method`（方法名）与可选 `adapter`（仅文案，如 `"Diving-Fish"`），并导出 `is*NotImplementedError`。
2. **各适配实现复用包级类**，不要在 `adapters/<name>/` 里再写 `unsupported()` / `NotSupported` 抛适配专用错误。
3. **语义与 HTTP 失败分离**：`isDivingFishDatabaseError(notImplemented)` 应为 **false**；调用方才能用 `is*NotImplementedError` 做换源/降级，用适配 `is*` 处理网络失败。
4. **优先类型收窄**：能用条件类型 / `*Capability` 在类型上不暴露方法时，不要挂空实现再抛；仅在「接口强制实现」或运行时兼容层必须占位时抛 `*NotImplementedError`。
5. **示例（水鱼 database）**：`getAliasList` / 收藏品 / 非 `jacket` 的 `getAsset` → `MaimaiDatabaseNotImplementedError`；music_data HTTP 失败 → `DivingFishDatabaseError`。

```ts
// ✅ 适配内：复用包级未实现错误
throw new MaimaiDatabaseNotImplementedError({
  method: "getAliasList",
  adapter: "Diving-Fish",
});

// ❌ 禁止：在适配里造一套「不支持」并抛适配专用错误
throw new DivingFishDatabaseError({ message: "… does not support getAliasList" });
```

捕获约定：宽捕获用包级 `is*` → 能力缺失用 `is*NotImplementedError` → 区分数据源用适配 `is*`。

### 适配器模式

- **接口与模型**在包根（`MaimaiDatabase`、`ProberPlayer`、共享 `models`）；**实现**在 `adapters/<source>/`。
- LXNS / Diving-Fish 等是**当前提供的适配**，不是「默认唯一数据源」；新增源时在 `adapters/<name>/` 实现，勿泄漏专有字段进通用模型。
- **禁止**把某一适配的专有概念写进通用模型（除非该语义在领域上确实通用）。
- draw 的 `AssetSource` / `DrawAssetType` 是**故意收窄**的本地接口，不要为了“方便”改成 import `MaimaiDatabase`。
- **能力缺失**用包级 `*NotImplementedError`（见上节）；不要把「未实现」伪装成适配 HTTP 错误。

### 文档与文案：通用接口 vs 适配

面向用户的说明书、包 README、**通用接口 / 模型的 JSDoc**（含 TypeDoc 生成页）必须遵守。

这里说的「通用」= **不绑定某一查分器或 CDN**，不是「什么都能干」的万能 API。

| 写什么                         | 放哪里                                                           | 要求                                                                              |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 通用接口 / 模型                | 包根 `ProberPlayer`、`MaimaiDatabase`、`PlayerProfile`…          | **不绑定**某一数据源；不写「LXNS personal / me() / 好友码路径」等实现细节作为定义 |
| 适配实现                       | `adapters/<name>/`、README「×× 适配」小节、`createLxnsClient` 等 | 可写该源的 token、URL、条件 API；并标明「实现上述通用接口」                       |
| 站点指南 `docs/guide/*`        | 面向使用方                                                       | 不写 monorepo/CI/TypeDoc 内部；示例可选用某一适配，但须标明「以 ×× 适配为例」     |
| 包入口 `@packageDocumentation` | `src/index.ts`                                                   | 先讲通用用法，再可选附「某适配示例」                                              |

**反例（禁止）：**

```ts
/** 玩家查询接口。LXNS personal 的 client.me() 返回该实现。 */  // ❌ 把适配写进通用接口定义
export interface ProberPlayer { ... }
```

**正例：**

```ts
/** 已绑定身份的玩家只读查询接口（与具体查分服务无关）。身份由适配在创建时绑定。 */
export interface ProberPlayer { ... }

// adapters/lxns/lxns-player.ts
/** LXNS 个人令牌路径下的 ProberPlayer 实现。 */  // ✅ 适配文件内说明
```

- 示例代码优先写 `player` / `database` / `profile` / `bests` 等通用变量；需要可运行样例时再引入 `createLxnsClient` 等，并加注释「某适配示例」。
- 改通用接口 JSDoc 后应重生 API 文档（`pnpm docs:build` 或 `pnpm --filter mai-kit-docs run api`）再检查生成页是否仍泄漏适配细节。

### 资源与路径

- 包内静态资源用 `import.meta.url` 解析，**禁止**依赖 `process.cwd()`。
- 包内资源读取须双端可用（Node `file:` 用 fs，Web 用 fetch）：**不要**假设 `fetch(fileURL)` 在 Node 可用。
- 小图集素材保留原始 `assets/` 作为构建源；运行时若需同步 getter，可在 `dist` 生成单一资源清单，禁止把巨型生成物塞进 `src/`。
- 素材失败策略（draw）：单项 `getAsset` 失败回退占位，不拖垮整张海报。
- Web bundler 消费 draw/assets 时：须能解析/拷贝 `@mai-kit/assets` 的 `dist/badges.json`、`assets/fonts/*` 与 `assets/resvg/*.wasm`（静态 `new URL(..., import.meta.url)`）；用 `pnpm test:web` 验证。
- database 缓存由适配器构造参数显式开启；不得在 draw 内再实现跨玩家数据 / 素材缓存。
- 缓存失败不得静默绕过；失败不写缓存，相同进行中请求须合并。

### 格式与 lint

- oxfmt / oxlint。
- `typescript/promise-function-async` 为 error：返回 Promise 的函数应标 `async`。
- 动态 `import("node:…")` 后**不要解构**可能 unbound 的 method（用模块命名空间调用）。
- 忽略：`dist/**`、`node_modules/**`、`.agents/**`。
- **编辑器**：`.vscode/` 只负责启用 Oxc 扩展与保存时 format/fix；lint/format 规则只维护根目录 `.oxlintrc.json` / `.oxfmtrc.json`，勿在 settings 里再写一份。

## 发版（Changesets + OIDC）

- 工具：`@changesets/cli`；配置在 `.changeset/config.json`（`access: public`，忽略 `mai-kit-docs`）。
- **不要**在 CI 里放 `NPM_TOKEN` / `NODE_AUTH_TOKEN` 用于 publish；走 **npm Trusted Publishing（OIDC）**。
- `.github/workflows/ci.yml` 是唯一源码门禁：PR 与 `main` push 各验证一次，单次 build 后完成 format/lint、typecheck、单测、文档构建和真实浏览器 smoke；`main` 成功时上传已验证文档 artifact。
- `.github/workflows/release.yml` 由成功的 `CI` `workflow_run` 触发：
  - 仅接受本仓库 `main` 的 `push`，并 checkout `workflow_run.head_sha`；不得 checkout PR/fork 代码或消费其 artifact。
  - Changesets 的 `branch` 显式设为 `main`，不依赖 `workflow_run` / detached HEAD 的默认 ref 推断。
  - 有未消费 changeset → 开/更新 Version PR。
  - `GITHUB_TOKEN` 创建/更新的 Version PR 检查可能处于“需要审批”；发布安全仍由合并后的 main CI 保证。若分支策略必须让 bot PR 自动跑，使用最小权限 GitHub App token，不要为此引入宽权限 PAT。
  - 合并 Version PR 后再次通过 CI → `pnpm run ci:publish`（一次全新 `build` + `changeset publish`）。
  - 不重复 format/lint/typecheck/test/docs/Web 门禁；权限为 `id-token: write` + `contents: write` + `pull-requests: write`。
- `.github/workflows/deploy-docs.yml` 同样只在成功 main CI 后运行，直接下载该次 `docs-site` artifact 并部署；特权 workflow 中不 checkout 或执行仓库源码。
- 发版 job 固定安装明确 npm 版本（当前 `npm@11.16.0`），不要使用会漂移的 `npm@latest`。
- 各库包已设 `publishConfig.access: public`、`publishConfig.provenance: true`，以及 `repository`（须与真实 GitHub 仓一致）。
- 每个 `@mai-kit/*` 只能配置一个 Trusted Publisher：仓库 `wsyzxjn/mai-kit`、`Workflow filename = release.yml`（仅文件名）、允许 `npm publish`。
- 新包必须先手动发布首个版本，使包名在 npm registry 存在，再配置 OIDC：

  ```bash
  npm trust github @mai-kit/<package> --file release.yml --repo wsyzxjn/mai-kit --allow-publish --yes
  npm trust list @mai-kit/<package> --json
  ```

- Trusted Publishing 验证成功后再把 npm 包的 Publishing access 收紧为禁止 token；不要在验证前先切断手动恢复路径。
- 单人维护：日常 `pnpm changeset` → push main → CI → 合并 bot 的 Version PR → CI → 自动发版。失败时重跑原 workflow，不保留可绕过门禁的手动 Release 入口。

## 交付门禁（每次改动必过）

**任意实现改动结束前，必须本地确认下列检查通过；未通过不得声称完成。**

| 顺序 | 命令                             | 含义                                          |
| ---- | -------------------------------- | --------------------------------------------- |
| 1    | `pnpm check`                     | build-first：oxfmt + oxlint                   |
| 2    | 相关包 `pnpm test`               | 至少覆盖改动涉及的包                          |
| 3    | 触及类型/跨包时 `pnpm typecheck` | build-first 全仓类型检查                      |
| 4    | 触及文档时 `pnpm docs:build`     | 重生 TypeDoc API + VitePress 构建与生成物测试 |

- 可先 `pnpm fix` 自动修 format/lint，再 `pnpm check` 确认绿。
- 改公共 API / monorepo 结构时：**check + typecheck + 相关 test** 全绿。
- agent：改文件后**主动跑门禁**；失败则修到通过，不要留给用户发现。
- **文档改完必跑 `pnpm docs:build`**（不要只跑 `api` 或只改 md 就声称完成）。触发范围包括但不限于：
  - `docs/**`（guide、typedoc 配置/插件、`api-categories.json`、站点配置）
  - 公共 API 的 JSDoc / `@packageDocumentation` / 包 README 中会影响生成页的说明
  - 会改变 TypeDoc 输出或 VitePress 侧栏的任意改动
  - 失败则修到 `docs:build` 通过（含其中的 generated-api 测试）

## 测试与环境

- 单测：`node --test`（Node 24 可直接跑 `.ts`）。draw 的 `test` 脚本会先 build。
- 真实集成：定义在 `@mai-kit/draw` 的 `test:integration:lxns`
  - 运行：`pnpm --filter @mai-kit/draw test:integration:lxns`
  - `prober`（个人 token 拉 B50）+ `database`（曲目 notes → dx_max、素材 CDN）+ `draw`
  - 读取仓库根 `.env`（**已 gitignore**）中的 `LXNS_API_PERSONAL_ACCESS_TOKEN`
  - 未设置则 skip；不要提交 token
- 渲染预览产物写在 `packages/draw/output/`（`test.png` / `lxns.png`），整目录已 ignore。
- **默认验证真实数据**：用户未明确要求固定夹具、离线测试或仅跑单测时，涉及数据源、素材或端到端流程的改动必须执行对应真实集成测试；不能以模拟数据通过代替真实验证。

示例 `.env`：

```bash
LXNS_API_PERSONAL_ACCESS_TOKEN=your_personal_token
```

## 改动时注意

**应该：**

- 领域共享类型进 `shared`，再在 database/prober 再导出
- 新数据源用 adapter，保持通用接口稳定
- 适配无法实现的通用方法抛**包级** `*NotImplementedError`，不抛适配专用错误
- **一个事实一份参数**：派生量现算或只存 summary 一类单点聚合，禁止双写（见「禁止冗余传参」）
- 改公共 API 时同步包 README、通用接口 JSDoc 与本文件中过时的描述
- **每次改动确认 `pnpm check`（及必要的 test / typecheck）通过**
- draw 展示逻辑在渲染/格式化层处理，不改 prober 字段名迁就海报
- **发现绕路实现时直接拆掉中转、改根源**，并顺手删掉已无用的 shim / 双路径
- 实现与公开入口对齐：逻辑写在真正被调用的类/函数里，而不是旁路文件再转发
- **默认按双端设计**；单端 API 在 JSDoc / README 标明例外原因
- **回退/占位/静默失败：先问用户，确认后再写**
- **通用接口 / 模型的文档只写与数据源无关的语义**；某一适配的细节只写在 `adapters/*` 与「适配示例」小节
- **公开面从包根 `index` 收窄维护**；适配 map / 快照等内部符号不 export；`private` / `@internal` 保证不进 TypeDoc

**不应该：**

- 让 `database` 依赖 `prober` 或反过来
- 让 `draw` 硬依赖完整 `MaimaiDatabase` 接口
- 在 `shared` 塞查分/曲目适配或 LXNS/水鱼 URL 与业务错误
- 用 tsc emit / composite Project References / `paths` 绕过 build-first
- 删除 tsdown 的 `fixedExtension: false` / `hash: false` 而不验证产物
- 提交 `.env`、真实 token、或大体积无关二进制
- 为“快”引入第二套并行领域模型（同一概念多套类型）
- **加只做转发的 wrapper / 双 API 兼容层 / 同构 DTO 链** 来回避改调用方
- 在 `utils` 里堆接口与半套业务（类型归 types/models，工具归纯函数）
- **无文档例外却把核心路径写成仅 Node**（顶层 `node:fs` / 无 Web 替代的原生模块）
- **未确认就加 fallback**（占位图、默认文案、吞异常、假数据、环境自动降级等）
- **把某一适配写成「默认数据源」**，或在 `ProberPlayer` / `MaimaiDatabase` 等通用接口 JSDoc 里绑定 LXNS 路径
- **在适配内自造 `unsupported()` 并用适配专用错误表示「方法未实现」**（应使用包级 `*NotImplementedError`）
- **冗余传参**：与权威字段重复的派生字段必填、同义双 API、两套平行统计
- **为测而 export 内部 helper**，或让 `private` / 未导出实现细节出现在 API 文档

## 文档索引

| 文档                                          | 内容                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `README.md`                                   | 仓库总览、开发命令、架构要点                         |
| `packages/*/README.md`                        | 各包安装、用法、错误、导出（通用接口优先，适配分节） |
| `docs/guide/*`                                | 面向使用方的说明书（非仓库内部 / 非 CI 说明）        |
| `.agents/skills/ts-library-monorepo/SKILL.md` | monorepo 工具链、适配错误、公开面/TypeDoc、冗余传参  |
| `AGENTS.md`（本文件）                         | agent 工作约定、包边界、公开面收窄与文档规则         |

消费侧端到端示例与更细 API 表若根 README 未写全，以各包 README 与 `src/index.ts` 导出为准。

```

```
