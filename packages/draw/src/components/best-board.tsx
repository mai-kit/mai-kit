import {
  getDxStarAssetRate,
  getDxStarBadge,
  getPlayBonusBadge,
  getRateBadge,
} from "@mai-kit/assets";
import { placeholderCover } from "../assets";
import type { PosterData, ScoreChart } from "../types";
import {
  formatAchievement,
  formatChartRating,
  formatDxScore,
  formatLevelConstant,
  songTitle,
} from "../formatters";
import {
  BEST_HEIGHT,
  BEST_WIDTH,
  bestFooterH,
  bestGridGap,
  bestHeaderGap,
  bestHeaderH,
  bestOuterBottom,
  bestOuterTop,
  bestOuterX,
  bestStyles as styles,
} from "./best-board.styles";
import { fitText } from "./widgets";

/**
 * 横屏 Best 板页种，与 `PlayerDraw.render("best*")` 的三种布局对应。
 *
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export type BestPage = "best50" | "best15" | "best35";
/**
 * Best 板的逻辑画布尺寸。
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export { BEST_WIDTH, BEST_HEIGHT };

/**
 * {@link bestBoardLayout} 计算出的 Best 板网格与字号几何。
 * 所有尺寸与字号数值的单位都是逻辑像素。
 *
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export interface BestBoardLayout {
  /** 网格列数 */
  columns: number;
  /** 网格行数 */
  rows: number;
  /** 当前页种显示的成绩数 */
  count: number;
  /** 单张成绩卡宽度 */
  cardW: number;
  /** 单张成绩卡高度 */
  cardH: number;
  /** 方形封面边长 */
  cover: number;
  /** 网格间距 */
  gap: number;
  /** 网格总宽度 */
  gridW: number;
  /** 网格总高度 */
  gridH: number;
  /** 成绩卡中除封面外的信息区宽度 */
  infoW: number;
  /** 曲名区最大宽度 */
  titleMax: number;
  /** 曲名字号 */
  fontTitle: number;
  /** 达成率字号 */
  fontAch: number;
  /** 次要信息字号 */
  fontMeta: number;
  /** 等级 / 定数字号 */
  fontLevel: number;
  /** 评级徽章宽度 */
  rateW: number;
  /** 评级徽章高度 */
  rateH: number;
  /** FC / FS 徽章边长 */
  badge: number;
  /** DX 星图边长 */
  star: number;
  /** 成绩序号字号 */
  indexFont: number;
  /** B15 三列宽卡：底部信息并排，充分利用横向空间 */
  expanded: boolean;
}

