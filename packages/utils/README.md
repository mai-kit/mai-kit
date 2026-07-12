# @mai-kit/utils

maimai 领域纯函数，支持 Node 和浏览器，不包含网络请求或数据源适配。

常用公式从包根导入；判定明细和谱面索引分别从两个子入口导入。

## 安装

```bash
pnpm add @mai-kit/utils
```

## 公共入口

| 导入路径                   | 内容                                 |
| -------------------------- | ------------------------------------ |
| `@mai-kit/utils`           | 常用稳定公式                         |
| `@mai-kit/utils/judgement` | 完整判定类型、规范化、常量与判定计分 |
| `@mai-kit/utils/song`      | 谱面查找、稳定 key、曲目数据索引     |

没有导出的源码模块属于包内实现，不构成公共 API，也不提供 `internal` 子入口。

## API 分类

| 主题       | 主要函数                                                           | 说明                       |
| ---------- | ------------------------------------------------------------------ | -------------------------- |
| DX Rating  | `calculateDxRating` / `dxRatingCoefficient` / `requiredLevelValue` | 单曲 Rating 计算与反推定数 |
| 评级       | `rateFromAchievement` / `minimumAchievementForRate`                | 达成率 ↔ SSS+ / SSS / …    |
| DX 分      | `dxMaxFromNoteTotal` / `dxScorePercentage` / `dxStarFromScore`     | 满分、百分比与 0–5 星      |
| 判定明细   | `calculateAchievement` / `calculateChartDxScore`                   | 包根提供的常用成绩计算     |
| 判定工具   | `calculateDxScore` / `normalizeChartJudgements`                    | 从 `judgement` 子入口导入  |
| Note       | `noteTotalFromCounts` / `dxMaxFromNoteCounts`                      | 从 `judgement` 子入口导入  |
| 单 Note    | `calculateSingleNotePenaltyPercent`                                | 从 `judgement` 子入口导入  |
| 达成率归一 | `normalizeAchievement`                                             | 万分位 / 百分数归一        |
| key        | `scoreMapKey` / `chartMapKey`                                      | 从 `song` 子入口导入       |
| 定数       | `parseLevelString`                                                 | `"14+"` → `14.7`           |
| 曲目       | `findSongDifficulty` / `buildSongDxMaxMap` / `buildSongLevelMap`   | 从 `song` 子入口导入       |

## 职责范围

- **只放纯函数**（输入 → 输出，无 I/O）
- **不放**领域模型定义（见 `@mai-kit/shared` / prober）
- **不放**查分 / 静态数据适配器
- **不放**随机成绩、GLPK/WASM 反推等非确定性或重依赖能力
- 海报场景下 **填 `dx_max` 是 `@mai-kit/draw` 的职责**（内部调本包），调用方不必自己拼 map

## 示例

```ts
import {
  calculateDxRating,
  dxStarFromScore,
  dxMaxFromNoteTotal,
  normalizeAchievement,
  rateFromAchievement,
} from "@mai-kit/utils";
import { scoreMapKey } from "@mai-kit/utils/song";

dxMaxFromNoteTotal(761); // 2283
normalizeAchievement(1_008_621); // 100.8621
scoreMapKey({ id: 1, type: "dx", level_index: 3 }); // "1:dx:3"
calculateDxRating(14, 100.5); // 315
rateFromAchievement(100.5); // "sssp"
dxStarFromScore(1593, 1722); // 2
```

### 判定明细

```ts
import { calculateAchievement, calculateChartDxScore } from "@mai-kit/utils";

const achievement = calculateAchievement(
  { tap: 676, hold: 102, slide: 82, touch: 116, break: 35 },
  judgements,
);

const { dxScore, dxMax } = calculateChartDxScore(judgements);
```

规范化不完整判定或计算单 Note 扣分时，从 `judgement` 导入：

```ts
import {
  calculateSingleNotePenaltyPercent,
  normalizeChartJudgements,
} from "@mai-kit/utils/judgement";

const normalized = normalizeChartJudgements({ tap: { perfect: 2 } });
const penalties = calculateSingleNotePenaltyPercent({ tap: 500, break: 10 });
```

普通 Note 判定使用 `criticalPerfect / perfect / great / good / miss`；Break 额外细分为
`perfect-1 / perfect-2 / great-1 / great-2 / great-3`。所有判定数必须是非负整数，缺省字段
由显式 `normalize*` API 补为 0。

`parseLevelString` 解析失败返回 `undefined`；`scoreMapKey` 要求完整的谱面类型和难度索引，
utils 不替调用方生成默认定数或不完整 key。
