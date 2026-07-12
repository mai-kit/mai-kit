/**
 * @packageDocumentation
 *
 * `@mai-kit/utils/judgement` 提供完整判定类型、规范化函数、计分常量和判定计算。
 *
 * 可从物量与判定分布还原达成率和 DX 分，也可用于实现判定分析器。
 * 常用成绩公式仍从 `@mai-kit/utils` 包根导入。
 */
import { dxMaxFromNoteTotal } from "./dx-score";

/** Note 类型：tap / hold / slide / touch / break */
export type NoteType = "tap" | "hold" | "slide" | "touch" | "break";

/** 分类型物量（各 note 数） */
export interface ChartNoteCounts {
  tap: number;
  hold: number;
  slide: number;
  touch: number;
  break: number;
}

/** 普通 Note 判定计数（CP / P / Gr / Go / Mi） */
export interface NoteJudgements {
  criticalPerfect: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

/** 可缺省任意判定项的普通 Note 判定；规范化时缺项按 0 处理。 */
export type PartialNoteJudgements = Partial<NoteJudgements>;

/** Break 细分判定计数（含 perfect-1/2、great-1/2/3） */
export interface BreakJudgements {
  criticalPerfect: number;
  "perfect-1": number;
  "perfect-2": number;
  "great-1": number;
  "great-2": number;
  "great-3": number;
  good: number;
  miss: number;
}

/** 可缺省任意判定项的 Break 判定；规范化时缺项按 0 处理。 */
export type PartialBreakJudgements = Partial<BreakJudgements>;

/** 完整谱面分类型判定 */
export interface ChartJudgements {
  tap: NoteJudgements;
  hold: NoteJudgements;
  slide: NoteJudgements;
  touch: NoteJudgements;
  break: BreakJudgements;
}

/**
 * 可缺省 Note 类型和判定项的整谱判定输入。
 *
 * @example
 * ```ts
 * const judgements: PartialChartJudgements = {
 *   tap: { criticalPerfect: 420, perfect: 20, miss: 1 },
 *   break: { criticalPerfect: 8, "perfect-1": 2 },
 * };
 * ```
 */
export interface PartialChartJudgements {
  tap?: PartialNoteJudgements;
  hold?: PartialNoteJudgements;
  slide?: PartialNoteJudgements;
  touch?: PartialNoteJudgements;
  break?: PartialBreakJudgements;
}

/** 普通 Note 每种判定对总达成率造成的扣分百分点。 */
export type NotePenaltyPercent = NoteJudgements;
/** Break 每种细分判定对总达成率造成的扣分百分点。 */
export type BreakPenaltyPercent = BreakJudgements;

/** 各 note 类型下各判定相对理论值的扣分百分比表 */
export interface PenaltyDistribution {
  tap: NotePenaltyPercent;
  hold: NotePenaltyPercent;
  slide: NotePenaltyPercent;
  touch: NotePenaltyPercent;
  break: BreakPenaltyPercent;
}

/** 普通 note 基础分（tap/hold/slide/touch） */
export const NOTE_BASE_SCORES = {
  tap: 500,
  hold: 1_000,
  slide: 1_500,
  touch: 500,
} as const;

/** Break 各判定对应的基础分 */
export const BREAK_BASE_SCORES: Readonly<Record<keyof BreakJudgements, number>> = {
  criticalPerfect: 2_500,
  "perfect-1": 2_500,
  "perfect-2": 2_500,
  "great-1": 2_000,
  "great-2": 1_500,
  "great-3": 1_250,
  good: 1_000,
  miss: 0,
};

/** Break 各判定对应的奖励分 */
export const BREAK_BONUS_SCORES: Readonly<Record<keyof BreakJudgements, number>> = {
  criticalPerfect: 100,
  "perfect-1": 75,
  "perfect-2": 50,
  "great-1": 40,
  "great-2": 40,
  "great-3": 40,
  good: 30,
  miss: 0,
};

/** 普通 note 判定相对 CP 的得分率 */
export const NOTE_JUDGEMENT_RATES: Readonly<Record<keyof NoteJudgements, number>> = {
  criticalPerfect: 1,
  perfect: 1,
  great: 0.8,
  good: 0.5,
  miss: 0,
};

const NOTE_TYPES = ["tap", "hold", "slide", "touch", "break"] as const;
const NOTE_JUDGEMENTS = ["criticalPerfect", "perfect", "great", "good", "miss"] as const;
const BREAK_JUDGEMENTS = [
  "criticalPerfect",
  "perfect-1",
  "perfect-2",
  "great-1",
  "great-2",
  "great-3",
  "good",
  "miss",
] as const;

/**
 * 将单个判定数规范为非负整数；`null`/`undefined` 视为 0。
 *
 * @param value - 原始计数
 * @param label - 错误信息中的字段名
 * @returns 非负整数
 * @throws {RangeError} 非整数或负数
 */
export function normalizeJudgementCount(value: unknown, label = "judgement count"): number {
  const count = Number(value ?? 0);
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return count;
}

/**
 * 规范普通 note 判定表（缺字段补 0）。
 *
 * @param input - 部分判定；缺省视为全 0
 * @returns 完整 {@link NoteJudgements}
 * @throws {RangeError} 任一项非法
 */
export function normalizeNoteJudgements(input?: PartialNoteJudgements): NoteJudgements {
  return {
    criticalPerfect: normalizeJudgementCount(input?.criticalPerfect),
    perfect: normalizeJudgementCount(input?.perfect),
    great: normalizeJudgementCount(input?.great),
    good: normalizeJudgementCount(input?.good),
    miss: normalizeJudgementCount(input?.miss),
  };
}

/**
 * 规范 Break 细分判定表（缺字段补 0）。
 *
 * @param input - 部分 Break 判定
 * @returns 完整 {@link BreakJudgements}
 * @throws {RangeError} 任一项非法
 */
export function normalizeBreakJudgements(input?: PartialBreakJudgements): BreakJudgements {
  return {
    criticalPerfect: normalizeJudgementCount(input?.criticalPerfect),
    "perfect-1": normalizeJudgementCount(input?.["perfect-1"]),
    "perfect-2": normalizeJudgementCount(input?.["perfect-2"]),
    "great-1": normalizeJudgementCount(input?.["great-1"]),
    "great-2": normalizeJudgementCount(input?.["great-2"]),
    "great-3": normalizeJudgementCount(input?.["great-3"]),
    good: normalizeJudgementCount(input?.good),
    miss: normalizeJudgementCount(input?.miss),
  };
}

/**
 * 规范整张谱面的分类型判定（缺 note 类型补全 0 表）。
 *
 * @param input - 部分 {@link PartialChartJudgements}
 * @returns 完整 {@link ChartJudgements}
 *
 * @example
 * ```ts
 * const detail = normalizeChartJudgements({ tap: { perfect: 2 } });
 * detail.tap.miss; // 0
 * detail.break.criticalPerfect; // 0
 * ```
 */
export function normalizeChartJudgements(input?: PartialChartJudgements): ChartJudgements {
  return {
    tap: normalizeNoteJudgements(input?.tap),
    hold: normalizeNoteJudgements(input?.hold),
    slide: normalizeNoteJudgements(input?.slide),
    touch: normalizeNoteJudgements(input?.touch),
    break: normalizeBreakJudgements(input?.break),
  };
}

/**
 * 规范分类型物量（缺类型补 0）。
 *
 * @param input - 部分物量
 * @returns 完整 {@link ChartNoteCounts}
 * @throws {RangeError} 任一项非法
 */
export function normalizeChartNoteCounts(input: Partial<ChartNoteCounts>): ChartNoteCounts {
  return {
    tap: normalizeJudgementCount(input.tap, "tap count"),
    hold: normalizeJudgementCount(input.hold, "hold count"),
    slide: normalizeJudgementCount(input.slide, "slide count"),
    touch: normalizeJudgementCount(input.touch, "touch count"),
    break: normalizeJudgementCount(input.break, "break count"),
  };
}

/**
 * 由分类型物量求 Note 总数。
 *
 * @param input - 部分或完整物量
 * @returns tap+hold+slide+touch+break
 */
export function noteTotalFromCounts(input: Partial<ChartNoteCounts>): number {
  const counts = normalizeChartNoteCounts(input);
  return NOTE_TYPES.reduce((sum, type) => sum + counts[type], 0);
}

/**
 * 由完整判定明细求 Note 总数（各判定计数之和）。
 *
 * @param input - 部分谱面判定
 * @returns 全部 note 判定数合计
 */
export function noteTotalFromJudgements(input: PartialChartJudgements): number {
  const detail = normalizeChartJudgements(input);
  return (
    noteTotalFromNoteJudgements(detail.tap) +
    noteTotalFromNoteJudgements(detail.hold) +
    noteTotalFromNoteJudgements(detail.slide) +
    noteTotalFromNoteJudgements(detail.touch) +
    BREAK_JUDGEMENTS.reduce((sum, judgement) => sum + detail.break[judgement], 0)
  );
}

/**
 * 计算谱面理论最高基础分与 Break 奖励分（全 CP 时）。
 *
 * @param input - 分类型物量
 * @returns `base` 达成率基础分理论最大；`bonus` Break 奖励理论最大
 */
export function calculateMaxAchievementScores(input: Partial<ChartNoteCounts>): {
  base: number;
  bonus: number;
} {
  const counts = normalizeChartNoteCounts(input);
  const base =
    counts.tap * NOTE_BASE_SCORES.tap +
    counts.hold * NOTE_BASE_SCORES.hold +
    counts.slide * NOTE_BASE_SCORES.slide +
    counts.touch * NOTE_BASE_SCORES.touch +
    counts.break * BREAK_BASE_SCORES.criticalPerfect;
  return { base, bonus: counts.break * BREAK_BONUS_SCORES.criticalPerfect };
}

/**
 * 由谱面物量与判定明细计算四位小数达成率（百分数）。
 *
 * @param noteCounts - 分类型物量（须与判定总数一致）
 * @param judgements - 分类型判定明细
 * @returns 达成率百分数，四位小数（如 `100.5432`）
 * @throws {RangeError} 判定总数与物量总数不一致，或计数非法
 *
 * @example
 * ```ts
 * calculateAchievement(
 *   { tap: 2, break: 1 },
 *   { tap: { criticalPerfect: 2 }, break: { "perfect-1": 1 } },
 * ); // 100.75
 * ```
 */
export function calculateAchievement(
  noteCounts: Partial<ChartNoteCounts>,
  judgements: PartialChartJudgements,
): number {
  const counts = normalizeChartNoteCounts(noteCounts);
  const detail = normalizeChartJudgements(judgements);
  const expectedTotal = noteTotalFromCounts(counts);
  const actualTotal = noteTotalFromJudgements(detail);
  if (expectedTotal !== actualTotal) {
    throw new RangeError(
      `judgement total ${actualTotal} does not match chart total ${expectedTotal}`,
    );
  }

  const maximum = calculateMaxAchievementScores(counts);
  let currentBase = 0;
  let currentBonus = 0;

  for (const type of ["tap", "hold", "slide", "touch"] as const) {
    const baseScore = NOTE_BASE_SCORES[type];
    const note = detail[type];
    currentBase += NOTE_JUDGEMENTS.reduce(
      (sum, judgement) => sum + note[judgement] * NOTE_JUDGEMENT_RATES[judgement] * baseScore,
      0,
    );
  }
  currentBase += BREAK_JUDGEMENTS.reduce(
    (sum, judgement) => sum + detail.break[judgement] * BREAK_BASE_SCORES[judgement],
    0,
  );
  currentBonus += BREAK_JUDGEMENTS.reduce(
    (sum, judgement) => sum + detail.break[judgement] * BREAK_BONUS_SCORES[judgement],
    0,
  );

  const baseRate = maximum.base > 0 ? (currentBase / maximum.base) * 100 : 0;
  const bonusRate = maximum.bonus > 0 ? currentBonus / maximum.bonus : 0;
  return Math.floor((baseRate + bonusRate) * 10_000 + 0.000_001) / 10_000;
}

/**
 * 计算每种单 Note 判定相对理论满分的扣分百分比表。
 *
 * @param input - 分类型物量（决定理论 base/bonus）
 * @returns 各 note 类型 × 各判定的扣分贡献（百分数点）
 *
 * @example
 * ```ts
 * const penalty = calculateSingleNotePenaltyPercent({ tap: 500, break: 10 });
 * console.log(penalty.tap.great, penalty.break["perfect-1"]);
 * ```
 */
export function calculateSingleNotePenaltyPercent(
  input: Partial<ChartNoteCounts>,
): PenaltyDistribution {
  const maximum = calculateMaxAchievementScores(input);
  const baseRatePerScore = maximum.base > 0 ? 100 / maximum.base : 0;
  const bonusRatePerScore = maximum.bonus > 0 ? 1 / maximum.bonus : 0;
  const penalty = (lostBase: number, lostBonus: number) =>
    lostBase * baseRatePerScore + lostBonus * bonusRatePerScore;

  const normalPenalty = (baseScore: number): NotePenaltyPercent => ({
    criticalPerfect: 0,
    perfect: 0,
    great: penalty(baseScore * (1 - NOTE_JUDGEMENT_RATES.great), 0),
    good: penalty(baseScore * (1 - NOTE_JUDGEMENT_RATES.good), 0),
    miss: penalty(baseScore, 0),
  });

  const breakPenalty = Object.fromEntries(
    BREAK_JUDGEMENTS.map((judgement) => [
      judgement,
      penalty(
        BREAK_BASE_SCORES.criticalPerfect - BREAK_BASE_SCORES[judgement],
        BREAK_BONUS_SCORES.criticalPerfect - BREAK_BONUS_SCORES[judgement],
      ),
    ]),
  );

  return {
    tap: normalPenalty(NOTE_BASE_SCORES.tap),
    hold: normalPenalty(NOTE_BASE_SCORES.hold),
    slide: normalPenalty(NOTE_BASE_SCORES.slide),
    touch: normalPenalty(NOTE_BASE_SCORES.touch),
    break: {
      criticalPerfect: breakPenalty.criticalPerfect,
      "perfect-1": breakPenalty["perfect-1"],
      "perfect-2": breakPenalty["perfect-2"],
      "great-1": breakPenalty["great-1"],
      "great-2": breakPenalty["great-2"],
      "great-3": breakPenalty["great-3"],
      good: breakPenalty.good,
      miss: breakPenalty.miss,
    },
  };
}

/**
 * 由「聚合后的」普通判定（不拆 break 档）计算 DX 分与满分。
 *
 * 计分：CP×3 + P×2 + Gr×1（Go/Mi 不计）。
 *
 * @param input - 全谱面合计的 CP/P/Gr/Go/Mi 数
 * @returns `dxScore` 与 `dxMax`（按 note 总数 ×3）
 *
 * @example
 * ```ts
 * calculateDxScore({ criticalPerfect: 5, perfect: 2, great: 1, miss: 1 });
 * // { dxScore: 20, dxMax: 27 }
 * ```
 */
export function calculateDxScore(input: PartialNoteJudgements): {
  dxScore: number;
  dxMax: number;
} {
  const detail = normalizeNoteJudgements(input);
  const total = noteTotalFromNoteJudgements(detail);
  return {
    dxScore: detail.criticalPerfect * 3 + detail.perfect * 2 + detail.great,
    dxMax: dxMaxFromNoteTotal(total),
  };
}

/**
 * 由完整分类型判定明细计算 DX 分与满分。
 *
 * Break 的 perfect-1/2 计入 P，great-1/2/3 计入 Gr。
 *
 * @param input - 分类型判定
 * @returns 同 {@link calculateDxScore}
 *
 * @example
 * ```ts
 * calculateChartDxScore({
 *   tap: { criticalPerfect: 2, perfect: 1 },
 *   break: { criticalPerfect: 1, "great-1": 1 },
 * }); // { dxScore: 12, dxMax: 15 }
 * ```
 */
export function calculateChartDxScore(input: PartialChartJudgements): {
  dxScore: number;
  dxMax: number;
} {
  const detail = normalizeChartJudgements(input);
  return calculateDxScore({
    criticalPerfect:
      detail.tap.criticalPerfect +
      detail.hold.criticalPerfect +
      detail.slide.criticalPerfect +
      detail.touch.criticalPerfect +
      detail.break.criticalPerfect,
    perfect:
      detail.tap.perfect +
      detail.hold.perfect +
      detail.slide.perfect +
      detail.touch.perfect +
      detail.break["perfect-1"] +
      detail.break["perfect-2"],
    great:
      detail.tap.great +
      detail.hold.great +
      detail.slide.great +
      detail.touch.great +
      detail.break["great-1"] +
      detail.break["great-2"] +
      detail.break["great-3"],
    good:
      detail.tap.good +
      detail.hold.good +
      detail.slide.good +
      detail.touch.good +
      detail.break.good,
    miss:
      detail.tap.miss +
      detail.hold.miss +
      detail.slide.miss +
      detail.touch.miss +
      detail.break.miss,
  });
}

/**
 * 由分类型物量计算 DX 满分（先求和再 ×3）。
 *
 * @param input - 分类型物量
 * @returns 同 {@link dxMaxFromNoteTotal}(noteTotalFromCounts(input))
 */
export function dxMaxFromNoteCounts(input: Partial<ChartNoteCounts>): number {
  return dxMaxFromNoteTotal(noteTotalFromCounts(input));
}

function noteTotalFromNoteJudgements(detail: NoteJudgements): number {
  return NOTE_JUDGEMENTS.reduce((sum, judgement) => sum + detail[judgement], 0);
}
