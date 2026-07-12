import type { Bests, Score } from "@mai-kit/prober";
import { scoreMapKey } from "@mai-kit/utils/song";
import type { RatedScore } from "./models";

/**
 * 从全量成绩重新选出新曲 B15 与旧曲 B35。
 *
 * 输入必须带可靠的 `dx_rating`；新旧曲判定由调用方显式提供，分析包不猜测当前版本。
 * 未进入 B15 / B35 的成绩按 Rating 顺序写入对应 `*_selections`。
 *
 * @param scores - 全量成绩
 * @param isNewSong - 判断一条成绩是否属于当前版本新曲
 * @returns 重算后的 Best50
 * @throws {RangeError} 任一成绩缺少合法 `dx_rating`
 *
 * @example
 * ```ts
 * const bests = recalculateBests(scores, (score) => newSongIds.has(score.id));
 * console.log(bests.dx.length, bests.standard.length);
 * ```
 */
export function recalculateBests(
  scores: readonly RatedScore[],
  isNewSong: (score: RatedScore) => boolean,
): Bests {
  for (const score of scores) assertRatedScore(score);

  const dxScores: RatedScore[] = [];
  const standardScores: RatedScore[] = [];
  const seen = new Set<string>();
  for (const score of scores) {
    const key = scoreMapKey(score);
    if (seen.has(key)) throw new RangeError(`Duplicate score key: ${key}`);
    seen.add(key);
    (isNewSong(score) ? dxScores : standardScores).push(score);
  }
  dxScores.sort(compareScores);
  standardScores.sort(compareScores);
  const dx = dxScores.slice(0, 15);
  const standard = standardScores.slice(0, 35);

  return {
    dx,
    standard,
    dx_total: sumRating(dx),
    standard_total: sumRating(standard),
    dx_selections: dxScores.slice(15),
    standard_selections: standardScores.slice(35),
  };
}

function compareScores(a: RatedScore, b: RatedScore): number {
  return (
    b.dx_rating - a.dx_rating ||
    b.achievements - a.achievements ||
    b.dx_score - a.dx_score ||
    a.id - b.id ||
    a.type.localeCompare(b.type) ||
    a.level_index - b.level_index
  );
}

function sumRating(scores: readonly RatedScore[]): number {
  return scores.reduce((sum, score) => sum + score.dx_rating, 0);
}

function assertRatedScore(score: Score): asserts score is RatedScore {
  if (score.dx_rating === undefined || !Number.isFinite(score.dx_rating) || score.dx_rating < 0) {
    throw new RangeError(`Score ${score.id} must have a non-negative finite dx_rating`);
  }
}
