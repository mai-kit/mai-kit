# 快速开始

下面用 LXNS 获取玩家成绩和游戏数据，再生成一张成绩海报。各包也可以独立使用，例如只安装
`@mai-kit/utils` 计算 Rating。

## 安装

```bash
pnpm add @mai-kit/prober @mai-kit/database @mai-kit/draw
```

只做达成率、Rating 或 DX 分计算时，安装：

```bash
pnpm add @mai-kit/utils
```

需要检查混合判定或计算已有失误后的剩余容错时，安装：

```bash
pnpm add @mai-kit/judgement-solver
```

需要根据达成率、DX 分和判定总数反推一组完整判定时，安装 GPL-3.0-only 的可选包：

```bash
pnpm add @mai-kit/judgement-inference
```

需要重算 Best50、排列升分候选或比较成绩快照时，安装：

```bash
pnpm add @mai-kit/analysis
```

npm / yarn / bun 同理。

## 查成绩并生成海报

查分服务和游戏数据源都通过适配器接入。示例使用 LXNS，换用其他适配时，draw 的调用方式不变。

请先申请 [落雪查分器（LXNS）](https://maimai.lxns.net/) 访问令牌，并通过环境变量传入；不要把令牌写进代码仓库。

```ts
import { createLxnsClient } from "@mai-kit/prober";
import { LxnsMaimaiDatabase } from "@mai-kit/database";
import { Draw } from "@mai-kit/draw";
import { writeFileSync } from "node:fs";

// 查询自己的档案与 Best50
const me = createLxnsClient({
  personalAccessToken: process.env.LXNS_API_PERSONAL_ACCESS_TOKEN!,
}).me();

const [profile, bests] = await Promise.all([me.getProfile(), me.getBests()]);

// 使用 LXNS 公开数据补充曲目、素材和谱面标签
const draw = new Draw({
  database: new LxnsMaimaiDatabase(),
});

// 一种图一个方法，返回 PNG 字节
const poster = await draw.poster(profile, bests);
writeFileSync("poster.png", poster);
```

其他适配返回同样的 `profile` / `bests` 结构；数据源满足 draw 所需的素材与标签接口后，
可以直接替换示例中的 LXNS 实现。

### 可选版式

`Draw` 上 **一种图一个方法**（成对 `*Svg` 出矢量图），共用 16:9 主题与末位 `RenderOptions`：

想先看实际输出可打开 [Draw 渲染预览](./draw-preview)，其中包含完整海报、Best50、单曲卡和
加分推荐板的真实渲染结果。

| 方法                           | 说明                                   |
| ------------------------------ | -------------------------------------- |
| `poster`                       | 完整成绩海报（需档案 + Best50 + 标签） |
| `best15` / `best35` / `best50` | 曲目板（署名 + `Bests`，内部只切割）   |
| `chart`                        | 单曲成绩卡                             |
| `upgrades`                     | 加分推荐板                             |

```ts
const player = { name: profile.name, rating: profile.rating };
const opts = { scale: 1, footerLeft: "my-app" };

await draw.best15(player, bests, opts);
await draw.chart(scoreChart, opts);

// 加分板：全曲 getScores() + 定数 → rankUpgradeCandidates（勿仅 B50）
await draw.upgrades({ candidates }, opts);
```

需要矢量图时：

```ts
const svg = await draw.posterSvg(profile, bests, opts);
```

### 渲染选项 `RenderOptions`

各方法最后一参可选，字段如下：

| 字段            | 默认         | 说明                                             |
| --------------- | ------------ | ------------------------------------------------ |
| `scale`         | `2`          | 相对 1920×1080 的倍率（`2` → 约 3840×2160）      |
| `fonts`         | 包内默认字体 | 自定义 satori 字体表                             |
| `footerLeft`    | 无           | 左下页脚；与 `footerRight` 都不传则不画页脚      |
| `footerRight`   | 无           | 右下页脚                                         |
| `assetFallback` | `"error"`    | 封面/头像失败抛错；设 `"placeholder"` 则用占位图 |

Best 板的署名为**第一位置参数**；单曲卡不展示玩家信息。

### 用 LXNS 开发者令牌查别人

```ts
const client = createLxnsClient({
  devAccessToken: process.env.LXNS_API_DEV_ACCESS_TOKEN!,
});
const player = client.getPlayer(friendCode);
const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
```

取得 `profile` 和 `bests` 后，沿用上面的 `draw.poster(profile, bests)` 等代码。

## 相关文档

- 各包的职责和组合方式：[包与职责](./architecture)
- 类与函数细节：[API 参考](/api/)
- 第三方来源与致谢：[关于](./about)
