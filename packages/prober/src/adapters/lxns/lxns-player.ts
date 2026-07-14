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

/** 个人成绩列表仅下推稳定的结构化筛选；曲名仍由本地精确匹配。 */
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

/**
 * LXNS 个人令牌绑定的玩家。
 *
 * 个人 API 提供完整成绩、趋势、热力图、单谱历史与排行，但没有开发者 API 的 Recent 50。
 */
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
    return this.http.get<PlayerProfile>("player");
  }

  async getBests(): Promise<Bests>;
  async getBests(query: SongScoreQuery): Promise<Score[]>;
  async getBests(query?: SongScoreQuery): Promise<Bests | Score[]> {
    return this.http.get<Bests | Score[]>(
      "player/bests",
      query ? scoreSearchParams(query) : undefined,
    );
  }

  async getScores(query?: ScoreQuery): Promise<Score[]> {
    const scores = await this.http.get<Score[]>(
      "player/scores",
      query ? scoreListSearchParams(query) : undefined,
    );
    return filterScores(scores, query);
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

  async getScoreRanking(key: ScoreKey): Promise<ScoreRankingEntry[]> {
    return this.http.get<ScoreRankingEntry[]>("player/score/ranking", scoreSearchParams(key));
  }

  async getCollections(type: CollectionType): Promise<Collection[]> {
    const paths: Record<CollectionType, string> = {
      trophy: "trophies",
      icon: "icons",
      plate: "plates",
      frame: "frames",
    };
    return this.http.get<Collection[]>(`player/${paths[type]}`);
  }

  async getCollectionProgress(type: CollectionType, id: number): Promise<Collection> {
    return this.http.get<Collection>(`player/${type}/${id}`);
  }

  async exportScores(format = "csv"): Promise<Uint8Array> {
    return this.http.getBytes(`player/scores/export/${encodeURIComponent(format)}`);
  }

  async getYearInReview(year: number, options?: { agree?: boolean }): Promise<LxnsYearInReview> {
    return this.http.get<LxnsYearInReview>(`player/year-in-review/${year}`, options);
  }
}
