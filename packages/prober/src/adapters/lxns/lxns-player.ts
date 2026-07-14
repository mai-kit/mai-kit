import type {
  HeatmapCapability,
  PlayerCollectionListCapability,
  PlayerCollectionProgressCapability,
  ProberPlayer,
  RatingTrendCapability,
  ScoreHistoryCapability,
  ScoreListCapability,
  ScoreRankingCapability,
} from "../../prober-player";
import type {
  Bests,
  Collection,
  CollectionType,
  Heatmap,
  PlayerProfile,
  RatingTrend,
  Score,
  ScoreHistory,
  ScoreKey,
  ScoreQuery,
  ScoreRankingEntry,
  SongScoreQuery,
} from "../../models";
import { assertScoreQuery, filterScores } from "../../score-query";
import { LxnsHttp, scoreSearchParams } from "./lxns-http";
import {
  bestsSchema,
  collectionListSchema,
  collectionSchema,
  heatmapSchema,
  playerProfileSchema,
  ratingTrendListSchema,
  scoreHistorySchema,
  scoreListSchema,
  scoreRankingListSchema,
  yearInReviewSchema,
} from "./schemas";

/** 个人成绩列表仅下推结构化筛选；曲名仍由本地精确匹配。 */
function scoreListSearchParams(query: ScoreQuery): Record<string, string | number> {
  assertScoreQuery(query);
  const params: Record<string, string | number> = {};
  if (query.songId !== undefined) params.song_id = query.songId;
  if (query.songType !== undefined) params.song_type = query.songType;
  if (query.levelIndex !== undefined) params.level_index = query.levelIndex;
  return params;
}

/** LXNS 年度总结；上游会按年份增加额外统计字段。 */
export interface LxnsYearInReview {
  /** 游戏标识 */
  game: string;
  /** 总结年份 */
  year: number;
  /** 总结覆盖的最新游戏版本 */
  latest_version: number;
  /** 玩家昵称 */
  player_name: string;
  /** 玩家头像 id */
  player_avatar_id: number;
  /** 年度统计的其余上游字段 */
  [key: string]: unknown;
}

/** LXNS 个人令牌绑定的玩家。 */
export interface LxnsPersonalPlayer
  extends
    ProberPlayer,
    ScoreListCapability,
    RatingTrendCapability,
    HeatmapCapability,
    ScoreHistoryCapability,
    ScoreRankingCapability,
    PlayerCollectionListCapability,
    PlayerCollectionProgressCapability {
  /** 获取 Best50。 */
  getBests(): Promise<Bests>;
  /** 按曲目 / 谱面条件获取最佳成绩。 */
  getBests(query: SongScoreQuery): Promise<Score[]>;
  /** 导出玩家成绩；默认格式为 `csv`。 */
  exportScores(format?: string): Promise<Uint8Array>;
  /** 获取指定年份的年度总结。 */
  getYearInReview(year: number, options?: { agree?: boolean }): Promise<LxnsYearInReview>;
}

/** LXNS 个人令牌路径实现。 */
export class LxnsPersonalPlayerImpl implements LxnsPersonalPlayer {
  constructor(private readonly http: LxnsHttp) {}

  async getProfile(): Promise<PlayerProfile> {
    return this.http.get("player", playerProfileSchema);
  }

  async getBests(): Promise<Bests>;
  async getBests(query: SongScoreQuery): Promise<Score[]>;
  async getBests(query?: SongScoreQuery): Promise<Bests | Score[]> {
    return query
      ? this.http.get("player/bests", scoreListSchema, scoreSearchParams(query))
      : this.http.get("player/bests", bestsSchema);
  }

  async getScores(query?: ScoreQuery): Promise<Score[]> {
    const scores = await this.http.get(
      "player/scores",
      scoreListSchema,
      query ? scoreListSearchParams(query) : undefined,
    );
    return filterScores(scores, query);
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

  async getScoreRanking(key: ScoreKey): Promise<ScoreRankingEntry[]> {
    return this.http.get("player/score/ranking", scoreRankingListSchema, scoreSearchParams(key));
  }

  async getCollections(type: CollectionType): Promise<Collection[]> {
    const paths: Record<CollectionType, string> = {
      trophy: "trophies",
      icon: "icons",
      plate: "plates",
      frame: "frames",
    };
    return this.http.get(`player/${paths[type]}`, collectionListSchema);
  }

  async getCollectionProgress(type: CollectionType, id: number): Promise<Collection> {
    return this.http.get(`player/${type}/${id}`, collectionSchema);
  }

  async exportScores(format = "csv"): Promise<Uint8Array> {
    return this.http.getBytes(`player/scores/export/${encodeURIComponent(format)}`);
  }

  async getYearInReview(year: number, options?: { agree?: boolean }): Promise<LxnsYearInReview> {
    return this.http.get(`player/year-in-review/${year}`, yearInReviewSchema, options);
  }
}
