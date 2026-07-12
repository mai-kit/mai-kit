import type { Collection, FCType, FSType, LevelIndex, RateType, SongType } from "@mai-kit/shared";
import type { SongMeta } from "@mai-kit/utils/song";

/* ── 素材来源（最小接口，不依赖 @mai-kit/database） ───────────────────── */

/** draw 实际需要的素材类型（@mai-kit/database `AssetType` 的子集，本地定义以解耦） */
export type DrawAssetType = "icon" | "jacket";

/**
 * 素材来源接口。只声明 draw 用到的 `getAsset`；`MaimaiDatabase`（方法更多、
 * `AssetType` 更宽）可结构化直接传入，用户亦可自定义实现。
 *
 * @example 从自己的 CDN 读取封面与头像
 * ```ts
 * const assets: AssetSource = {
 *   async getAsset(type, id) {
 *     const response = await fetch(`https://cdn.example.com/${type}/${id}.png`);
 *     if (!response.ok) throw new Error(`asset HTTP ${response.status}`);
 *     return new Uint8Array(await response.arrayBuffer());
 *   },
 * };
 * ```
 */
export interface AssetSource {
  /** 按类型与 id 读取头像或封面原始字节。 */
  getAsset(type: DrawAssetType, id: number): Promise<Uint8Array>;
}

/** draw 聚合雷达图所需的最小社区标签结构 */
export interface ChartTag {
  id: number;
  localized_name: Record<string, string>;
  group_id: number;
}

/** draw 与 database 解耦所用的最小标签来源接口 */
export interface ChartTagSource {
  /** 批量读取谱面标签；返回数组顺序必须与 `charts` 一致。 */
  getChartTags(
    charts: readonly { song_name?: string; type: SongType; level_index: LevelIndex }[],
  ): Promise<ChartTag[][]>;
}

/**
 * 曲目列表来源（可选）。与 `ChartTagSource` 常由同一 database 实现。
 * 有则 `Draw.withPlayer()` **自动**填 `dx_max` / `level_value`，调用方不必手算 map。
 */
export interface SongListSource {
  /** 读取曲目列表；`notes: true` 时应包含用于计算 `dx_max` 的物量。 */
  getSongList(query?: { notes?: boolean }): Promise<{ songs: readonly SongMeta[] }>;
}

/**
 * 玩家数据聚合来源：标签必选；曲目列表可选（有则注入物量/定数）。
 * @see DrawSource
 */
export type PosterDataSource = ChartTagSource & Partial<SongListSource>;

/**
 * `Draw` 构造时所需的完整数据源 = 素材 + 标签（+ 可选曲目列表）。
 * `@mai-kit/database` 的 `MaimaiDatabase` 可直接传入。
 */
export type DrawSource = AssetSource & PosterDataSource;

/* ── 海报数据模型 ─────────────────────────────────────────────────────── */

/**
 * 玩家档案（展示用，prober `PlayerProfile` 的结构子集）。
 *
 * 直接采用 prober 的原始字段（`course_rank` / `icon` / `upload_time`），
 * 渲染时再格式化段位徽章 / 头像 / 生成时间。prober 的完整 `PlayerProfile` 可直接赋值。
 */
export interface PlayerProfile {
  /** 海报上显示的玩家昵称 */
  name: string;
  /** 海报上显示的总 Rating */
  rating: number;
  /** 课段位 id（含 0=初学者）；有值时昵称旁显示段位徽章 */
  course_rank?: number;
  /** 阶级 id（0–25）；有值时昵称旁显示阶级徽章 */
  class_rank?: number;
  /** 头像收藏品，Draw 按 icon.id 拉取头像图 */
  icon?: Collection;
  /** 上传时间，渲染时格式化为「生成于 ...」；缺省取当前时间 */
  upload_time?: string;
  /** 已预解析的头像 data URI（覆盖 icon 拉取） */
  avatarDataUri?: string;
  /** 头像本地路径（avatarDataUri 缺省时回退） */
  avatarPath?: string;
}

/**
 * 成绩卡片（展示用，prober `Score` 的结构子集）。
 *
 * `dx_max` / `level_value` 不在 prober Score 中：由 `Draw.withPlayer()`
 * 在 source 提供曲目列表时用 `@mai-kit/utils` 计算并注入。
 *
 * @example
 * ```ts
 * import type { ScoreChart } from "@mai-kit/draw";
 * import { LevelIndex } from "@mai-kit/shared";
 *
 * const chart: ScoreChart = {
 *   id: 11451,
 *   song_name: "曲名",
 *   type: "dx",
 *   level_index: LevelIndex.MASTER,
 *   achievements: 100.5432,
 *   dx_score: 1_593,
 *   dx_max: 1_722,
 *   dx_rating: 315,
 *   rate: "sssp",
 *   fc: "ap",
 * };
 * ```
 */
