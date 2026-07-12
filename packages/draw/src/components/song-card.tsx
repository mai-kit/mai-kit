import { placeholderCover } from "../assets";
import {
  formatAchievement,
  formatChartRating,
  formatDxScore,
  formatLevelConstant,
  songTitle,
} from "../formatters";
import {
  getDxStarAssetRate,
  getDxStarBadge,
  getPlayBonusBadge,
  getRateBadge,
} from "@mai-kit/assets";
import type { ScoreChart } from "../types";
import { fitText } from "./widgets";
import { songCardStyles as styles } from "./song-card.styles";
import {
  LANDSCAPE_CARD_COVER,
  LANDSCAPE_CARD_HEIGHT,
  LANDSCAPE_GRID_COLUMNS,
  SONG_TITLE_LAYOUT,
  songGridGap,
} from "./theme";

const sectionChromeHeight = 62;
const sectionGap = 18;

/** B15 / B35 统一：同一卡高 */
export function songSectionHeight(chartCount: number): number {
  const rows = Math.ceil(chartCount / LANDSCAPE_GRID_COLUMNS);
  return sectionChromeHeight + rows * LANDSCAPE_CARD_HEIGHT + Math.max(0, rows - 1) * songGridGap;
}

export function nextSongSectionTop(top: number, chartCount: number): number {
  return top + songSectionHeight(chartCount) + sectionGap;
}

/** DX 星：TOP5 用较大星，曲卡用较小星 */
function DxStarRow({
  dxStar,
  size = 10,
  starStyle = styles.dxStar,
}: {
  dxStar?: number;
  size?: number;
  starStyle?: typeof styles.dxStar;
}) {
  const count = dxStar != null && Number.isFinite(dxStar) ? Math.min(5, Math.floor(dxStar)) : 0;
  const rate = getDxStarAssetRate(count);
  if (count <= 0 || rate == null) return null;
  const src = getDxStarBadge(rate);
  return (
    <div style={styles.dxStars}>
      {Array.from({ length: count }, (_, i) => (
        <img key={i} src={src} width={size} height={size} style={starStyle} />
      ))}
    </div>
  );
}

/** TOP 5 竖条卡：独立布局，不与 B50 `SongCard` 共用信息栏 */
export function TopCard({ chart, index }: { chart: ScoreChart; index: number }) {
  const cover = chart.coverDataUri ?? placeholderCover(index, songTitle(chart));
  return (
    <div style={styles.topCard}>
      <img src={cover} width={111} height={220} style={styles.topCover} />
      <div style={styles.topShade} />
      <div style={styles.topIndex}>{String(index + 1).padStart(2, "0")}</div>
      <div style={styles.topMeta}>
        <div style={styles.songTitle}>
          {fitText(
            songTitle(chart),
            SONG_TITLE_LAYOUT.top.maxWidth,
            SONG_TITLE_LAYOUT.top.fontSize,
          )}
        </div>
        <div style={styles.ach}>{formatAchievement(chart.achievements)}</div>
        <div style={styles.dxLargeRow}>
          <span style={styles.dxLarge}>{formatDxScore(chart.dx_score, chart.dx_max)}</span>
          <DxStarRow dxStar={chart.dx_star} size={10} starStyle={styles.dxStar} />
        </div>
        <div style={styles.masterRow}>
          <span style={styles.masterPill}>MASTER</span>
          <span>{chart.level}</span>
        </div>
      </div>
    </div>
  );
}

export function SongSection({
  title,
  subtitle,
  charts,
  start,
  top,
}: {
  title: string;
  subtitle: string;
  charts: ScoreChart[];
  start: number;
  top: number;
}) {
  const sectionHeight = songSectionHeight(charts.length);
  return (
    <div style={{ ...styles.songSection, top, height: sectionHeight }}>
      <div style={styles.songSectionTitle}>
        <span style={styles.songSectionMain}>{title}</span>
        <span style={styles.songSectionSub}>{subtitle}</span>
        <div style={styles.songRule} />
      </div>
      <div style={styles.songGrid}>
        {charts.map((chart, index) => (
          <SongCard
            key={`${start + index}-${songTitle(chart)}`}
            chart={chart}
            index={start + index}
          />
        ))}
      </div>
    </div>
  );
}

function SongCard({ chart, index }: { chart: ScoreChart; index: number }) {
  const cover = chart.coverDataUri ?? placeholderCover(index, songTitle(chart));
  const bonusCode = chart.fc ?? chart.fs;
  return (
    <div style={styles.songCard}>
      <div style={styles.coverStack}>
        <img
          src={cover}
          width={LANDSCAPE_CARD_COVER}
          height={LANDSCAPE_CARD_COVER}
          style={styles.songCover}
        />
        <div style={styles.coverIndex}>#{index}</div>
      </div>
      <div style={styles.songInfo}>
        <div style={styles.cardTitle}>
          {fitText(songTitle(chart), SONG_TITLE_LAYOUT.maxWidth, SONG_TITLE_LAYOUT.fontSize)}
        </div>
        <div style={styles.cardAchRow}>
          <span style={styles.cardAch}>{formatAchievement(chart.achievements)}</span>
          {chart.rate ? (
            <img
              src={getRateBadge(chart.rate)}
              width={36}
              height={17}
              style={styles.cardRateImage}
            />
          ) : (
            <span style={styles.cardRating}>--</span>
          )}
        </div>
        <div style={styles.cardDxRow}>
          <span style={styles.cardDx}>{formatDxScore(chart.dx_score, chart.dx_max)}</span>
          <DxStarRow dxStar={chart.dx_star} size={8} starStyle={styles.cardDxStar} />
        </div>
        <div style={styles.cardBottom}>
          <div style={styles.cardBottomLeft}>
            <span style={styles.cardLevel}>
              {formatLevelConstant(chart.level_value, chart.level)}
            </span>
            <span style={styles.cardChartRating}>{formatChartRating(chart.dx_rating)}</span>
          </div>
          {chart.badgeImageUri ? (
            <img src={chart.badgeImageUri} width={15} height={15} style={styles.cardBadgeImage} />
          ) : bonusCode ? (
            <img
              src={getPlayBonusBadge(bonusCode)}
              width={15}
              height={15}
              style={styles.cardBadgeImage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
