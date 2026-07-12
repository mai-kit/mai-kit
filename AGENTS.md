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
| 验证             | 至少 Node 测通；Web 路径避免误打包仅 Node 的静态依赖                                             |

当前例外示例（须在代码/README 可见）：

- 本地磁盘路径读图（`coverPath` 非 URL）：**仅 Node**；Web 用 data/http(s)/blob URI
- PNG 栅格引擎：Node `resvg-js` / Web `resvg-wasm`（结果都是 `Uint8Array`）

## 包地图

```
packages/
├── shared/     # 共享：MaiKitError + maimai 领域原语（SongType / RateType / …）
├── utils/      # Rating、达成率、判定、DX 分、谱面索引等纯函数；无 I/O
├── database/   # 游戏静态数据 + 素材（适配器；LXNS 公共 API，无鉴权）
├── prober/     # 查分器适配层（条件 client；personal / dev token）
├── analysis/   # Best50 重算、升分候选、成绩快照对比；纯分析
├── assets/     # 统一静态资源（徽章 PNG / 字体 / resvg wasm）
└── draw/       # 成绩海报（satori + resvg；不自带 assets/）
```

### 依赖方向（硬约束）

```
shared  ←  utils  ←  database / prober / assets
                    ↘ analysis（依赖 prober + utils）
                    ↘ draw（依赖 prober + utils + assets）
```

| 规则                  | 说明                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 禁止反向依赖          | 下层不得 import 上层（如 `shared` 不能依赖 `draw`）                                                                                      |
| `database` ↔ `prober` | **互不依赖**。静态数据 vs 玩家数据，边界清晰；draw 只通过最小结构接口连接二者                                                            |
| `draw` → `database`   | **不**把 database 当作硬依赖。draw 只声明最小 `AssetSource` / `ChartTagSource` / `SongListSource`；经注入使用                            |
| `draw` → `prober`     | 有 runtime 依赖（`Draw.withPlayer()` 消费 prober 模型）。字段尽量透传，避免中间 DTO                                                      |
| `draw` → `utils`      | `Draw.withPlayer()` 用 utils 算 `dx_max` / 定数 map；**填 dx_max 是 draw 职责**，不要丢给调用方                                          |
| `analysis`            | 依赖 prober 模型与 utils 公式；只做确定性内存分析，不请求 database / prober API                                                          |
| `utils`               | 仅纯函数；不依赖 database/prober/analysis/draw                                                                                           |
| 领域原语              | 放 `@mai-kit/shared`（`SongType` / `LevelIndex` / `FCType` / `FSType` / `RateType` / `Collection*`），database / prober 再导出，避免漂移 |

新增包或跨包引用时先核对本表，再改 `package.json`。

## 各包职责

### `@mai-kit/shared`

- `MaiKitError` / `isMaiKitError`：全仓库错误基类
- maimai 领域原语（类型 + `LevelIndex` 枚举）
- 保持精简；不放网络、不放业务适配器

### `@mai-kit/utils`

- 纯函数：DX Rating / 评级 / 判定明细 / DX 分星级 / Note 扣分 / 谱面索引等
- 代表 API：`calculateDxRating` / `calculateAchievement` / `dxStarFromScore` / `findSongDifficulty`
- 无 I/O、无适配器；包根导出常用稳定公式，高级公共入口为 `@mai-kit/utils/judgement` / `song`
- 未列入 package `exports` 的源码模块属于内部实现；不提供 `internal` 公共入口
- 海报场景下 **注入 chart.dx_max 仍由 draw 完成**（内部调 utils），用户不必拼 map

### `@mai-kit/database`

- 接口：`MaimaiDatabase`（曲目 / 别名 / 收藏品 / 素材二进制）
- 实现：`LxnsMaimaiDatabase`（公开 API + 素材 CDN）
- 可选缓存：适配器创建参数 `cache: { store, ttlMs? }`；省略即关闭
- 通用缓存接口：`DatabaseCacheStore`；内置双端 `MemoryCacheStore`（LRU）
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
- 徽章：`get*Badge` → data URI（无 codegen；top-level await 预载）
- 字体 / wasm：`getDefaultFontBuffers` / `getResvgWasmBytes`（按需，模块缓存）
- 双端一致：fs（Node `file:`）或 fetch（Web），API 无分叉
- 不适合走 database CDN 的大批量 per-id 素材（封面 / 头像等）