export interface ScoreChart {
  /** 曲目 id，Draw 按 id 拉取 jacket 封面 */
  id: number;
  /** 曲名；缺省时使用曲目 id */
  song_name?: string;
  /** 谱面类型；标签关联必需 */
  type: SongType;
  /** 谱面难度索引；标签关联必需 */
  level_index: LevelIndex;
  /** 原始达成率（>1000 时按 /10000 归一化），渲染时格式化为 "100.8621%" */
  achievements: number;
  /** 当前 DX 分 */
  dx_score: number;
  /**
   * DX 分数满分（notes.total × 3）。有值时与 dx_score 显示为 `xxx/xxxx`；
   * 缺省只显示当前分。
   */
  dx_max?: number;
  /**
   * DX 分数星级（0–5）。渲染时与 dx_score 同一行，按星数重复绘制；
   * 不同星级档位用不同素材（1–2 / 3–4 / 5）。缺省或 0 不显示星。
   */
  dx_star?: number;
  /**
   * 单曲 Rating（prober `dx_rating`）。有值时卡片展示；
   * 缺省不显示。
   */
  dx_rating?: number;
  /** 等级文案（如 "14+"），无精确定数时的回退展示 */
  level?: string;
  /**
   * 精确定数（如 14.7）。优先于 `level` 展示；
   * 由 `Draw.withPlayer()` 在有曲目数据时注入。
   */
  level_value?: number;
  /** 评级码值，渲染时映射为 "SSS+" 等 */
  rate?: RateType;
  /** FULL COMBO 标记；无标记时为 `null` 或缺省 */
  fc?: FCType | null;
  /** FULL SYNC 标记；无标记时为 `null` 或缺省 */
  fs?: FSType | null;
  /** 已预解析的封面 data URI（覆盖 id 拉取） */
  coverDataUri?: string;
  /** 封面本地路径（coverDataUri 缺省时回退） */
  coverPath?: string;
  /** 徽章图 data URI（覆盖 fc/fs 文字徽章） */
  badgeImageUri?: string;
}

/** B50 汇总数字（海报左栏 / 个人数据用） */
export interface PosterSummary {
  /** B50 总分（新曲 + 旧曲 rating 合计） */
  b50: number;
  /** 新曲 B15 rating 合计 */
  newSongs: number;
  /** 旧曲 B35 rating 合计 */
  oldSongs: number;
  /** 平均达成率文案，如 `"100.496%"` */
  averageAchievement: string;
  /** 平均单曲 Rating */
  averageRating: number;
  /** B50 内最高 DX 分 */
  maxDxScore: number;
  /** AP+（`fc === "app"`）数量 */
  apPlus: number;
  /** SYNC DX+（`fs === "fsdp"`）数量 */
  syncDxPlus: number;
  /** 成绩条数（通常 50） */
  totalCharts: number;
}

/** 评级分布饼图一项 */
export interface RatingDistributionItem {
  label: string;
  value: number;
  color: string;
}

/** 谱面倾向雷达一项（DXRating 社区标签） */
export interface RadarItem {
  /** 标签中文名，如「扫键」 */
  label: string;
  /** 0–100 雷达半径（相对 top 标签归一） */
  value: number;
  /** 标签旁展示的原始出现次数 */
  displayValue: number;
}

/** 个人数据网格一项 */
export interface MetricItem {
  label: string;
  value: string | number;
}

/**
 * 海报 / Best 板共用的完整绘制数据。
 * 通常由 {@link Draw.withPlayer} 生成；也可自行组装后 `new PlayerDraw(data)`。
 *
 * @example
 * ```ts
 * import { PlayerDraw, type PosterData } from "@mai-kit/draw";
 * import { LevelIndex } from "@mai-kit/shared";
 *
 * const data: PosterData = {
 *   player: { name: "Player", rating: 315 },
 *   charts: [{
 *     id: 11451,
 *     type: "dx",
 *     level_index: LevelIndex.MASTER,
 *     achievements: 100.5,
 *     dx_score: 1_593,
 *   }],
 *   summary: {
 *     b50: 315,
 *     newSongs: 315,
 *     oldSongs: 0,
 *     averageAchievement: "100.500%",
 *     averageRating: 315,
 *     maxDxScore: 1_593,
 *     apPlus: 0,
 *     syncDxPlus: 0,
 *     totalCharts: 1,
 *   },
 *   ratingDistribution: [{ label: "SSS+", value: 1, color: "#ec654e" }],
 *   constantDistribution: Array.from({ length: 16 }, () => 0),
 *   radar: [
 *     { label: "扫键", value: 100, displayValue: 8 },
 *     { label: "纵连", value: 75, displayValue: 6 },
 *     { label: "体力", value: 50, displayValue: 4 },
 *   ],
 * };
 * const playerDraw = new PlayerDraw(data);
 * ```
 */
export interface PosterData {
  /** 海报顶部的玩家展示信息 */
  player: PlayerProfile;
  /** B50 合计与统计指标 */
  summary: PosterSummary;
  /** B50 成绩列表：前 15 新曲 + 后 35 旧曲 */
  charts: ScoreChart[];
  /** 评级分布饼图数据 */
  ratingDistribution: RatingDistributionItem[];
  /** 定数分布直方图桶（内部布局用） */
  constantDistribution: number[];
  /** 谱面倾向雷达图数据 */
  radar: RadarItem[];
  /** 覆盖默认个人数据网格的自定义指标 */
  personalMetrics?: MetricItem[];
}
