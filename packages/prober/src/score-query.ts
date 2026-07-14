import type { Score, ScoreQuery } from "./models";
import { ProberError } from "./error";

/** @internal 验证通用成绩筛选条件。 */
export function assertScoreQuery(query: ScoreQuery): void {
  if (query.songId !== undefined && query.songName !== undefined) {
    throw new ProberError({ message: "songId and songName cannot be used together" });
  }
}

/** @internal 在不支持服务端完整筛选的适配中统一应用成绩筛选。 */
export function filterScores(scores: readonly Score[], query?: ScoreQuery): Score[] {
  if (!query) return [...scores];
  assertScoreQuery(query);
  return scores.filter(
    (score) =>
      (query.songId === undefined || score.id === query.songId) &&
      (query.songName === undefined || score.song_name === query.songName) &&
      (query.songType === undefined || score.type === query.songType) &&
      (query.levelIndex === undefined || String(score.level_index) === String(query.levelIndex)),
  );
}
