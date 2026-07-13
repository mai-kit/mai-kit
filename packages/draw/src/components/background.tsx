import type { CSSProperties } from "react";
import { svgDataUri } from "../encoding";
import { H, W } from "./theme";

const styles = {
  // 必须有实色底：satori 对 backgroundImage 支持有限，透明会透出成黑/棋盘
  bg: {
    position: "absolute",
    inset: 0,
    display: "flex",
    width: W,
    height: H,
    backgroundColor: "#f7f4ff",
  },
  bgWash: {
    position: "absolute",
    inset: 0,
    width: W,
    height: H,
    backgroundColor: "#f1ebff",
    backgroundImage: "linear-gradient(135deg, #fbf9ff 0%, #f1ebff 47%, #fff6fb 100%)",
  },
  bgSlashOne: {
    position: "absolute",
    left: 470,
    top: -80,
    width: 190,
    height: 1050,
    backgroundColor: "#d9cdf9",
    opacity: 0.34,
    transform: "rotate(42deg)",
  },
  bgSlashTwo: {
    position: "absolute",
    right: 120,
    top: -130,
    width: 260,
    height: 1200,
    backgroundColor: "#ded6fa",
    opacity: 0.3,
    transform: "rotate(48deg)",
  },
  bgRing: {
    position: "absolute",
    left: 520,
    top: 58,
    width: 44,
    height: 44,
    border: "7px solid #8f75dd",
    borderRadius: 99,
    opacity: 0.65,
  },
  bgRingSmall: {
    position: "absolute",
    left: 486,
    top: 56,
    width: 22,
    height: 22,
    border: "3px solid #9c82e5",
    borderRadius: 99,
    opacity: 0.7,
  },
  bgSpeckles: { position: "absolute", left: 0, top: 0 },
  headerLine: { display: "flex", alignItems: "center", height: 24, color: "#7760d5" },
  moonMark: {
    display: "flex",
    width: 28,
    height: 28,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moonDot: {
    display: "flex",
    width: 12,
    height: 12,
    borderRadius: 99,
    border: "3px solid #7760d5",
    borderTopColor: "transparent",
  },
  brand: { display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 3.2 },
  brandRule: { display: "flex", height: 2, width: 132, marginLeft: 14, backgroundColor: "#9d7beb" },
} satisfies Record<string, CSSProperties>;

export function Background() {
  return (
    <div style={styles.bg}>
      <div style={styles.bgWash} />
      <div style={styles.bgSlashOne} />
      <div style={styles.bgSlashTwo} />
      <div style={styles.bgRing} />
      <div style={styles.bgRingSmall} />
      <img src={svgDataUri(specklesSvg())} width={W} height={H} style={styles.bgSpeckles} />
    </div>
  );
}

export function HeaderLine() {
  return (
    <div style={styles.headerLine}>
      <div style={styles.moonMark}>
        <div style={styles.moonDot} />
      </div>
      <div style={styles.brand}>maimai DX BUDDIES PLUS</div>
      <div style={styles.brandRule} />
    </div>
  );
}

function specklesSvg(): string {
  let circles = "";
  for (let i = 0; i < 140; i += 1) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    const r = 1 + (i % 3);
    circles += `<circle cx="${x}" cy="${y}" r="${r}" fill="#9273e8" opacity="${0.08 + (i % 5) * 0.025}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${circles}</svg>`;
}