### `@mai-kit/draw`

- `Draw`：`new Draw({ database }).withPlayer(profile, bests)` → `PlayerDraw`
- `PlayerDraw`：`render(layout)` / `renderSvg(layout)` 产出 PNG / SVG **bytes**（双端）；落盘由调用方负责
- 版式 `DrawLayout`：`poster` | `best15` | `best35` | `best50`（不再为每版式各写一对空壳方法）
- **不自带** `assets/`；默认字体与 wasm 经 `@mai-kit/assets`
- PNG：Node `@resvg/resvg-js`，Web `@resvg/resvg-wasm` + assets 包内 wasm
- `Draw.withPlayer(profile, bests)`：prober + database 本地标签 / 曲目数据 → `PlayerDraw`（异步聚合）
- 徽章 / 字体 / wasm → `@mai-kit/assets`；封面 / 头像 → `database` / data URI

## 典型数据流

B50 海报（最常见集成路径）：

```
createLxnsClient({ personalAccessToken })
  .me()
  → getProfile() + getBests()
  → new Draw({ database }).withPlayer(profile, bests)
  → playerDraw.render("poster")
  → Uint8Array (PNG)
```

字段约定：`Score` / `PlayerProfile` 的码值字段（`rate` / `fc` / `fs` / `course_rank` / `achievements` 等）**透传到** draw 的 `ScoreChart` / `PlayerProfile`；展示格式化在渲染时完成，不要在中间层再映射一套平行结构。

## 工具链与命令

根目录 scripts（工具装在 workspace 根，子包不重复装 oxlint/tsdown/typescript）：

| 命令                             | 作用                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `pnpm install`                   | 安装依赖                                                     |
| `pnpm build`                     | 按 workspace 依赖拓扑构建所有库包                            |
| `pnpm typecheck`                 | **先 build 再**各包 `tsc --noEmit`                           |
| `pnpm test`                      | 各包 `test`（无 test 脚本的包会被 pnpm 跳过/报错视配置而定） |
| `pnpm docs:dev` / `docs:build`   | VitePress + TypeDoc 自动 API 文档                            |
| `pnpm changeset`                 | 记录待发版变更（写 `.changeset/*.md`）                       |
| `pnpm ci:version` / `ci:publish` | 发版脚本（由 Release CI 调用；本地也可）                     |
| `pnpm dev`                       | 各包 `tsdown --watch`                                        |
| `pnpm clean`                     | 清理各包构建产物                                             |
| `pnpm lint` / `lint:fix`         | oxlint                                                       |
| `pnpm format` / `format:check`   | oxfmt                                                        |
| `pnpm check`                     | format:check + lint                                          |
| `pnpm fix`                       | format + lint:fix                                            |

单包：

```bash
pnpm --filter @mai-kit/draw build
pnpm --filter @mai-kit/draw test
pnpm --filter @mai-kit/draw test:integration:lxns   # 真数据集成
```

### 架构硬规则（改工具链前必读）

1. **tsdown 独占 `dist`**；`tsc` 只 `--noEmit`，禁止让 typecheck 写出文件。
2. **不用 TS Project References**（`composite` / `references`）；跨包类型走 `exports` → 已构建的 `dist/*.d.ts`。
3. JavaScript 基线固定为 **ES2023**：base `target` / `lib` 与每包 tsdown `target` 保持一致。
4. **`moduleResolution: "bundler"`** + `module: "esnext"`；源码相对 import / export 不带扩展名。
5. tsdown 两个必要 override：`fixedExtension: false`（发布产物为 `.js` 不是 `.mjs`）、`hash: false`（稳定文件名）。删前务必 build 检查 `dist/`。
6. **不用 `paths` 指到源码**做跨包 typecheck；保持 build-first。
7. `@types/node`：base `types: ["node"]`；**使用 Node API 的子包**在自身 `devDependencies` 声明。
8. 细节与脚手架模板见 `.agents/skills/ts-library-monorepo/SKILL.md`。

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

