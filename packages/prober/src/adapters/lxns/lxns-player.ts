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

/**
 * LXNS 个人令牌路径下的 {@link ProberPlayer} 实现（身份在构造时绑定，方法不再带好友码）。
 */
export class LxnsPersonalPlayer implements FullProberPlayer {
  constructor(private readonly http: LxnsHttp) {}

  async getProfile(): Promise<PlayerProfile> {
    return this.http.get<PlayerProfile>("player");
  }

  async getBests(): Promise<Bests> {
    return this.http.get<Bests>("player/bests");
  }

  async getRecents(): Promise<Score[]> {
    return this.http.get<Score[]>("player/recents");
  }

  async getScores(query?: ScoreQuery): Promise<Score[]> {
    return this.http.get<Score[]>("player/scores", query ? scoreSearchParams(query) : undefined);
  }

  async getTrend(version?: number): Promise<RatingTrend[]> {
    return this.http.get<RatingTrend[]>("player/trend", { version });
  }

  async getHeatmap(): Promise<Heatmap> {
    return this.http.get<Heatmap>("player/heatmap");
  }

  async getScoreHistory(key: ScoreKey): Promise<ScoreHistory> {
    return this.http.get<ScoreHistory>("player/score/history", scoreSearchParams(key));
  }
}
