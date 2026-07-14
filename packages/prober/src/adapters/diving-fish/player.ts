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
import { getDivingFishIsNewMap } from "./new-song-map";
import type { DivingFishQueryPlayerPayload, DivingFishRecordsPlayerPayload } from "./schemas";
import type { DivingFishPlayerQuery, DivingFishVersionScore } from "./types";

interface DivingFishPlayerData {
  profile: PlayerProfile;
  bests: Bests;
}

interface DivingFishScoresPlayerData extends DivingFishPlayerData {
  scores: Score[];
}

/** Diving-Fish 公开查询返回的玩家对象。 */
export class DivingFishPlayer<
  TData extends DivingFishPlayerData = DivingFishPlayerData,
> implements ProberPlayer {
  private dataPromise?: Promise<TData>;

  /** @param load - 懒加载档案与 Best50 */
  protected constructor(private readonly load: () => Promise<TData>) {}

  /** 由公开 `query/player` 载荷构造。 */
  static fromQueryPayload(payload: DivingFishQueryPlayerPayload): DivingFishPlayer {
    const profile = mapDivingFishProfile(payload);
    const bests = mapDivingFishBestsFromCharts(payload);
    return new DivingFishPlayer(async () => ({ profile, bests }));
  }

  async getProfile(): Promise<PlayerProfile> {
    return (await this.getData()).profile;
  }

  async getBests(): Promise<Bests> {
    return (await this.getData()).bests;
  }

  protected async getData(): Promise<TData> {
    const request = (this.dataPromise ??= this.load());
    try {
      return await request;
    } catch (error) {
      if (this.dataPromise === request) {
        this.dataPromise = undefined;
      }
      throw error;
    }
  }
}

/** Diving-Fish 完整 records 路径返回的玩家对象。 */
export class DivingFishScoresPlayer
  extends DivingFishPlayer<DivingFishScoresPlayerData>
  implements ScoreListCapability
{
  protected constructor(load: () => Promise<DivingFishScoresPlayerData>) {
    super(load);
  }

  static fromRecordsPayload(
    http: DivingFishHttp,
    payload: DivingFishRecordsPlayerPayload,
  ): DivingFishScoresPlayer {
    return new DivingFishScoresPlayer(async () => buildRecordsData(http, payload));
  }

  static fromImportToken(http: DivingFishHttp): DivingFishScoresPlayer {
    return new DivingFishScoresPlayer(async () =>
      buildRecordsData(http, await http.importRecords()),
    );
  }

  async getScores(query?: ScoreQuery): Promise<Score[]> {
    const data = await this.getData();
    return filterScores(data.scores, query);
  }
}

/** 水鱼 Developer-Token 绑定的玩家。 */
export interface DivingFishDeveloperPlayer extends ScoresProberPlayer {
  /** 只请求指定曲目的所有已上传谱面成绩。 */
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
  payload: DivingFishRecordsPlayerPayload,
): Promise<DivingFishScoresPlayerData> {
  const isNew = await getDivingFishIsNewMap(http);
  const records = payload.records;
  return {
    profile: mapDivingFishProfile(payload),
    bests: mapDivingFishBestsFromRecords(records, isNew),
    scores: records.map(mapDivingFishRecord),
  };
}