| 合理                         | 不合理                                                 |
| ---------------------------- | ------------------------------------------------------ |
| adapter 隔离数据源           | 同包内 A 只调 B、B 只调 C 且无独立复用                 |
| `AssetSource` 收窄依赖       | 再包一层 `AssetSourceAdapter` 无行为差异               |
| `Draw.withPlayer()` 一次聚合 | `withPlayer()` → `normalize` → `toPoster` 三次同构变换 |
| 组件 / 类持有渲染逻辑        | 类空壳 + 旁路 `render.ts` 重复职责                     |

#### 4. 字段与模型：透传优先

- prober 原始字段（`rate` / `fc` / `dx_score` / `course_rank`…）**透传**到 draw；展示格式化在渲染时做。
- 不为海报再发明一套平行命名，除非语义确实不同（如可选的 `dx_max` 是注入字段，不是 prober 已有字段的改名）。

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

> 现状：draw 里仍有部分历史回退（如封面失败用占位图）。**新增或扩大**此类行为须确认；清理历史回退时也应先问用户是否保留。

### 包结构

```
packages/<name>/
├── package.json          # exports → dist；files 含 dist / README
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
- 源码相对 import / export **不带扩展名**，由 `moduleResolution: "bundler"` 与 tsdown 解析；发布产物仍是 `.js`。
- draw：入口类 `draw.ts`（无 JSX，`createElement`）；**所有 `.tsx` 布局组件放 `components/`**。

### 错误

| 包       | 错误类型              | 守卫                    |
| -------- | --------------------- | ----------------------- |
| shared   | `MaiKitError`         | `isMaiKitError`         |
| database | `MaimaiDatabaseError` | `isMaimaiDatabaseError` |
| prober   | `ProberError`         | `isProberError`         |
| draw     | `DrawError`           | `isDrawError`           |

- 新包错误 **必须** 继承 `MaiKitError`，`name` 设为类名。
- 适配器把 HTTP / 业务错误归一成**包级基类或其子类**，不把裸 `fetch` 异常抛给调用方（除非刻意透传 `cause`）。
- **适配专用错误**放在 `adapters/<name>/error.ts`，继承包级错误（如 `LxnsProberError extends ProberError`、`DivingFishDatabaseError extends MaimaiDatabaseError`），并导出 `is*` 守卫；宽捕获用包级 `is*`，区分数据源用适配 `is*`。

### 适配器模式

- **接口与模型**在包根（`MaimaiDatabase`、`ProberPlayer`、共享 `models`）；**实现**在 `adapters/<source>/`。
- LXNS / Diving-Fish 等是**当前提供的适配**，不是「默认唯一数据源」；新增源时在 `adapters/<name>/` 实现，勿泄漏专有字段进通用模型。
- **禁止**把某一适配的专有概念写进通用模型（除非该语义在领域上确实通用）。
- draw 的 `AssetSource` / `DrawAssetType` 是**故意收窄**的本地接口，不要为了“方便”改成 import `MaimaiDatabase`。

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
- 小图集素材包优先 **原样带 `assets/` + 路径解析**；不要无必要 codegen / 巨型生成物塞进 `src/`。
- 素材失败策略（draw）：单项 `getAsset` 失败回退占位，不拖垮整张海报。
- Web bundler 消费 draw/assets 时：须能解析/拷贝 `@mai-kit/assets` 的 `assets/fonts/*` 与 `assets/resvg/*.wasm`（`new URL(..., import.meta.url)`）。
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
- Workflow：`.github/workflows/release.yml`
  - 有未消费 changeset → 开/更新 Version PR
  - 合并 Version PR 后 → `pnpm run ci:publish`（`build` + `changeset publish`）
  - 权限：`id-token: write` + `contents: write` + `pull-requests: write`
- 各库包已设 `publishConfig.access: public`、`publishConfig.provenance: true`，以及 `repository`（须与真实 GitHub 仓一致）。
- 每个 `@mai-kit/*` 在 npm 包设置里配置 Trusted Publisher：`Workflow filename = release.yml`（仅文件名）。
- 单人维护：日常 `pnpm changeset` → push main → 合并 bot 的 Version PR 即可发版；也可本地 `changeset version` + `changeset publish`（本机需已登录 npm 且不适用 OIDC 时仍要 token）。

## 交付门禁（每次改动必过）

**任意实现改动结束前，必须本地确认下列检查通过；未通过不得声称完成。**

| 顺序 | 命令                             | 含义                             |
| ---- | -------------------------------- | -------------------------------- |
| 1    | `pnpm check`                     | oxfmt + oxlint（格式与静态检查） |
| 2    | 相关包 `pnpm test`               | 至少覆盖改动涉及的包             |
| 3    | 触及类型/跨包时 `pnpm typecheck` | build-first 全仓类型检查         |

- 可先 `pnpm fix` 自动修 format/lint，再 `pnpm check` 确认绿。
- 改公共 API / monorepo 结构时：**check + typecheck + 相关 test** 全绿。
- agent：改文件后**主动跑门禁**；失败则修到通过，不要留给用户发现。

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
- 改公共 API 时同步包 README、通用接口 JSDoc 与本文件中过时的描述
- **每次改动确认 `pnpm check`（及必要的 test / typecheck）通过**
- draw 展示逻辑在渲染/格式化层处理，不改 prober 字段名迁就海报
- **发现绕路实现时直接拆掉中转、改根源**，并顺手删掉已无用的 shim / 双路径
- 实现与公开入口对齐：逻辑写在真正被调用的类/函数里，而不是旁路文件再转发
- **默认按双端设计**；单端 API 在 JSDoc / README 标明例外原因
- **回退/占位/静默失败：先问用户，确认后再写**
- **通用接口 / 模型的文档只写与数据源无关的语义**；某一适配的细节只写在 `adapters/*` 与「适配示例」小节

**不应该：**

- 让 `database` 依赖 `prober` 或反过来
- 让 `draw` 硬依赖完整 `MaimaiDatabase` 接口
- 在 `shared` 塞网络客户端或 LXNS 细节
- 用 tsc emit / project references / `paths` 绕过 build-first
- 删除 tsdown 的 `fixedExtension: false` / `hash: false` 而不验证产物
- 提交 `.env`、真实 token、或大体积无关二进制
- 为“快”引入第二套并行领域模型（同一概念多套类型）
- **加只做转发的 wrapper / 双 API 兼容层 / 同构 DTO 链** 来回避改调用方
- 在 `utils` 里堆接口与半套业务（类型归 types/models，工具归纯函数）
- **无文档例外却把核心路径写成仅 Node**（顶层 `node:fs` / 无 Web 替代的原生模块）
- **未确认就加 fallback**（占位图、默认文案、吞异常、假数据、环境自动降级等）
- **把某一适配写成「默认数据源」**，或在 `ProberPlayer` / `MaimaiDatabase` 等通用接口 JSDoc 里绑定 LXNS 路径

## 文档索引

| 文档                                          | 内容                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `README.md`                                   | 仓库总览、开发命令、架构要点                         |
| `packages/*/README.md`                        | 各包安装、用法、错误、导出（通用接口优先，适配分节） |
| `docs/guide/*`                                | 面向使用方的说明书（非仓库内部 / 非 CI 说明）        |
| `.agents/skills/ts-library-monorepo/SKILL.md` | monorepo 工具链决策与脚手架模板                      |
| `AGENTS.md`（本文件）                         | agent 工作约定与包边界（含文档：通用接口 vs 适配）   |

消费侧端到端示例与更细 API 表若根 README 未写全，以各包 README 与 `src/index.ts` 导出为准。

```

```