/**
 * 按页种计算网格：列数整除曲目数，卡高铺满剩余高度。
 *
 * @param page - Best 板页种
 * @returns 对应页种的布局几何
 *
 * @example
 * ```ts
 * const layout = bestBoardLayout("best15");
 * console.log(layout.columns, layout.rows); // 3, 5
 * ```
 *
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export function bestBoardLayout(page: BestPage): BestBoardLayout {
  const count = page === "best15" ? 15 : page === "best35" ? 35 : 50;
  // 15→3×5、35→5×7、50→5×10：整除且 cardW 足以放下方形封面 + 信息区
  const columns = page === "best15" ? 3 : 5;
  const rows = count / columns;
  const gap = page === "best50" ? bestGridGap : 5;

  const gridW = BEST_WIDTH - bestOuterX * 2;
  const gridH =
    BEST_HEIGHT - bestOuterTop - bestHeaderH - bestHeaderGap - bestFooterH - bestOuterBottom;

  const cardW = (gridW - gap * (columns - 1)) / columns;
  const cardH = (gridH - gap * (rows - 1)) / rows;
  // 方形封面贴满卡高，maimai jacket 完整显示
  const cover = cardH;
  const infoW = cardW - cover;
  const expanded = page === "best15";
  const titleMax = Math.max(40, infoW - (expanded ? 32 : 16));

  // 独立 B15 / B35 比大海报曲卡更高，字号和徽章随卡高充分放大
  const boost = expanded ? 1.12 : 1;
  const fontTitle = clamp(Math.round(cardH * 0.16 * boost), 13, 28);
  const fontAch = clamp(Math.round(cardH * 0.21 * boost), 16, expanded ? 36 : 24);
  const fontMeta = clamp(Math.round(cardH * 0.14 * boost), 12, 22);
  const fontLevel = clamp(Math.round(cardH * 0.125 * boost), 11, 20);
  const rateW = clamp(Math.round(cardH * 0.5 * boost), 40, expanded ? 90 : 54);
  const rateH = clamp(Math.round(rateW * 0.47), 17, expanded ? 34 : 26);
  const badge = clamp(Math.round(cardH * 0.22 * boost), 16, 42);
  const star = clamp(Math.round(cardH * 0.105 * boost), 9, 16);
  const indexFont = clamp(Math.round(cardH * 0.13), 11, 18);

  return {
    columns,
    rows,
    count,
    cardW,
    cardH,
    cover,
    gap,
    gridW,
    gridH,
    infoW,
    titleMax,
    fontTitle,
    fontAch,
    fontMeta,
    fontLevel,
    rateW,
    rateH,
    badge,
    star,
    indexFont,
    expanded,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pageMeta(page: BestPage): {
  title: string;
  startIndex: number;
  slice: [number, number];
  accent: string;
} {
  if (page === "best15") {
    return { title: "新曲 B15", startIndex: 1, slice: [0, 15], accent: "#8b52df" };
  }
  if (page === "best35") {
    return { title: "旧曲 B35", startIndex: 16, slice: [15, 50], accent: "#5542aa" };
  }
  return { title: "B50 全曲", startIndex: 1, slice: [0, 50], accent: "#7048cf" };
}

/**
 * Best 板 JSX 布局，供直接组装 satori 树的高级用法。
 *
 * 常规出图请使用 {@link Draw.withPlayer} → `PlayerDraw.render("best*")`。
 *
 * @param props - 完整海报数据、页种与可选页脚
 * @returns satori 可渲染的 JSX 元素
 *
 * @example
 * ```ts
 * import { createElement } from "react";
 *
 * const element = createElement(BestBoard, { data, page: "best15" });
 * ```
 *
 * @remarks 稳定性：高级布局 API。常规出图优先使用 {@link PlayerDraw.render}。
 * @beta
 */
export function BestBoard({
  data,
  page,
  footerLeft,
  footerRight,
}: {
  /** 完整海报数据 */
  data: PosterData;
  /** 要渲染的 Best 板页种 */
  page: BestPage;
  /** 左侧页脚文案 */
  footerLeft?: string;
  /** 右侧页脚文案 */
  footerRight?: string;
}) {
  const layout = bestBoardLayout(page);
  const meta = pageMeta(page);
  const charts = data.charts.slice(meta.slice[0], meta.slice[1]);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.b50}>B50</span>
          <span style={{ ...styles.title, color: meta.accent }}>{meta.title}</span>
          <span style={{ ...styles.headerRule, backgroundColor: meta.accent }} />
        </div>
        <div style={styles.headerRight}>
          <span style={styles.playerName}>{data.player.name}</span>
          <span style={styles.rating}>RATING {data.player.rating}</span>
        </div>
      </div>

      <div
        style={{
          ...styles.grid,
          width: layout.gridW,
          height: layout.gridH,
          backgroundColor: "rgba(110, 78, 185, .13)",
          rowGap: layout.gap,
          columnGap: layout.gap,
        }}
      >
        {charts.map((chart, index) => (
          <BestSongCard
            key={`${page}-${meta.startIndex + index}-${chart.id}`}
            chart={chart}
            index={meta.startIndex + index}
            layout={layout}
          />
        ))}
      </div>

      {footerLeft || footerRight ? (
        <div style={styles.footerBar}>
          <div style={styles.footerSide}>{footerLeft ?? ""}</div>
          <div style={styles.footerSide}>{footerRight ?? ""}</div>
        </div>
      ) : null}
    </div>
  );
}

function DxStars({ dxStar, size }: { dxStar?: number; size: number }) {
  const count = dxStar != null && Number.isFinite(dxStar) ? Math.min(5, Math.floor(dxStar)) : 0;
  const rate = getDxStarAssetRate(count);
  if (count <= 0 || rate == null) return null;
  const src = getDxStarBadge(rate);
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          src={src}
          width={size}
          height={size}
          style={{ display: "flex", width: size, height: size, objectFit: "contain" }}
        />
      ))}
    </div>
  );
}

