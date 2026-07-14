import type { ProberPlayer, ScoreListCapability, ScoresProberPlayer } from "../../prober-player";
import type { Bests, PlayerProfile, Score, ScoreQuery } from "../../models";
import { filterScores } from "../../score-query";
import type { DivingFishHttp } from "./http";
import {
  mapDivingFishBestsFromCharts,
  mapDivingFishBestsFromRecords,
  mapDivingFishProfile,
  mapDivingFishRecord,
  mapDivingFishVersionRecord,
} from "./mappers";
import { DivingFishProberError } from "./error";
import { getDivingFishIsNewMap } from "./new-song-map";
import type {
  DivingFishPlayerPayload,
  DivingFishPlayerQuery,
  DivingFishVersionScore,
} from "./types";

interface DivingFishPlayerData {
  profile: PlayerProfile;
  bests: Bests;
}

interface DivingFishScoresPlayerData extends DivingFishPlayerData {
  scores: Score[];
}

/**
 * Diving-Fish 公开查询返回的玩家对象。
 *
 * 公开 `query/player` 只保证档案与 Best50，因此类型上不暴露该数据源无法提供的成绩历史、
 * 趋势和热力图方法。
 */
export class DivingFishPlayer<
  TData extends DivingFishPlayerData = DivingFishPlayerData,
> implements ProberPlayer {
  private dataPromise?: Promise<TData>;

  /** @param load - 懒加载档案与 Best50 */
  protected constructor(private readonly load: () => Promise<TData>) {}

  /**
   * 由公开 `query/player` 载荷构造（仅 B50 charts）。
   *
   * @param payload - 含 `charts.dx` / `charts.sd` 的响应
   * @returns 只提供档案与 Best50 的玩家查询对象
   */
  static fromQueryPayload(payload: DivingFishPlayerPayload): DivingFishPlayer {
    const profile = mapDivingFishProfile(payload);
    const bests = mapDivingFishBestsFromCharts(payload);
    return new DivingFishPlayer(async () => ({ profile, bests }));
  }

  /** @returns 玩家档案 */
  async getProfile(): Promise<PlayerProfile> {
    return (await this.getData()).profile;
  }

  /** @returns Best50（新 15 + 旧 35） */
  async getBests(): Promise<Bests> {
    return (await this.getData()).bests;
  }

  /** @returns 缓存后的完整玩家载荷 */
  protected async getData(): Promise<TData> {
    this.dataPromise ??= this.load();
    return this.dataPromise;
  }
}

/** Diving-Fish 完整 records 路径返回的玩家对象，额外提供全量成绩查询。 */
export class DivingFishScoresPlayer
  extends DivingFishPlayer<DivingFishScoresPlayerData>
  implements ScoreListCapability
{
  /** @param load - 懒加载档案、Best50 与全量成绩 */
  protected constructor(load: () => Promise<DivingFishScoresPlayerData>) {
    super(load);
  }

  /**
   * 由已拿到的完整 `records` 载荷构造。
   *
   * @param http - 用于拉取 `music_data` 判断新曲
   * @param payload - 含 `records` 的响应
   * @returns 支持全量成绩查询的玩家对象
   */
  static fromRecordsPayload(
    http: DivingFishHttp,
    payload: DivingFishPlayerPayload,
  ): DivingFishScoresPlayer {
    return new DivingFishScoresPlayer(async () => buildRecordsData(http, payload));
  }

  /**
   * Import-Token 路径：首次访问时请求 `/player/records`。
   *
   * @param http - 已配置 `importToken` 的客户端
   * @returns 支持全量成绩查询的玩家对象
   */
  static fromImportToken(http: DivingFishHttp): DivingFishScoresPlayer {
    return new DivingFishScoresPlayer(async () =>
      buildRecordsData(http, await http.importRecords()),
    );
  }

  /**
   * 读取全量成绩，并在本地应用可选谱面筛选。
   *
   * @param query - 曲目 id、谱面类型或难度筛选
   * @returns 满足条件的成绩
   */
  async getScores(query?: ScoreQuery): Promise<Score[]> {
    const data = await this.getData();
    return filterScores(data.scores, query);
  }
}

/** 水鱼 Developer-Token 绑定的玩家，额外提供上游专属的按曲目和按版本查询。 */
export interface DivingFishDeveloperPlayer extends ScoresProberPlayer {
  /** 只请求指定曲目（可一次传多个 id）的所有已上传谱面成绩。 */
  getScoresBySongIds(songIds: number | readonly number[]): Promise<Score[]>;
  /** 按水鱼版本名称查询牌子范围内的已游玩成绩。 */
  getVersionScores(versions: readonly string[]): Promise<DivingFishVersionScore[]>;
}

/** Developer-Token 玩家实现。 */
export class DivingFishDeveloperPlayerImpl
  extends DivingFishScoresPlayer
  implements DivingFishDeveloperPlayer
{
  constructor(
    private readonly http: DivingFishHttp,
    private readonly query: DivingFishPlayerQuery,
  ) {
    super(async () => buildRecordsData(http, await http.devRecords(query)));
  }

  async getScoresBySongIds(songIds: number | readonly number[]): Promise<Score[]> {
    return (await this.http.devRecordsBySong(this.query, songIds)).map(mapDivingFishRecord);
  }

  async getVersionScores(versions: readonly string[]): Promise<DivingFishVersionScore[]> {
    return (await this.http.versionRecords(this.query, versions)).map(mapDivingFishVersionRecord);
  }
}

async function buildRecordsData(
  http: DivingFishHttp,
  payload: DivingFishPlayerPayload,
): Promise<DivingFishScoresPlayerData> {
  const isNew = await getDivingFishIsNewMap(http);
  if (!Array.isArray(payload.records)) {
    throw new DivingFishProberError({
      message: "Diving-Fish records response is missing records",
    });
  }
  const records = payload.records;
  return {
    profile: mapDivingFishProfile(payload),
    bests: mapDivingFishBestsFromRecords(records, isNew),
    scores: records.map(mapDivingFishRecord),
  };
}
