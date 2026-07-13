import type { CSSProperties } from "react";

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    width: 621,
    marginTop: 10,
    padding: "14px 14px",
    border: "2px solid #a78ded",
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,.36)",
  },
  panelTitle: {
    display: "flex",
    position: "absolute",
    left: 16,
    top: 9,
    fontSize: 19,
    color: "#5b3fb5",
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  summaryLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: 28,
  },
  summaryLabel: { display: "flex", fontSize: 14, color: "#764be0", fontWeight: 700 },
  summaryValue: { display: "flex", fontSize: 20, fontWeight: 800 },
  metric: {
    display: "flex",
    flexDirection: "column",
    width: 138,
    height: 56,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingRight: 10,
  },
  metricLabel: {
    display: "flex",
    fontSize: 12,
    lineHeight: 1.2,
    color: "#6f55d1",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  metricValue: {
    display: "flex",
    marginTop: 6,
    fontSize: 20,
    lineHeight: 1,
    color: "#24194f",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
} satisfies Record<string, CSSProperties>;

export function Panel({
  title,
  style,
  children,
}: {
  title?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...styles.panel, ...style }}>
      {title ? <div style={styles.panelTitle}>{title}</div> : null}
      {children}
    </div>
  );
}

export function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summaryLine}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

/**
 * 估算单字在 satori + Noto/Comfortaa 下的大致宽度（逻辑像素）。
 * CJK / 假名按全角，Latin 按半角略宽，略偏保守以免溢出。
 */
function estimateCharWidth(ch: string, fontSize: number): number {
  const code = ch.codePointAt(0) ?? 0;
  if (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff)
  ) {
    return fontSize * 1.02;
  }
  if (code >= 0x41 && code <= 0x5a) return fontSize * 0.68;
  if (code >= 0x61 && code <= 0x7a) return fontSize * 0.58;
  if (code >= 0x30 && code <= 0x39) return fontSize * 0.62;
  if (code <= 0x7f) return fontSize * 0.42;
  return fontSize * 0.75;
}

function measureTextWidth(value: string, fontSize: number): number {
  let w = 0;
  for (const ch of value) w += estimateCharWidth(ch, fontSize);
  return w;
}

/**
 * 按可用像素宽度截断曲名（自适应拉丁/CJK 混排），超出加省略号。
 */
export function fitText(value: string, maxWidth: number, fontSize: number): string {
  if (!value) return value;
  if (measureTextWidth(value, fontSize) <= maxWidth) return value;

  const ellipsis = "…";
  const ellipsisW = estimateCharWidth(ellipsis, fontSize);
  const budget = Math.max(0, maxWidth - ellipsisW);

  let used = 0;
  let end = 0;
  for (const ch of value) {
    const cw = estimateCharWidth(ch, fontSize);
    if (used + cw > budget) break;
    used += cw;
    end += ch.length;
  }
  return end > 0 ? `${value.slice(0, end)}${ellipsis}` : ellipsis;
}
