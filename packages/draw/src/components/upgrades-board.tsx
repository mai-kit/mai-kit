/**
 * 加分推荐板（16:9，两列网格；卡片内固定栏位对齐）。
 */
import { getRateBadge } from "@mai-kit/assets";
import { rateFromAchievement } from "@mai-kit/utils";
import { placeholderCover } from "../assets";
import {
  formatAchievement,
  formatChartRating,
  formatGeneratedAt,
  formatLevelConstant,
  formatUpgradeTargetLabel,
  songTitle,
} from "../formatters";
import type { UpgradeBoardData, UpgradeCandidate } from "../types";
import { Background, HeaderLine } from "./background";
import { fitText } from "./widgets";
import { font, H, W } from "./theme";

/** 加分板逻辑画布宽（与 B50 同为 1920）。 */
export const UPGRADES_BOARD_WIDTH = W;
/** 加分板逻辑画布高（与 B50 同为 1080）。 */
export const UPGRADES_BOARD_HEIGHT = H;

const PAD_X = 24;
const PAD_Y = 16;
const BRAND_H = 30;
const HEADER_H = 82;
const FOOTER_H = 20;
const GAP_BRAND = 6;
const GAP_HEADER = 10;
const GAP_FOOTER = 6;
const COLS = 2;
const COL_GAP = 10;
const ROW_GAP = 8;
/** 两列 × 5 行 = 10 */
const LIST_MAX = 10;
/** 固定栏位宽，保证左右列数字/增益纵向对齐 */
const RANK_W = 52;
const GAIN_W = 126;
const CARD_PAD_X = 10;
const CARD_PAD_Y = 8;
const COVER_GAP = 14;

const LIST_H = H - PAD_Y * 2 - BRAND_H - GAP_BRAND - HEADER_H - GAP_HEADER - FOOTER_H - GAP_FOOTER;
const COL_W = Math.floor((W - PAD_X * 2 - COL_GAP) / COLS);

const styles = {
  root: {
    display: "flex",
    position: "relative",
    width: W,
    height: H,
    overflow: "hidden",
    backgroundColor: "#f7f4ff",
    fontFamily: font,
    color: "#2b2148",
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
  brand: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    height: BRAND_H,
    flexShrink: 0,
    marginBottom: GAP_BRAND,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    height: HEADER_H,
    flexShrink: 0,
    marginBottom: GAP_HEADER,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  kicker: {
    display: "flex",
    fontSize: 16,
    fontWeight: 800,
    color: "#8f75dd",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: { display: "flex", fontSize: 40, fontWeight: 800, color: "#3d2d72" },
  subtitle: {
    display: "flex",
    fontSize: 19,
    fontWeight: 700,
    color: "#6b5b95",
    marginTop: 2,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    justifyContent: "flex-start",
  },
  gridRow: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
  },
  footer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: FOOTER_H,
    flexShrink: 0,
    marginTop: GAP_FOOTER,
    fontSize: 14,
    fontWeight: 700,
    color: "#6b5b95",
  },
  footerSide: { display: "flex" },
  empty: {
    display: "flex",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 800,
    color: "#8a7aad",
  },
} as const;

/**
 * 加分推荐板 JSX（16:9，两列）。
 *
 * @remarks 稳定性：布局 API，可能随视觉设计调整。
 * @beta
 */
