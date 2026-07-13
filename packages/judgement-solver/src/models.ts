import type { FCType } from "@mai-kit/shared";
import type {
  BreakJudgements,
  ChartJudgements,
  NoteJudgements,
  NoteType,
  PartialChartJudgements,
} from "@mai-kit/utils/judgement";

/** 非 Break 的普通 Note 类型。 */
export type StandardNoteType = Exclude<NoteType, "break">;

/** 普通 Note 中可作为求解目标的非 Critical Perfect 判定。 */
export type StandardJudgement = Exclude<keyof NoteJudgements, "criticalPerfect">;

/** Break 中可作为求解目标的非 Critical Perfect 判定。 */
export type BreakJudgement = Exclude<keyof BreakJudgements, "criticalPerfect">;

/** 待求解的 Note 类型与判定。 */
export type JudgementTarget =
  | {
      /** 普通 Note 类型。 */
      noteType: StandardNoteType;
      /** 该类型中需要计算剩余容错的判定。 */
      judgement: StandardJudgement;
    }
  | {
      /** Break Note。 */
      noteType: "break";
      /** Break 细分判定。 */
      judgement: BreakJudgement;
    };

/** 判定方案必须满足的成绩约束。 */
export interface JudgementConstraints {
  /** 最低达成率；接受百分数或万分位整数。 */
  minimumAchievement: number;
  /** 最低 DX 分；省略时不限制 DX 分。 */
  minimumDxScore?: number;
  /** 最低 FC/AP 标记；省略时不限制连击标记。 */
  minimumFc?: FCType;
}

/** 单项目标求解选项。 */
export interface JudgementLimitOptions extends JudgementConstraints {
  /**
   * 已经发生、不可再改变的判定。每种 Note 类型未列出的剩余数量按 Critical Perfect
   * 补齐；求解结果的 `remainingCount` 是在此基础上还能新增的目标判定数。
   */
  existingJudgements?: PartialChartJudgements;
}

/** 未满足的成绩约束。 */
export type JudgementConstraintViolation = "achievement" | "dxScore" | "fc";

/** 一套完整判定方案的成绩与约束检查结果。 */
export interface JudgementPlanEvaluation {
  /** 补齐剩余 Critical Perfect 后的完整判定分布。 */
  judgements: ChartJudgements;
  /** 方案达成率。 */
  achievement: number;
  /** 方案 DX 分。 */
  dxScore: number;
  /** 谱面 DX 满分。 */
  dxMax: number;
  /** 方案对应的 FC / FC+ / AP / AP+；存在 MISS 时为 `null`。 */
  fc: FCType | null;
  /** 是否满足全部约束。 */
  satisfied: boolean;
  /** 未满足的约束；满足时为空数组。 */
  violations: JudgementConstraintViolation[];
}

/** 单项判定剩余容错求解结果。 */
export interface JudgementLimitSolution extends JudgementPlanEvaluation {
  /** 本次求解的判定。 */
  target: JudgementTarget;
  /** 在 `existingJudgements` 基础上还能新增的目标判定数量。 */
  remainingCount: number;
}
