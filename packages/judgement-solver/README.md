# @mai-kit/judgement-solver

根据谱面物量、已有判定和成绩目标计算判定预算。可检查任意混合判定是否达标、求某一种
判定还允许出现多少个，并生成曲目的完整独立容错表。

## 安装

```bash
pnpm add @mai-kit/judgement-solver
```

## 已有判定后的剩余容错

```ts
import { solveJudgementLimit } from "@mai-kit/judgement-solver";

const notes = { tap: 10, hold: 0, slide: 0, touch: 0, break: 0 };
const solution = solveJudgementLimit(
  notes,
  { noteType: "tap", judgement: "great" },
  {
    minimumAchievement: 90,
    existingJudgements: { tap: { great: 2 } },
  },
);

console.log(solution?.remainingCount); // 3
console.log(solution?.judgements.tap.great); // 5（已有 2 + 还能增加 3）
console.log(solution?.achievement); // 90
```

`existingJudgements` 是已经发生、不可改变的判定。每种 Note 类型未列出的剩余数量按
Critical Perfect 补齐；`remainingCount` 只表示还能新增多少个目标判定。

省略 `existingJudgements` 时，同一 API 就是理论单项容错查询：

```ts
const theoretical = solveJudgementLimit(
  notes,
  { noteType: "tap", judgement: "great" },
  { minimumAchievement: 90 },
);

theoretical?.remainingCount; // 5
```

## 检查多种判定组合

`evaluateJudgementPlan` 用于滑块计算器、手动判定输入和成绩边界验证。它不会寻找或修改
方案，只检查调用方给出的混合判定：

```ts
import { evaluateJudgementPlan } from "@mai-kit/judgement-solver";

const result = evaluateJudgementPlan(
  notes,
  {
    tap: { great: 3, good: 1 },
    break: { "perfect-1": 2 },
  },
  {
    minimumAchievement: 100.5,
    minimumDxScore: 2_200,
    minimumFc: "fc",
  },
);

console.log(result.satisfied);
console.log(result.violations); // achievement / dxScore / fc
console.log(result.achievement, result.dxScore, result.fc);
```

未分配的 Note 同样补为 Critical Perfect，因此可以只传已经出现的失误，也可以传完整判定表。

## 生成曲目容错表

`solveJudgementLimits` 一次返回所有普通 Note 和 Break 细分判定的独立结果：

```ts
import { solveJudgementLimits } from "@mai-kit/judgement-solver";

const limits = solveJudgementLimits(notes, {
  minimumAchievement: 100.5,
  existingJudgements: { break: { "perfect-1": 1 } },
});

const tapGreat = limits?.find(
  ({ target }) => target.noteType === "tap" && target.judgement === "great",
);
console.log(tapGreat?.remainingCount);
```

这些结果都从同一份已有判定**单独求解**，不能相加。网页展示时应写明“每行互相独立，
其他未列出 Note 按 CP 计算”。运行时目标列表也从包根导出为 `JUDGEMENT_TARGETS`，Bot 或
表单不必自行维护判定枚举。

## 谱面对比

谱面对比不需要第二套 API，分别生成两张谱面的容错表，再按 `target` 对齐即可：

```ts
const [left, right] = [leftNotes, rightNotes].map((chart) =>
  solveJudgementLimits(chart, { minimumAchievement: 100.5 }),
);
```

这样对比的是相同成绩约束下，每种判定在不同物量结构中的独立容错差异。

## FC / AP 与 DX 分约束

三个入口共用 `JudgementConstraints`：

| 字段                 | 含义                                   |
| -------------------- | -------------------------------------- |
| `minimumAchievement` | 必填；百分数或万分位整数               |
| `minimumDxScore`     | 可选；最低 DX 分                       |
| `minimumFc`          | 可选；最低 `fc` / `fcp` / `ap` / `app` |

`minimumFc` 使用 `@mai-kit/shared` 的 `FCType`：

| 值    | 最低要求                          |
| ----- | --------------------------------- |
| `fc`  | 不允许 MISS                       |
| `fcp` | 只允许 GREAT 或更高               |
| `ap`  | 只允许 PERFECT / CRITICAL PERFECT |
| `app` | 只允许 Critical Perfect           |

消费端不要机械地把原始目标拼成“AP 条件下最多能有几个 PERFECT”。当
`minimumFc: "ap"` 与 PERFECT 目标组合时，更合适的文案是“保 AP 可接受的非 CP
PERFECT 数”，并应同时展示达成率目标；只设置 AP 而不设置有意义的达成率边界，结果通常
没有分析价值。

已有判定已经违反约束时，`solveJudgementLimit` / `solveJudgementLimits` 返回 `null`；输入物量、
判定数量或约束越界时抛 `RangeError`。函数不会静默删掉已有失误或放宽目标。

## Node 与浏览器

公开 API 在 Node 和现代浏览器中完全一致：

- 纯 TypeScript，只依赖 `@mai-kit/utils` 的统一判定公式和 `@mai-kit/shared` 类型。
- 不使用文件系统、网络、Node 专用模块、原生 addon 或 WASM。
- 单项目标使用二分搜索；完整表对固定目标集合逐项求解。
- 仓库通过 Node 单测和 `pnpm test:web` 的真实 headless Chrome smoke 验证。

## 职责范围

- 负责判定组合检查、已有失误后的剩余容错和独立容错表。
- 正向达成率与 DX 分计算始终复用 `@mai-kit/utils`，不维护第二套公式。
- 不请求曲目或玩家数据；database / Bot / Web 应用负责提供物量和展示结果。
- 不根据玩家历史成绩预测水平，也不负责推荐提升 B50 的曲目。
