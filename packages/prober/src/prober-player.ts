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
} from "./models";

/**
 * 已绑定身份的玩家只读查询接口（与具体查分服务无关）。
 *
 * 表示「某个确定玩家」上的查询能力：方法参数中不再带玩家标识
 *（标识由适配在创建该实例时绑定）。各适配自行决定如何实现本接口。
 *
 * @example
 * ```ts
 * // player 由任意 prober 适配创建
 * const profile = await player.getProfile();
 * const bests = await player.getBests();
 * // 可交给 Draw.poster(profile, bests)
 * ```
 */
export interface ProberPlayer {
  /** 玩家档案（昵称、rating、段位、装备等） */
  getProfile(): Promise<PlayerProfile>;
  /** Best50：新曲 `dx` + 旧曲 `standard` 及合计 */
  getBests(): Promise<Bests>;
}

/** 提供全量成绩查询的玩家能力。 */
export interface ScoreListCapability {
  /** 全量（或数据源提供的）成绩列表，可按谱面字段筛选。 */
  getScores(query?: ScoreQuery): Promise<Score[]>;
}

/** 提供最近成绩查询的玩家能力。 */
export interface RecentScoresCapability {
  /** 最近成绩列表 */
  getRecents(): Promise<Score[]>;
}

/** 提供 Rating 走势查询的玩家能力。 */
export interface RatingTrendCapability {
  /** Rating 走势 */
  getTrend(version?: number): Promise<RatingTrend[]>;
}

/** 提供出勤热力图查询的玩家能力。 */
export interface HeatmapCapability {
  /** 出勤热力图 */
  getHeatmap(): Promise<Heatmap>;
}

/** 提供单谱面成绩历史查询的玩家能力。 */
export interface ScoreHistoryCapability {
  /** 单谱面成绩历史；无记录时可能为 `null` */
  getScoreHistory(key: ScoreKey): Promise<ScoreHistory>;
}

/** 提供单谱面最佳成绩查询的玩家能力。 */
export interface BestScoreCapability {
  /** 指定谱面的最佳成绩。 */
  getBest(key: ScoreKey): Promise<Score>;
}

/** 提供单谱面公开排行查询的玩家能力。 */
export interface ScoreRankingCapability {
  /** 指定谱面的公开成绩排行。 */
  getScoreRanking(key: ScoreKey): Promise<ScoreRankingEntry[]>;
}

/** 提供玩家已获得收藏品列表的能力。 */
export interface PlayerCollectionListCapability {
  /** 指定类型的已获得收藏品。 */
  getCollections(type: CollectionType): Promise<Collection[]>;
}

/** 提供单个收藏品完成进度的能力。 */
export interface PlayerCollectionProgressCapability {
  /** 指定收藏品的完成进度。 */
  getCollectionProgress(type: CollectionType, id: number): Promise<Collection>;
}

/**
 * 具备档案、Best50、全量成绩、最近成绩、走势、热力图与单谱面历史的玩家查询对象。
 * 由支持上述全部能力的适配在绑定身份后返回（与具体数据源无关）。
 */
export type FullProberPlayer = ProberPlayer &
  ScoreListCapability &
  RecentScoresCapability &
  RatingTrendCapability &
  HeatmapCapability &
  ScoreHistoryCapability;

/** 至少提供档案、Best50 与全量成绩的玩家对象。 */
export type ScoresProberPlayer = ProberPlayer & ScoreListCapability;