function BestSongCard({
  chart,
  index,
  layout,
}: {
  chart: ScoreChart;
  index: number;
  layout: BestBoardLayout;
}) {
  const cover = chart.coverDataUri ?? placeholderCover(index, songTitle(chart));
  const bonusCode = chart.fc ?? chart.fs;
  const {
    cardW,
    cardH,
    cover: coverSize,
    infoW,
    titleMax,
    fontTitle,
    fontAch,
    fontMeta,
    fontLevel,
    rateW,
    rateH,
    badge,
    star,
    indexFont,
    expanded,
  } = layout;

  const padX = expanded ? 16 : 10;
  const contentW = Math.max(32, infoW - padX * 2);
  const vGap = Math.max(2, Math.round(cardH * 0.03));
  const titleFitW = Math.min(titleMax, contentW);

  const rateImg = chart.rate ? (
    <img
      src={getRateBadge(chart.rate)}
      width={rateW}
      height={rateH}
      style={{
        display: "flex",
        width: rateW,
        height: rateH,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  ) : null;

  const bonusImg = chart.badgeImageUri ? (
    <img
      src={chart.badgeImageUri}
      width={badge}
      height={badge}
      style={{ display: "flex", width: badge, height: badge, objectFit: "contain", flexShrink: 0 }}
    />
  ) : bonusCode ? (
    <img
      src={getPlayBonusBadge(bonusCode)}
      width={badge}
      height={badge}
      style={{ display: "flex", width: badge, height: badge, objectFit: "contain", flexShrink: 0 }}
    />
  ) : null;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        width: cardW,
        height: cardH,
        overflow: "hidden",
        borderRadius: 6,
        backgroundColor: "#261b52",
        color: "#fff",
        boxShadow: "0 1px 0 rgba(255,255,255,.2)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: coverSize,
          height: coverSize,
          flexShrink: 0,
        }}
      >
        <img
          src={cover}
          width={coverSize}
          height={coverSize}
          style={{ width: coverSize, height: coverSize, objectFit: "cover" }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            bottom: 0,
            padding: "1px 5px",
            backgroundColor: "rgba(20,13,47,.85)",
            color: "#fff",
            fontSize: indexFont,
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          #{index}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: expanded ? "space-between" : "center",
          width: infoW,
          height: cardH,
          padding: expanded ? `16px ${padX}px` : `7px ${padX}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: contentW,
          }}
        >
          <div
            style={{
              display: "flex",
              width: titleFitW,
              fontSize: fontTitle,
              fontWeight: 700,
              color: "#f4efff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.15,
            }}
          >
            {fitText(songTitle(chart), titleFitW, fontTitle)}
          </div>
        </div>

        {/* 达成率和成绩等级徽章保持同一行，与大海报曲卡一致 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: contentW,
            gap: expanded ? 12 : 6,
            marginTop: expanded ? 0 : vGap,
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: fontAch,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {formatAchievement(chart.achievements)}
          </span>
          {rateImg}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: expanded ? "space-between" : "flex-start",
            width: contentW,
            gap: 4,
            marginTop: expanded ? 0 : vGap,
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
            <span
              style={{
                display: "flex",
                fontSize: fontMeta,
                lineHeight: 1,
                color: "#dfc7ff",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {formatDxScore(chart.dx_score, chart.dx_max)}
            </span>
            <DxStars dxStar={chart.dx_star} size={star} />
          </div>
          {expanded ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: fontLevel,
                  lineHeight: 1,
                  color: "#ffa7bb",
                  fontWeight: 800,
                }}
              >
                {formatLevelConstant(chart.level_value, chart.level)}
              </span>
              <span
                style={{
                  fontSize: fontMeta,
                  lineHeight: 1,
                  color: "#ffd56a",
                  fontWeight: 800,
                }}
              >
                {formatChartRating(chart.dx_rating)}
              </span>
              {bonusImg}
            </div>
          ) : null}
        </div>

        {!expanded ? (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: contentW,
              marginTop: vGap,
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: fontLevel,
                  lineHeight: 1,
                  color: "#ffa7bb",
                  fontWeight: 800,
                }}
              >
                {formatLevelConstant(chart.level_value, chart.level)}
              </span>
              <span
                style={{
                  fontSize: fontMeta,
                  lineHeight: 1,
                  color: "#ffd56a",
                  fontWeight: 800,
                }}
              >
                {formatChartRating(chart.dx_rating)}
              </span>
            </div>
            {bonusImg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
