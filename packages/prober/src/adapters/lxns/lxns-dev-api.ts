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
  SimpleScore,
} from "../../models";
import { LxnsHttp, scoreSearchParams } from "./lxns-http";
import {
  bestsSchema,
  collectionSchema,
  heatmapSchema,
  playerProfileSchema,
  ratingTrendListSchema,
  scoreHistorySchema,
  scoreListSchema,
  scoreSchema,
  simpleScoreListSchema,
} from "./schemas";

/** LXNS 开发者令牌路径：按好友码查询（本适配专属，不属于通用玩家接口）。 */
export interface LxnsDevQueries {
  /** 按好友码读取玩家档案。 */
  getPlayer(friendCode: number): Promise<PlayerProfile>;
  /** 按 QQ 号读取玩家档案。 */
  getPlayerByQQ(qq: number): Promise<PlayerProfile>;
  /** 读取指定谱面的最佳成绩。 */
  getBest(friendCode: number, key: ScoreKey): Promise<Score>;
  /** 读取玩家 Best50。 */
  getBests(friendCode: number): Promise<Bests>;
  /** 按可选谱面条件查询最佳成绩列表。 */
  getBests(friendCode: number, query: ScoreQuery): Promise<Score[]>;
  /** 读取 AP 成绩组成的 Best50。 */
  getApBests(friendCode: number): Promise<Bests>;
  /** 读取最近成绩。 */
  getRecents(friendCode: number): Promise<Score[]>;
  /** 读取所有谱面的精简最佳成绩。 */
  getAllBestScores(friendCode: number): Promise<SimpleScore[]>;
  /** 读取出勤热力图。 */
  getHeatmap(friendCode: number): Promise<Heatmap>;
  /** 读取 Rating 走势，可按版本过滤。 */
  getTrend(friendCode: number, version?: number): Promise<RatingTrend[]>;
  /** 读取指定谱面的成绩历史。 */
  getScoreHistory(friendCode: number, key: ScoreKey): Promise<ScoreHistory>;
  /** 读取玩家已获得的指定收藏品。 */
  getPlayerCollection(friendCode: number, type: CollectionType, id: number): Promise<Collection>;
}

/** dev 路径查询实现（Authorization 头，路径 maimai/player/{fc}/...） */
export class LxnsDevApi implements LxnsDevQueries {
  constructor(private readonly http: LxnsHttp) {}

  async getPlayer(friendCode: number): Promise<PlayerProfile> {
    return this.http.get(`player/${friendCode}`, playerProfileSchema);
  }

  async getPlayerByQQ(qq: number): Promise<PlayerProfile> {
    return this.http.get(`player/qq/${qq}`, playerProfileSchema);
  }

  async getBest(friendCode: number, key: ScoreKey): Promise<Score> {
    return this.http.get(`player/${friendCode}/best`, scoreSchema, scoreSearchParams(key));
  }

  async getBests(friendCode: number): Promise<Bests>;
  async getBests(friendCode: number, query: ScoreQuery): Promise<Score[]>;
  async getBests(friendCode: number, query?: ScoreQuery): Promise<Bests | Score[]> {
    const path = `player/${friendCode}/bests`;
    return query
      ? this.http.get(path, scoreListSchema, scoreSearchParams(query))
      : this.http.get(path, bestsSchema);
  }

  async getApBests(friendCode: number): Promise<Bests> {
    return this.http.get(`player/${friendCode}/bests/ap`, bestsSchema);
  }

  async getRecents(friendCode: number): Promise<Score[]> {
    return this.http.get(`player/${friendCode}/recents`, scoreListSchema);
  }

  async getAllBestScores(friendCode: number): Promise<SimpleScore[]> {
    return this.http.get(`player/${friendCode}/scores`, simpleScoreListSchema);
  }

  async getHeatmap(friendCode: number): Promise<Heatmap> {
    return this.http.get(`player/${friendCode}/heatmap`, heatmapSchema);
  }

  async getTrend(friendCode: number, version?: number): Promise<RatingTrend[]> {
    return this.http.get(`player/${friendCode}/trend`, ratingTrendListSchema, { version });
  }

  async getScoreHistory(friendCode: number, key: ScoreKey): Promise<ScoreHistory> {
    return this.http.get<ScoreHistory>(
      `player/${friendCode}/score/history`,
      scoreHistorySchema,
      scoreSearchParams(key),
    );
  }

  async getPlayerCollection(
    friendCode: number,
    type: CollectionType,
    id: number,
  ): Promise<Collection> {
    return this.http.get(`player/${friendCode}/${type}/${id}`, collectionSchema);
  }
}
