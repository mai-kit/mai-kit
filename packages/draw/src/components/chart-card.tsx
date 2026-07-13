/**
 * 单曲成绩卡布局（16:9）。
 * 视觉对齐 B50 海报：半透明紫框 Panel、分区标签、左侧色条与柔和底色。
 */
import {
  getDxStarAssetRate,
  getDxStarBadge,
  getPlayBonusBadge,
  getRateBadge,
} from "@mai-kit/assets";
import { placeholderCover } from "../assets";
import {
  formatAchievement,
  formatChartRating,
  formatDxScore,
  formatGeneratedAt,
  formatLevelConstant,
  songTitle,
} from "../formatters";
import type { ScoreChart } from "../types";
import { Background, HeaderLine } from "./background";
import { fitText } from "./widgets";
import { font, H, W } from "./theme";

/** 单曲卡逻辑画布宽（与 B50 同为 1920）。 */
export const CHART_CARD_WIDTH = W;
/** 单曲卡逻辑画布高（与 B50 同为 1080）。 */
export const CHART_CARD_HEIGHT = H;

const PAD_X = 28;
const PAD_Y = 20;
const HEADER_H = 36;
const FOOTER_H = 22;
const CARD_PAD = 32;
const COVER = 700;

const RATE_BADGE_W = 288;
const RATE_BADGE_H = 180;
const BONUS_BADGE = 124;
const STAR = 48;
const BADGE_GAP = 8;

const styles = {
  root: {
    display: "flex",
    position: "relative",
    width: W,
    height: H,
    overflow: "hidden",
    backgroundColor: "#f7f4ff",
    fontFamily: font,
    color: "#23194d",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    width: W,
    height: H,
    paddingLeft: PAD_X,
    paddingRight: PAD_X,
    paddingTop: PAD_Y,
    paddingBottom: PAD_Y,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    height: HEADER_H,
    flexShrink: 0,
  },
  main: {
    display: "flex",
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 0,
  },
  /** 对齐海报 Panel：半透明浅紫底 + 紫边 */
  card: {
    display: "flex",
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    border: "3px solid #a78ded",
    backgroundColor: "rgba(255,255,255,.42)",
    padding: CARD_PAD,
  },
  coverWrap: {
    display: "flex",
    width: COVER,
    height: COVER,
    flexShrink: 0,
    borderRadius: 14,
    border: "4px solid #8f75dd",
    overflow: "hidden",
    backgroundColor: "#24194f",
  },
  cover: {
    width: COVER,
    height: COVER,
    objectFit: "cover",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    marginLeft: 40,
    justifyContent: "center",
    minWidth: 0,
  },
  sectionLabel: {
    display: "flex",
    fontSize: 16,
    color: "#7c62d5",
    fontWeight: 700,
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    display: "flex",
    fontSize: 62,
    fontWeight: 800,
    color: "#24194f",
    marginBottom: 12,
    lineHeight: 1.08,
  },
  metaRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  pill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "6px 16px",
    borderRadius: 6,
    backgroundColor: "#7444d7",
    color: "#fff",
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1,
    marginRight: 14,
  },
  metaText: {
    display: "flex",
    fontSize: 32,
    fontWeight: 700,
    color: "#5f4aa6",
  },
  /** 达成率区块：海报风格浅底 + 左边色条 */
  scorePanel: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    borderLeft: "4px solid #9b63f1",
    paddingLeft: 22,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 18,
    marginBottom: 18,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,.55)",
  },
  achievementBlock: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  achLabel: {
    display: "flex",
    fontSize: 15,
    color: "#5f4aa6",
    fontWeight: 700,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  ach: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    fontSize: 104,
    fontWeight: 800,
    color: "#5b3fb5",
    lineHeight: 1,
  },
  achPercent: {
    display: "flex",
    fontSize: 64,
    fontWeight: 800,
    lineHeight: 1,
    marginLeft: 8,
    paddingBottom: 6,
  },
  metricsRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 16,
  },
  ratingPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    width: 270,
    flexShrink: 0,
    borderLeft: "4px solid #ec654e",
    paddingLeft: 22,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 18,
    marginRight: 16,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,.55)",
  },
  ratingLabel: {
    display: "flex",
    fontSize: 18,
    fontWeight: 700,
    color: "#5f4aa6",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  ratingValue: {
    display: "flex",
    fontSize: 84,
    fontWeight: 800,
    color: "#ec654e",
    lineHeight: 1,
  },
  badges: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    height: BONUS_BADGE,
    flexShrink: 0,
    marginLeft: 12,
  },
  rateBadge: {
    width: RATE_BADGE_W,
    height: RATE_BADGE_H,
    objectFit: "contain",
    marginLeft: 18,
  },
  bonusBadge: {
    width: BONUS_BADGE,
    height: BONUS_BADGE,
    objectFit: "contain",
    marginRight: BADGE_GAP,
  },
  dxPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    width: 430,
    flexShrink: 0,
    borderLeft: "4px solid #8f75dd",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,.55)",
    padding: "12px 18px 12px 22px",
  },
  dxLabel: {
    display: "flex",
    fontSize: 14,
    color: "#5f4aa6",
    fontWeight: 700,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  dxRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  dxText: {
    display: "flex",
    fontSize: 36,
    fontWeight: 800,
    color: "#24194f",
    marginRight: 14,
  },
  stars: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    height: STAR,
  },
  star: {
    width: STAR,
    height: STAR,
    objectFit: "contain",
    marginRight: 6,
  },
  footer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: FOOTER_H,
    flexShrink: 0,
    marginTop: 8,
    fontSize: 15,
    fontWeight: 700,
    color: "#6b5b95",
  },
  footerSide: {
    display: "flex",
  },
} as const;

