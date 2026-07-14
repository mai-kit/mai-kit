# @mai-kit/judgement-inference

根据谱面物量、目标达成率、可选 DX 分与判定总数，反推一组满足条件的完整判定分布。

> 本包使用 GPL-3.0-only 的 `glpk.js`，因此自身同样以 **GPL-3.0-only** 发布。其他
> `@mai-kit/*` 包仍为 MIT，且仓库禁止它们依赖本包；请只在最终应用、Bot 或 CLI 中按需安装。

## 安装

```bash
pnpm add @mai-kit/judgement-inference
```

## 反推一组可行判定

```ts
import { inferJudgementDistribution } from "@mai-kit/judgement-inference";
import { calculateAchievement, calculateChartDxScore } from "@mai-kit/utils";

const notes = { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 };
const judgements = await inferJudgementDistribution(notes, {
  achievement: 90,
  dxScore: 20,
  judgementCounts: { great: 5 },
});

calculateAchievement(notes, judgements); // 90
calculateChartDxScore(judgements).dxScore; // 20
```

`judgementCounts` 按全谱面汇总，不区分 Note 类型；Break 的 `perfect-1/2` 汇总为
`perfect`，`great-1/2/3` 汇总为 `great`。未传的判定类型不限制。

## 结果语义

同一成绩通常存在多组可行判定。返回值只保证：

- 每种 Note 类型判定总数与传入物量一致；
- 达成率精确回算为目标四位小数；
- 传入的 DX 分与汇总判定数量严格匹配。

它不表示玩家真实产生的原始判定，也不保证不同求解器版本选中同一组可行解。

## 精确失败与最近解

默认只求精确解，失败时抛 `JudgementInferenceNoExactSolutionError`。不会静默返回近似结果。

只有调用方明确要求时才继续求最近解：

```ts
import { JudgementInferenceNoExactSolutionError } from "@mai-kit/judgement-inference";

try {
  await inferJudgementDistribution(notes, impossibleTarget, {
    findNearestOnFailure: true,
    timeLimitMs: 2_000,
  });
} catch (error) {
  if (error instanceof JudgementInferenceNoExactSolutionError) {
    console.log(error.reason, error.nearestJudgements);
  }
}
```

“最近”使用加权绝对距离：达成率每相差 `0.0001` 计 1，DX 分每差 1 计 1，已指定的
每类汇总判定数量每差 1 计 1；距离相同时不保证固定返回哪组判定。

`timeLimitMs` 默认 10000，分别作用于精确阶段和显式最近解阶段。`provenInfeasible` 只有在
求解器明确证明无可行解时为 `true`；超时或候选回算不一致不会伪装成确定无解。

## Node 与浏览器

- Node：按需动态加载 `glpk.js/node`；底层求解同步执行，长时间求解可能阻塞事件循环。
- 浏览器：按需动态加载 `glpk.js`，其内置 Web Worker 不阻塞页面主线程。
- 两端都在返回前使用 `@mai-kit/utils` 重新计算达成率和 DX 分。
- 浏览器使用 Blob Worker；严格 CSP 需要允许 `worker-src blob:`。

## 许可证与源码

本包为 GPL-3.0-only。发布包包含 `src/`，完整对应源码与构建配置见 `SOURCE.md` 指向的仓库
版本标签。将本包打入浏览器、Node 应用或其他分发产物前，请确认下游许可证要求。
