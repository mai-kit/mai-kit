# @mai-kit/analysis

对已经取得的玩家成绩做纯分析：重新选择 Best50、计算单谱面升分、排列升分候选，以及
比较两份 B50 快照。包内没有网络请求，Node 和浏览器行为一致。

## 安装

```bash
pnpm add @mai-kit/analysis
```

## 重算 Best50

全量成绩必须包含 `dx_rating`。当前版本新曲由调用方显式判断，analysis 不根据 id 或曲名猜测：

```ts
import { recalculateBests } from "@mai-kit/analysis";

const bests = recalculateBests(scores, (score) => newSongIds.has(score.id));
```

结果取新曲前 15、旧曲前 35；其余成绩按 Rating 排序放在 `dx_selections` 与
`standard_selections`。

## 升分 / 加分候选（抬 B15 / B35）

B50 = 新曲 Top15 + 旧曲 Top35。加分推荐必须用：

`rankBestsUpgradeCandidates(entries, { currentBests, isNewSong, minRate?, targetAchievement?, limit? })`

### 目标怎么定

| 参数                       | 含义                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `minRate: "sss"`           | 目标取该评级**最低达成率**（SSS → 100%）；结果都是「冲到至少 SSS」 |
| `minRate: "sssp"`          | 同上，SSS+ → 100.5%                                                |
| `targetAchievement: 100.5` | 直接指定目标达成率（不绑定评级档时用）                             |
| 两者都给                   | 取**较高**达成率                                                   |
| 都省略                     | 抛错（无法定义目标）                                               |

`minRate` 省略时表示**不按评级档限制**，改用自由的 `targetAchievement`。
每条结果带 `targetRate`（如 `"sssp"`），方便 UI 写「目标 SSS+」而不是裸百分比。

| 情况                         | `gain`（B50 增量）                                              |
| ---------------------------- | --------------------------------------------------------------- |
| 已在 B15/B35                 | 目标单曲 Rating − **当前**单曲 Rating（优先 `score.dx_rating`） |
| 未进榜且目标 Rating > 池地板 | 目标 Rating − **B15 第15 / B35 第35**                           |
| 目标 Rating ≤ 地板           | 不入选                                                          |

`currentBests` 必须是查分器返回的真实 B50，不能本地瞎重算。
候选池是**全曲** `getScores()`，但只有能抬榜的才会留下。

```ts
import { rankBestsUpgradeCandidates } from "@mai-kit/analysis";
import { buildSongLevelMap, scoreMapKey } from "@mai-kit/utils/song";

const [scores, bests] = await Promise.all([player.getScores(), player.getBests()]);
const { songs } = await database.getSongList();
const levelMap = buildSongLevelMap(songs);
const currentVersion = Math.max(0, ...songs.map((s) => s.version));
const songVersion = new Map(songs.map((s) => [s.id, s.version]));
const entries = scores.flatMap((score) => {
  const levelValue = levelMap.get(scoreMapKey(score));
  return levelValue == null ? [] : [{ score, levelValue }];
});

// 推荐：用评级定目标（SSS+）
const candidates = rankBestsUpgradeCandidates(entries, {
  currentBests: bests,
  isNewSong: (s) => (songVersion.get(s.id) ?? 0) === currentVersion,
  minRate: "sssp",
  limit: 10,
});
// candidates[0].targetRate === "sssp"
// candidates[0].targetAchievement === 100.5
```

- `analyzeScoreUpgrade` / `rankUpgradeCandidates`：只算单曲增量，**不要**直接当加分推荐
- `rankUpgradeCandidates` 同样支持 `{ minRate, targetAchievement, limit }`

## 比较 B50 快照

```ts
import { compareBests } from "@mai-kit/analysis";

const result = compareBests(previousBests, currentBests);
console.log(result.totalDelta);
console.log(result.entered, result.improved, result.regressed, result.dropped);
```

同一谱面通过曲目 id、谱面类型和难度索引识别。比较输入中的 B15/B35 成绩必须包含
`dx_rating`。

## Rating 构成与里程碑

```ts
import {
  recalculateBests,
  summarizeBestsRating,
  ratingGapToNextThousand,
  ratingGapToTarget,
} from "@mai-kit/analysis";

// 用全量成绩推理论 B50（须带 dx_rating + 新曲判定）
const bests = recalculateBests(allScores, (s) => newSongIds.has(s.id));

const summary = summarizeBestsRating(bests);
console.log(summary.dxTotal, summary.standardTotal, summary.dxFloor);

const to16k = ratingGapToNextThousand(summary.total);
const toCustom = ratingGapToTarget(summary.total, 16_500);
```

## 职责范围

- 只做确定性的内存计算，不读取 token、网络或文件系统。
- 查玩家数据用 `@mai-kit/prober`；查定数和当前版本曲目用 `@mai-kit/database`。
- 单曲 Rating 公式复用 `@mai-kit/utils`，不在本包维护第二套公式。
