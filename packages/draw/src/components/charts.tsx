import type { CSSProperties } from "react";
import type { RadarItem, RatingDistributionItem } from "../types";

const chartStyles = {
  donutWrap: { position: "relative", display: "flex", width: 100, height: 100 },
  donutCenter: {
    position: "absolute",
    left: 25,
    top: 32,
    display: "flex",
    flexDirection: "column",
    width: 50,
    alignItems: "center",
  },
  donutLabel: { display: "flex", fontSize: 10, fontWeight: 700, color: "#34256e" },
  donutValue: { display: "flex", fontSize: 28, lineHeight: 1, fontWeight: 800, color: "#24194e" },
  barWrap: { position: "relative", display: "flex", width: 250, height: 106, marginTop: 10 },
  axisX: { position: "absolute", display: "flex", top: 90, fontSize: 12, color: "#423580" },
  axisY: { position: "absolute", display: "flex", left: 4, fontSize: 11, color: "#423580" },
  radarWrap: { position: "relative", display: "flex", width: 270, height: 178, marginTop: 2 },
  radarLabel: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    width: 54,
    alignItems: "center",
    fontWeight: 700,
    color: "#4e3990",
  },
  radarLabelText: { display: "flex", fontSize: 12 },
  radarValue: { display: "flex", fontSize: 11 },
} satisfies Record<string, CSSProperties>;

export function DonutChart({ items }: { items: RatingDistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={chartStyles.donutWrap}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#ebe4ff" strokeWidth="18" />
        {items.map((item) => {
          const length = (item.value / total) * circumference;
          const segment = (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
            />
          );
          offset += length;
          return segment;
        })}
        <circle cx="50" cy="50" r="25" fill="#ffffff" opacity=".9" />
      </svg>
      <div style={chartStyles.donutCenter}>
        <div style={chartStyles.donutLabel}>TOTAL</div>
        <div style={chartStyles.donutValue}>{total}</div>
      </div>
    </div>
  );
}

export function BarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div style={chartStyles.barWrap}>
      <svg width="250" height="106" viewBox="0 0 250 106">
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="28"
            x2="240"
            y1={14 + i * 23}
            y2={14 + i * 23}
            stroke="#d5c6f8"
            strokeDasharray="4 5"
          />
        ))}
        {values.map((value, index) => {
          const height = Math.round((value / max) * 64);
          const x = 34 + index * 12;
          return (
            <g key={index}>
              <rect
                x={x}
                y={84 - height}
                width="9"
                height={height}
                rx="3"
                fill={index === 6 ? "#cf57ed" : "#9e6df0"}
              />
              <rect
                x={x}
                y={84 - height}
                width="9"
                height={Math.min(height, Math.max(7, height * 0.35))}
                rx="3"
                fill="#f1b4ff"
                opacity=".7"
              />
            </g>
          );
        })}
        <line x1="28" x2="240" y1="84" y2="84" stroke="#b8a5e7" />
      </svg>
      {["13.5", "14.0", "14.5", "15.0", "15.5"].map((label, index) => (
        <div key={label} style={{ ...chartStyles.axisX, left: 28 + index * 52 }}>
          {label}
        </div>
      ))}
      {[0, 5, 10, 15].map((label, index) => (
        <div key={label} style={{ ...chartStyles.axisY, top: 78 - index * 23 }}>
          {label}
        </div>
      ))}
    </div>
  );
}

export function RadarChart({ items }: { items: RadarItem[] }) {
  const centerX = 135;
  const centerY = 88;
  const radius = 56;
  const labelRadius = 72;
  const points = items.map((item, index) => {
    const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
    const valueRadius = (item.value / 100) * radius;
    return {
      label: item.label,
      value: item.value,
      displayValue: item.displayValue,
      x: centerX + Math.cos(angle) * valueRadius,
      y: centerY + Math.sin(angle) * valueRadius,
      lx: centerX + Math.cos(angle) * labelRadius,
      ly: centerY + Math.sin(angle) * labelRadius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const grid = [0.25, 0.5, 0.75, 1].map((ratio) =>
    items
      .map((_, index) => {
        const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
        return `${centerX + Math.cos(angle) * radius * ratio},${centerY + Math.sin(angle) * radius * ratio}`;
      })
      .join(" "),
  );

  return (
    <div style={chartStyles.radarWrap}>
      <svg width="270" height="178" viewBox="0 0 270 178">
        {grid.map((poly, index) => (
          <polygon
            key={index}
            points={poly}
            fill={index === 3 ? "#f2ecff" : "none"}
            stroke="#b69aef"
            strokeWidth="1.2"
            opacity=".75"
          />
        ))}
        {points.map((point, index) => (
          <line
            key={index}
            x1={centerX}
            y1={centerY}
            x2={point.lx - (point.lx - centerX) * 0.24}
            y2={point.ly - (point.ly - centerY) * 0.24}
            stroke="#b69aef"
            opacity=".55"
          />
        ))}
        <polygon points={polygon} fill="#9d6af0" opacity=".58" stroke="#7f55df" strokeWidth="3" />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="3" fill="#7446d7" />
        ))}
      </svg>
      {points.map((point) => (
        <div
          key={point.label}
          style={{ ...chartStyles.radarLabel, left: point.lx - 27, top: point.ly - 11 }}
        >
          <div style={chartStyles.radarLabelText}>{point.label}</div>
          <div style={chartStyles.radarValue}>{point.displayValue}</div>
        </div>
      ))}
    </div>
  );
}
