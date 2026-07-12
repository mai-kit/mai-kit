import type { Bests, Score } from "@mai-kit/prober";
import { scoreMapKey } from "@mai-kit/utils/song";
import type { BestsChartChange, BestsComparison, BestsEntry, RatedScore } from "./models";

/**
 * 比较两份 B50 快照。
 *
 * 以 `song id + 谱面类型 + 难度` 识别同一谱面，分别列出进入、提升、下降和掉出 B50
 * 的成绩，并计算总 Rating 变化。
 *
 * @param previous - 旧 B50
 * @param current - 新 B50
 * @returns 分组后的快照差异
 * @throws {RangeError} B50 内成绩缺少合法 `dx_rating`
 *
 * @example
 * ```ts
 * const comparison = compareBests(previousBests, currentBests);
 * console.log(comparison.totalDelta, comparison.entered.length);
 * ```
 */
export function compareBests(previous: Bests, current: Bests): BestsComparison {
  const previousEntries = buildEntryMap(previous);
  const currentEntries = buildEntryMap(current);
  const entered: BestsChartChange[] = [];
  const improved: BestsChartChange[] = [];
  const regressed: BestsChartChange[] = [];
  const dropped: BestsChartChange[] = [];
  let unchangedCount = 0;

  for (const [key, currentEntry] of currentEntries) {
    const previousEntry = previousEntries.get(key);
    if (!previousEntry) {
      entered.push(changeFor(key, undefined, currentEntry));
      continue;
    }
    const change = changeFor(key, previousEntry, currentEntry);
    if (change.ratingDelta > 0 || (change.ratingDelta === 0 && change.achievementDelta > 0)) {
      improved.push(change);
    } else if (
      change.ratingDelta < 0 ||
      (change.ratingDelta === 0 && change.achievementDelta < 0)
    ) {
      regressed.push(change);
    } else {
      unchangedCount += 1;
    }
  }

  for (const [key, previousEntry] of previousEntries) {
    if (!currentEntries.has(key)) dropped.push(changeFor(key, previousEntry, undefined));
  }

  const previousTotal = totalOf(previousEntries.values());
  const currentTotal = totalOf(currentEntries.values());
  const byGain = (a: BestsChartChange, b: BestsChartChange) =>
    b.ratingDelta - a.ratingDelta || b.achievementDelta - a.achievementDelta;

  return {
    entered: entered.sort(byGain),
    improved: improved.sort(byGain),
    regressed: regressed.sort(byGain),
    dropped: dropped.sort(byGain),
    unchangedCount,
    previousTotal,
    currentTotal,
    totalDelta: currentTotal - previousTotal,
  };
}

function buildEntryMap(bests: Bests): Map<string, BestsEntry> {
  const entries = new Map<string, BestsEntry>();
  addSection(entries, bests.dx, "dx");
  addSection(entries, bests.standard, "standard");
  return entries;
}

function addSection(
  entries: Map<string, BestsEntry>,
  scores: readonly Score[],
  section: BestsEntry["section"],
): void {
  scores.forEach((score, index) => {
    if (!isRatedScore(score)) {
      throw new RangeError(`Score ${score.id} must have a non-negative finite dx_rating`);
    }
    const key = scoreMapKey(score);
    if (entries.has(key)) throw new RangeError(`Duplicate score key: ${key}`);
    entries.set(key, { score, section, rank: index + 1 });
  });
}

function isRatedScore(score: Score): score is RatedScore {
  return score.dx_rating !== undefined && Number.isFinite(score.dx_rating) && score.dx_rating >= 0;
}

function changeFor(
  key: string,
  previous: BestsEntry | undefined,
  current: BestsEntry | undefined,
): BestsChartChange {
  return {
    key,
    previous,
    current,
    ratingDelta: (current?.score.dx_rating ?? 0) - (previous?.score.dx_rating ?? 0),
    achievementDelta: (current?.score.achievements ?? 0) - (previous?.score.achievements ?? 0),
  };
}

function totalOf(entries: Iterable<BestsEntry>): number {
  let total = 0;
  for (const entry of entries) total += entry.score.dx_rating;
  return total;
}
