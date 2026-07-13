import { getClassRankBadge, getCourseRankBadge } from "@mai-kit/assets";
import { placeholderAvatar } from "../assets";
import type { PosterData } from "../types";
import { formatGeneratedAt, songTitle } from "../formatters";
import { Background, HeaderLine } from "./background";
import { BarChart, DonutChart, RadarChart } from "./charts";
import { posterStyles as styles } from "./poster.styles";
import { nextSongSectionTop, SongSection } from "./song-card";
import { TopCard } from "./song-card";
import {
  constantDistributionFromCharts,
  ratingDistributionFromCharts,
  resolvePersonalMetrics,
} from "../poster-derived";
import { Panel, SummaryLine, Metric } from "./widgets";

/**
 * 海报的逻辑画布尺寸，供高级自定义布局使用。
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export { POSTER_HEIGHT, POSTER_WIDTH } from "./theme";

/**
 * 海报 JSX 布局，供直接组装 satori 树的高级用法。
 *
 * 常规出图请使用 {@link Draw.poster}。
 *
 * @param props - 完整海报数据与可选页脚
 * @returns satori 可渲染的 JSX 元素
 *
 * @example
 * ```ts
 * import { createElement } from "react";
 *
 * const element = createElement(B50Poster, { data, footerLeft: "my-app" });
 * ```
 *
 * @remarks 稳定性：高级布局 API。常规出图优先使用 {@link Draw.poster}。
 * @beta
 */
export function B50Poster({
  data,
  footerLeft,
  footerRight,
}: {
  /** 完整海报数据 */
  data: PosterData;
  /** 左侧页脚文案 */
  footerLeft?: string;
  /** 右侧页脚文案 */
  footerRight?: string;
}) {
  const charts = data.charts;
  const b15 = charts.slice(0, 15);
  const b35 = charts.slice(15, 50);
  const b15Top = 60;
  const b35Top = nextSongSectionTop(b15Top, b15.length);
  const avatar = data.player.avatarDataUri ?? placeholderAvatar(data.player.name);
  const generatedAt = formatGeneratedAt(data.player.upload_time);
  const personalMetrics = resolvePersonalMetrics(data);
  const ratingDistribution = ratingDistributionFromCharts(charts);
  const constantDistribution = constantDistributionFromCharts(charts);
  const showFooter = Boolean(footerLeft || footerRight);

  return (
    <div style={styles.root}>
      <Background />
      <div style={styles.leftPane}>
        <HeaderLine />
        <div style={styles.playerBlock}>
          <div style={styles.sectionLabel}>PLAYER</div>
          <div style={styles.nameRow}>
            <div style={styles.playerName}>{data.player.name}</div>
            {typeof data.player.course_rank === "number" ? (
              // satori 需明确宽高；course_rank 素材约 380×160
              <img
                src={getCourseRankBadge(data.player.course_rank)}
                width={92}
                height={38}
                style={styles.nameRankBadge}
              />
            ) : null}
            {typeof data.player.class_rank === "number" ? (
              // class_rank 素材约 140×84
              <img
                src={getClassRankBadge(data.player.class_rank)}
                width={72}
                height={44}
                style={styles.nameRankBadge}
              />
            ) : null}
          </div>
          <div style={styles.profileRow}>
            <div style={styles.avatarRing}>
              <img src={avatar} width={118} height={118} style={styles.avatar} />
            </div>
            <div style={styles.ratingBox}>
              <div style={styles.mutedLabel}>RATING</div>
              <div style={styles.bigRating}>{data.player.rating}</div>
            </div>
            <div style={styles.scoreBox}>
              <SummaryLine label="B50 总分" value={data.summary.b50} />
              <SummaryLine label="新曲 B15" value={data.summary.newSongs} />
              <SummaryLine label="旧曲 B35" value={data.summary.oldSongs} />
            </div>
          </div>
          <div style={styles.generated}>生成于 {generatedAt}</div>
        </div>

        <Panel title="TOP 5 HIGHEST RATING" style={{ height: 274 }}>
          <div style={styles.topCards}>
            {charts.slice(0, 5).map((chart, index) => (
              <TopCard key={`${songTitle(chart)}-${index}`} chart={chart} index={index} />
            ))}
          </div>
        </Panel>

        <Panel style={{ height: 154 }}>
          <div style={styles.statsRow}>
            <div style={styles.statCell}>
              <div style={styles.panelTitleSmall}>RATING 分布</div>
              <div style={styles.donutRow}>
                <DonutChart items={ratingDistribution} />
                <div style={styles.legend}>
                  {ratingDistribution.map((item) => (
                    <div key={item.label} style={styles.legendRow}>
                      <div style={{ ...styles.legendDot, backgroundColor: item.color }} />
                      <div style={styles.legendLabel}>{item.label}</div>
                      <div style={styles.legendValue}>{item.value}</div>
                      <div style={styles.legendPercent}>
                        ({Math.round((item.value / Math.max(charts.length, 1)) * 100)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={styles.statCellRight}>
              <div style={styles.panelTitleSmall}>定数分布 (B50)</div>
              <BarChart values={constantDistribution} />
            </div>
          </div>
        </Panel>

        <Panel style={{ height: 242 }}>
          <div style={styles.bottomStats}>
            <div style={styles.radarArea}>
              <div style={styles.panelTitleSmall}>B50 谱面倾向</div>
              <RadarChart items={data.radar} />
            </div>
            <div style={styles.personalArea}>
              <div style={styles.panelTitleSmall}>个人数据</div>
              <div style={styles.metricsGrid}>
                {personalMetrics.map((metric) => (
                  <Metric key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div style={styles.rightPane}>
        <div style={styles.boardHeader}>
          <div style={styles.b50Title}>
            <span style={styles.b50Strong}>B50</span>
            <span style={styles.b50Text}>BEST 50</span>
          </div>
        </div>

        <SongSection title="新曲" subtitle="B15" charts={b15} start={1} top={b15Top} />
        <SongSection title="旧曲" subtitle="B35" charts={b35} start={16} top={b35Top} />
      </div>

      {showFooter ? (
        <div style={styles.footerBar}>
          <div style={styles.footerLeft}>{footerLeft ?? ""}</div>
          <div style={styles.footerRight}>{footerRight ?? ""}</div>
        </div>
      ) : null}
    </div>
  );
}