/**
 * 单曲成绩卡 JSX（16:9）。
 *
 * @remarks 稳定性：布局 API，可能随视觉设计调整。
 * @beta
 */
export function ChartCardPoster({
  chart,
  footerLeft,
  footerRight,
}: {
  chart: ScoreChart;
  footerLeft?: string;
  footerRight?: string;
}) {
  const cover = chart.coverDataUri ?? placeholderCover(chart.id, songTitle(chart));
  const title = fitText(songTitle(chart), 1000, 62);
  const rateSrc = chart.rate ? getRateBadge(chart.rate) : undefined;
  const fcSrc = chart.fc ? getPlayBonusBadge(chart.fc) : undefined;
  const fsSrc = chart.fs ? getPlayBonusBadge(chart.fs) : undefined;
  const starCount =
    chart.dx_star != null && Number.isFinite(chart.dx_star)
      ? Math.min(5, Math.floor(chart.dx_star))
      : 0;
  const starRate = getDxStarAssetRate(starCount);
  const showFooter = Boolean(footerLeft || footerRight);
  const levelText = formatLevelConstant(chart.level_value, chart.level);
  const achievement = formatAchievement(chart.achievements);
  const achievementValue = achievement.endsWith("%") ? achievement.slice(0, -1) : achievement;
  const levelLine =
    chart.level_index != null
      ? `Lv ${levelText} · ${levelIndexLabel(chart.level_index)}`
      : `Lv ${levelText}`;

  const bonusBadgeNodes = [
    fcSrc ? (
      <img
        key="fc"
        src={fcSrc}
        width={BONUS_BADGE}
        height={BONUS_BADGE}
        style={styles.bonusBadge}
      />
    ) : null,
    fsSrc ? (
      <img
        key="fs"
        src={fsSrc}
        width={BONUS_BADGE}
        height={BONUS_BADGE}
        style={styles.bonusBadge}
      />
    ) : null,
  ].filter(Boolean);

  const starNodes =
    starCount > 0 && starRate != null
      ? Array.from({ length: starCount }, (_, i) => (
          <img
            key={i}
            src={getDxStarBadge(starRate)}
            width={STAR}
            height={STAR}
            style={styles.star}
          />
        ))
      : [];

  return (
    <div style={styles.root}>
      <Background />
      <div style={styles.content}>
        <div style={styles.header}>
          <HeaderLine />
        </div>
        <div style={styles.main}>
          <div style={styles.card}>
            <div style={styles.coverWrap}>
              <img src={cover} width={COVER} height={COVER} style={styles.cover} />
            </div>
            <div style={styles.body}>
              <div style={styles.sectionLabel}>CHART SCORE</div>
              <div style={styles.title}>{title}</div>
              <div style={styles.metaRow}>
                <div style={styles.pill}>{chart.type.toUpperCase()}</div>
                <div style={styles.metaText}>{levelLine}</div>
              </div>

              <div style={styles.scorePanel}>
                <div style={styles.achievementBlock}>
                  <div style={styles.achLabel}>ACHIEVEMENT</div>
                  <div style={styles.ach}>
                    {achievementValue}
                    <span style={styles.achPercent}>%</span>
                  </div>
                </div>
                {rateSrc ? (
                  <img
                    src={rateSrc}
                    width={RATE_BADGE_W}
                    height={RATE_BADGE_H}
                    style={styles.rateBadge}
                  />
                ) : null}
              </div>

              <div style={styles.metricsRow}>
                <div style={styles.ratingPanel}>
                  <div style={styles.ratingLabel}>DX RATING</div>
                  <div style={styles.ratingValue}>{formatChartRating(chart.dx_rating)}</div>
                </div>
                <div style={styles.dxPanel}>
                  <div style={styles.dxLabel}>DX SCORE</div>
                  <div style={styles.dxRow}>
                    <div style={styles.dxText}>{formatDxScore(chart.dx_score, chart.dx_max)}</div>
                    {starNodes.length > 0 ? <div style={styles.stars}>{starNodes}</div> : null}
                  </div>
                </div>
                {bonusBadgeNodes.length > 0 ? (
                  <div style={styles.badges}>{bonusBadgeNodes}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {showFooter ? (
          <div style={styles.footer}>
            <div style={styles.footerSide}>{footerLeft ?? ""}</div>
            <div style={styles.footerSide}>{footerRight ?? formatGeneratedAt()}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function levelIndexLabel(index: number): string {
  const labels = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER"];
  return labels[index] ?? String(index);
}
