import type {
  BestScoreCapability,
  HeatmapCapability,
  PlayerCollectionProgressCapability,
  ProberPlayer,
  RatingTrendCapability,
  RecentScoresCapability,
  ScoreHistoryCapability,
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
  SimpleScore,
  SongScoreQuery,
} from "../../models";
import { LxnsProberError } from "./error";
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

/** LXNS 开发者令牌绑定的玩家。 */
export interface LxnsDevPlayer
  extends
    ProberPlayer,
    BestScoreCapability,
    RecentScoresCapability,
    RatingTrendCapability,
    HeatmapCapability,
    ScoreHistoryCapability,
    PlayerCollectionProgressCapability {
  /** 获取 Best50。 */
  getBests(): Promise<Bests>;
  /** 按曲目 / 谱面条件获取最佳成绩。 */
  getBests(query: SongScoreQuery): Promise<Score[]>;
  /** 获取 All Perfect 50。 */
  getApBests(): Promise<Bests>;
  /** 获取所有谱面的精简最佳成绩。 */
  getSimpleScores(): Promise<SimpleScore[]>;
}

/** LXNS 开发者令牌路径：先绑定玩家，再调用玩家能力。 */
export interface LxnsDevClient {
  /** 按好友码绑定玩家；不立即发起请求。 */
  getPlayer(friendCode: number): LxnsDevPlayer;
  /** 按 QQ 号查询并绑定玩家。 */
  getPlayerByQQ(qq: number): Promise<LxnsDevPlayer>;
}

/** dev 路径客户端实现。 */
export class LxnsDevApi implements LxnsDevClient {
  constructor(private readonly http: LxnsHttp) {}

  getPlayer(friendCode: number): LxnsDevPlayer {
    return new LxnsDevPlayerImpl(this.http, friendCode);
  }

  async getPlayerByQQ(qq: number): Promise<LxnsDevPlayer> {
    const profile = await this.http.get(`player/qq/${qq}`, playerProfileSchema);
    return new LxnsDevPlayerImpl(this.http, profile);
  }
}

/** 绑定好友码后的 LXNS 开发者玩家实现。 */
class LxnsDevPlayerImpl implements LxnsDevPlayer {
  private readonly friendCode: number;
  private profilePromise?: Promise<PlayerProfile>;

  constructor(
    private readonly http: LxnsHttp,
    player: number | PlayerProfile,
  ) {
    const friendCode = typeof player === "number" ? player : player.friend_code;
    if (typeof friendCode !== "number" || !Number.isSafeInteger(friendCode)) {
      throw new LxnsProberError({
        message: "Lxns player binding requires a valid friend_code",
      });
    }
    this.friendCode = friendCode;
    if (typeof player !== "number") this.profilePromise = Promise.resolve(player);
  }

  async getProfile(): Promise<PlayerProfile> {
    const request = (this.profilePromise ??= this.http.get(
      `player/${this.friendCode}`,
      playerProfileSchema,
    ));
    try {
      return await request;
    } catch (error) {
      if (this.profilePromise === request) {
        this.profilePromise = undefined;
      }
      throw error;
    }
  }

  async getBest(key: ScoreKey): Promise<Score> {
    return this.http.get(`player/${this.friendCode}/best`, scoreSchema, scoreSearchParams(key));
  }

  async getBests(): Promise<Bests>;
  async getBests(query: SongScoreQuery): Promise<Score[]>;
  async getBests(query?: SongScoreQuery): Promise<Bests | Score[]> {
    const path = `player/${this.friendCode}/bests`;
    return query
      ? this.http.get(path, scoreListSchema, scoreSearchParams(query))
      : this.http.get(path, bestsSchema);
  }

  async getApBests(): Promise<Bests> {
    return this.http.get(`player/${this.friendCode}/bests/ap`, bestsSchema);
  }

  async getRecents(): Promise<Score[]> {
    return this.http.get(`player/${this.friendCode}/recents`, scoreListSchema);
  }

  async getSimpleScores(): Promise<SimpleScore[]> {
    return this.http.get(`player/${this.friendCode}/scores`, simpleScoreListSchema);
  }

  async getHeatmap(): Promise<Heatmap> {
    return this.http.get(`player/${this.friendCode}/heatmap`, heatmapSchema);
  }

  async getTrend(version?: number): Promise<RatingTrend[]> {
    return this.http.get(`player/${this.friendCode}/trend`, ratingTrendListSchema, { version });
  }

  async getScoreHistory(key: ScoreKey): Promise<ScoreHistory> {
    return this.http.get(
      `player/${this.friendCode}/score/history`,
      scoreHistorySchema,
      scoreSearchParams(key),
    );
  }

  async getCollectionProgress(type: CollectionType, id: number): Promise<Collection> {
    return this.http.get(`player/${this.friendCode}/${type}/${id}`, collectionSchema);
  }
}
