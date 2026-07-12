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

## 升分候选

升分计算需要谱面精确定数。可以通过 `@mai-kit/database` 的曲目列表构造输入：

```ts
import { rankUpgradeCandidates } from "@mai-kit/analysis";

const candidates = rankUpgradeCandidates(
  [
    { score, levelValue: 14.7 },
    { score: anotherScore, levelValue: 14.5 },
  ],
  100.5,
  10,
);

for (const candidate of candidates) {
  console.log(candidate.score.song_name, candidate.gain);
}
```

`analyzeScoreUpgrade()` 用于只分析一张谱面。当前和目标 Rating 都按给定定数重新计算，
不会混用数据源可能过期的 `dx_rating`。

## 比较 B50 快照

```ts
import { compareBests } from "@mai-kit/analysis";

const result = compareBests(previousBests, currentBests);
console.log(result.totalDelta);
console.log(result.entered, result.improved, result.regressed, result.dropped);
```

同一谱面通过曲目 id、谱面类型和难度索引识别。比较输入中的 B15/B35 成绩必须包含
`dx_rating`。

## 职责范围

- 只做确定性的内存计算，不读取 token、网络或文件系统。
- 查玩家数据用 `@mai-kit/prober`；查定数和当前版本曲目用 `@mai-kit/database`。
- 单曲 Rating 公式复用 `@mai-kit/utils`，不在本包维护第二套公式。
