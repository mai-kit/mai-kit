import type { CSSProperties } from "react";
import { font, H, W } from "./theme";

/**
 * Best 板逻辑画布宽（与海报同为 1920）。
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export const BEST_WIDTH = W;
/**
 * Best 板逻辑画布高（与海报同为 1080）。
 * @remarks 稳定性：高级布局 API，可能随视觉设计调整。
 * @beta
 */
export const BEST_HEIGHT = H;

export const bestOuterX = 22;
export const bestOuterTop = 18;
export const bestHeaderH = 44;
export const bestHeaderGap = 8;
export const bestFooterH = 26;
export const bestOuterBottom = 10;
export const bestGridGap = 7;

export const bestStyles = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: BEST_WIDTH,
    height: BEST_HEIGHT,
    overflow: "hidden",
    backgroundColor: "#f7f4ff",
    color: "#23194d",
    fontFamily: font,
  },
  header: {
    position: "relative",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: bestHeaderH,
    marginLeft: bestOuterX,
    marginRight: bestOuterX,
    marginTop: bestOuterTop,
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  b50: {
    display: "flex",
    fontSize: 32,
    fontWeight: 800,
    color: "#7b4ce1",
    lineHeight: 1,
  },
  title: {
    display: "flex",
    fontSize: 24,
    fontWeight: 800,
    color: "#4e299c",
    lineHeight: 1,
  },
  headerRule: {
    display: "flex",
    width: 190,
    height: 2,
    marginLeft: 2,
    opacity: 0.65,
  },
  headerRight: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  playerName: {
    display: "flex",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 2.5,
    color: "#3a2a6e",
    maxWidth: 360,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rating: {
    display: "flex",
    fontSize: 22,
    fontWeight: 800,
    color: "#6939c7",
    whiteSpace: "nowrap",
  },
  grid: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    marginLeft: bestOuterX,
    marginRight: bestOuterX,
    marginTop: bestHeaderGap,
    flexShrink: 0,
  },
  footerBar: {
    position: "absolute",
    left: bestOuterX,
    right: bestOuterX,
    bottom: bestOuterBottom,
    height: bestFooterH,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerSide: {
    display: "flex",
    fontSize: 14,
    fontWeight: 700,
    color: "#7e5ede",
  },
} satisfies Record<string, CSSProperties>;
