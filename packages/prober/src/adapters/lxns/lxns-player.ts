import type { FullProberPlayer } from "../../prober-player";
import type {
  Bests,
  Heatmap,
  PlayerProfile,
  RatingTrend,
  Score,
  ScoreHistory,
  ScoreKey,
  ScoreQuery,
} from "../../models";
import { LxnsHttp, scoreSearchParams } from "./lxns-http";
import {
  bestsSchema,
  heatmapSchema,
  playerProfileSchema,
  ratingTrendListSchema,
  scoreHistorySchema,
  scoreListSchema,
} from "./schemas";

/**
 * LXNS 个人令牌路径下的 {@link ProberPlayer} 实现（身份在构造时绑定，方法不再带好友码）。
 */
export class LxnsPersonalPlayer implements FullProberPlayer {
  constructor(private readonly http: LxnsHttp) {}

  async getProfile(): Promise<PlayerProfile> {
    return this.http.get("player", playerProfileSchema);
  }

  async getBests(): Promise<Bests> {
    return this.http.get("player/bests", bestsSchema);
  }

  async getRecents(): Promise<Score[]> {
    return this.http.get("player/recents", scoreListSchema);
  }

  async getScores(query?: ScoreQuery): Promise<Score[]> {
    return this.http.get(
      "player/scores",
      scoreListSchema,
      query ? scoreSearchParams(query) : undefined,
    );
  }

  async getTrend(version?: number): Promise<RatingTrend[]> {
    return this.http.get("player/trend", ratingTrendListSchema, { version });
  }

  async getHeatmap(): Promise<Heatmap> {
    return this.http.get("player/heatmap", heatmapSchema);
  }

  async getScoreHistory(key: ScoreKey): Promise<ScoreHistory> {
    return this.http.get("player/score/history", scoreHistorySchema, scoreSearchParams(key));
  }
}