export function UpgradesBoard({
  data,
  header,
  footerLeft,
  footerRight,
}: {
  data: UpgradeBoardData;
  header?: string;
  footerLeft?: string;
  footerRight?: string;
}) {
  const items = data.candidates.slice(0, LIST_MAX);
  const showHeader = Boolean(header);
  const showFooter = Boolean(footerLeft || footerRight);
  const first = items[0];
  const targetLabel =
    first === undefined
      ? ""
      : `${formatUpgradeTargetLabel(first.targetAchievement, first.targetRate)} · `;
  const subtitle = `${targetLabel}显示 ${items.length}/${LIST_MAX}${
    data.candidates.length > LIST_MAX ? ` · 候选共 ${data.candidates.length}` : ""
  }`;

  const columns = items.length <= 4 ? 1 : COLS;
  const rowCount = Math.max(1, Math.ceil(items.length / columns));
  const listH =
    LIST_H + (showHeader ? 0 : BRAND_H + GAP_BRAND) + (showFooter ? 0 : FOOTER_H + GAP_FOOTER);
  const cardH = (listH - ROW_GAP * (rowCount - 1)) / rowCount;
  const compact = columns === COLS;
  const cover = compact
    ? Math.min(180, Math.max(148, cardH - CARD_PAD_Y * 2))
    : Math.min(360, Math.max(180, cardH - CARD_PAD_Y * 2));
  const titleFs = compact
    ? Math.min(32, Math.max(28, Math.floor(cardH * 0.17)))
    : Math.min(48, Math.max(30, Math.floor(cardH * 0.16)));
  const metaFs = compact
    ? Math.min(20, Math.max(18, Math.floor(cardH * 0.11)))
    : Math.min(28, Math.max(20, Math.floor(cardH * 0.105)));
  const valueFs = compact
    ? Math.min(24, Math.max(22, Math.floor(cardH * 0.135)))
    : Math.min(34, Math.max(24, Math.floor(cardH * 0.125)));
  const gainFs = compact
    ? Math.min(48, Math.max(42, Math.floor(cardH * 0.25)))
    : Math.min(64, Math.max(46, Math.floor(cardH * 0.24)));
  const rankFs = compact
    ? Math.min(22, Math.max(20, Math.floor(cardH * 0.125)))
    : Math.min(28, Math.max(20, Math.floor(cardH * 0.12)));
  const badgeW = compact
    ? Math.min(92, Math.max(84, Math.floor(cardH * 0.5)))
    : Math.min(120, Math.max(84, Math.floor(cardH * 0.43)));
  const badgeH = Math.round(badgeW * 0.5);

  const gridRows: Array<[UpgradeCandidate, UpgradeCandidate?]> = [];
  for (let r = 0; r < rowCount; r += 1) {
    const left = items[r * columns];
    if (!left) continue;
    gridRows.push([left, columns === COLS ? items[r * columns + 1] : undefined]);
  }

  return (
    <div style={styles.root}>
      <Background />
      <div style={styles.content}>
        {header ? (
          <div style={styles.brand}>
            <HeaderLine text={header} />
          </div>
        ) : null}
        <div style={styles.header}>
          <div style={styles.titleBlock}>
            <div style={styles.kicker}>RATING BOOST</div>
            <div style={styles.title}>加分推荐</div>
            <div style={styles.subtitle}>{subtitle}</div>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={styles.empty}>暂无加分候选</div>
        ) : (
          <div style={styles.grid}>
            {gridRows.map((pair, r) => (
              <div
                key={r}
                style={{
                  ...styles.gridRow,
                  height: cardH,
                  marginBottom: r === rowCount - 1 ? 0 : ROW_GAP,
                }}
              >
                <UpgradeCell
                  row={pair[0]}
                  rank={r * columns + 1}
                  width={pair[1] ? COL_W : W - PAD_X * 2}
                  height={cardH}
                  cover={cover}
                  titleFs={titleFs}
                  metaFs={metaFs}
                  valueFs={valueFs}
                  gainFs={gainFs}
                  rankFs={rankFs}
                  badgeW={badgeW}
                  badgeH={badgeH}
                  marginRight={pair[1] ? COL_GAP : 0}
                />
                {pair[1] ? (
                  <UpgradeCell
                    row={pair[1]}
                    rank={r * columns + 2}
                    width={COL_W}
                    height={cardH}
                    cover={cover}
                    titleFs={titleFs}
                    metaFs={metaFs}
                    valueFs={valueFs}
                    gainFs={gainFs}
                    rankFs={rankFs}
                    badgeW={badgeW}
                    badgeH={badgeH}
                    marginRight={0}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}

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

function UpgradeCell({
  row,
  rank,
  width,
  height,
  cover: coverSize,
  titleFs,
  metaFs,
  valueFs,
  gainFs,
  rankFs,
  badgeW,
  badgeH,
  marginRight,
}: {
  row: UpgradeCandidate;
  rank: number;
  width: number;
  height: number;
  cover: number;
  titleFs: number;
  metaFs: number;
  valueFs: number;
  gainFs: number;
  rankFs: number;
  badgeW: number;
  badgeH: number;
  marginRight: number;
}) {
  const { score } = row;
  const coverSrc = score.coverDataUri ?? placeholderCover(rank, songTitle(score));
  const level = formatLevelConstant(score.level_value ?? row.levelValue, score.level);
  const meta = `${score.type.toUpperCase()} · Lv ${level}`;
  const currentAch = formatAchievement(score.achievements);
  const targetAch = formatAchievement(row.targetAchievement);
  const currentRate =
    score.rate ??
    (Number.isFinite(score.achievements) ? rateFromAchievement(score.achievements) : undefined);
  const targetRate = row.targetRate ?? rateFromAchievement(row.targetAchievement);
  const currentRateSrc = currentRate ? getRateBadge(currentRate) : undefined;
  const targetRateSrc = getRateBadge(targetRate);
  const gain = Math.floor(row.gain ?? row.targetRating - row.currentRating);
  const gainText = gain > 0 ? `+${gain}` : String(gain);
  const mainW = width - CARD_PAD_X * 2 - RANK_W - coverSize - COVER_GAP - GAIN_W;
  const titleMax = Math.max(120, mainW - 18);
  const isFirst = rank === 1;
  const isTopThree = rank <= 3;
  const labelFs = Math.max(12, Math.min(18, valueFs - 7));
  const rankChip = Math.min(52, Math.max(40, Math.floor(height * 0.26)));

  const arrow = {
    display: "flex" as const,
    fontWeight: 700,
    color: "#9a8bb8",
    marginLeft: 7,
    marginRight: 7,
    flexShrink: 0,
    fontSize: valueFs,
  };
  const dimLabel = {
    display: "flex" as const,
    width: 64,
    fontSize: labelFs,
    fontWeight: 800,
    color: "#9a8bb8",
    letterSpacing: 0.5,
    marginRight: 4,
    flexShrink: 0,
  };
  const metricRow = {
    display: "flex" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: valueFs + 6,
  };
  const targetVal = { color: "#5a3db8" as const, fontWeight: 800 as const };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width,
        height,
        marginRight,
        paddingLeft: CARD_PAD_X,
        paddingRight: CARD_PAD_X,
        paddingTop: CARD_PAD_Y,
        paddingBottom: CARD_PAD_Y,
        borderRadius: 14,
        border: isTopThree ? "3px solid #9272e5" : "2px solid #c9bcec",
        backgroundColor: isFirst
          ? "rgba(255,255,255,.78)"
          : isTopThree
            ? "rgba(255,255,255,.68)"
            : "rgba(255,255,255,.56)",
        boxSizing: "border-box",
      }}
    >
      {/* 排名 */}
      <div
        style={{
          display: "flex",
          width: RANK_W,
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            width: rankChip,
            height: rankChip,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            fontSize: rankFs,
            fontWeight: 800,
            color: isFirst ? "#ffffff" : "#6d52b8",
            backgroundColor: isFirst ? "#7444d7" : isTopThree ? "#e4dcf8" : "#efe9fb",
          }}
        >
          {String(rank).padStart(2, "0")}
        </div>
      </div>

      {/* 封面 */}
      <img
        src={coverSrc}
        width={coverSize}
        height={coverSize}
        style={{
          width: coverSize,
          height: coverSize,
          borderRadius: 12,
          objectFit: "cover",
          marginRight: COVER_GAP,
          flexShrink: 0,
        }}
      />

      {/* 主内容：曲目信息与目标对比 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: mainW,
          flexShrink: 0,
          minWidth: 0,
          paddingRight: 14,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: titleFs,
            fontWeight: 800,
            color: "#2b2148",
            marginBottom: 3,
            alignItems: "center",
            lineHeight: 1.08,
          }}
        >
          {fitText(songTitle(score), titleMax, titleFs)}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: metaFs,
            fontWeight: 700,
            color: "#7a6a9e",
            alignItems: "center",
            marginBottom: 5,
          }}
        >
          {meta}
        </div>
        <div style={metricRow}>
          <span style={dimLabel}>ACH</span>
          <span style={{ display: "flex", fontSize: valueFs, fontWeight: 800, color: "#3d2d72" }}>
            {currentAch}
          </span>
          <span style={arrow}>→</span>
          <span style={{ display: "flex", fontSize: valueFs, ...targetVal }}>{targetAch}</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            minHeight: badgeH + 2,
          }}
        >
          <div style={{ ...metricRow, marginRight: 18 }}>
            <span style={dimLabel}>RATING</span>
            <span style={{ display: "flex", fontSize: valueFs, fontWeight: 800, color: "#3d2d72" }}>
              {formatChartRating(row.currentRating)}
            </span>
            <span style={arrow}>→</span>
            <span style={{ display: "flex", fontSize: valueFs, ...targetVal }}>
              {formatChartRating(row.targetRating)}
            </span>
          </div>
          <div style={metricRow}>
            <span style={dimLabel}>RATE</span>
            {currentRateSrc ? (
              <img
                src={currentRateSrc}
                width={badgeW}
                height={badgeH}
                style={{
                  width: badgeW,
                  height: badgeH,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{ display: "flex", width: badgeW, height: badgeH, flexShrink: 0 }} />
            )}
            <span style={{ ...arrow, fontSize: Math.max(16, valueFs - 1) }}>→</span>
            <img
              src={targetRateSrc}
              width={badgeW}
              height={badgeH}
              style={{
                width: badgeW,
                height: badgeH,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* 增益 */}
      <div
        style={{
          display: "flex",
          width: GAIN_W,
          height: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderLeft: "2px solid #cde9d8",
          borderRadius: 10,
          backgroundColor: "rgba(31,157,85,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: Math.max(13, Math.floor(gainFs * 0.36)),
            fontWeight: 800,
            color: "#63856f",
            letterSpacing: 1,
            marginBottom: 5,
          }}
        >
          预计提升
        </div>
        <div
          style={{
            display: "flex",
            fontSize: gainFs,
            fontWeight: 800,
            color: "#168f4a",
            lineHeight: 1,
          }}
        >
          {gainText}
        </div>
      </div>
    </div>
  );
}
