/**
 * 海报展示用格式化（渲染层）。
 * 领域计算（归一、满分、rating 公式）请用 `@mai-kit/utils`。
 */

import { normalizeAchievement } from "@mai-kit/utils";

/**
 * 格式化达成率为四位小数百分比字符串。
 *
 * @param value - 百分数或万分位（内部 `normalizeAchievement`）
 * @returns 如 `"100.8621%"`
 */
export function formatAchievement(value: number): string {
  return `${normalizeAchievement(value).toFixed(4)}%`;
}

/**
 * 上传 / 生成时间 → `"YYYY-MM-DD HH:mm"`。
 *
 * @param uploadTime - ISO 或可被 `Date` 解析的字符串；缺省用当前时间
 * @returns 格式化时间；非法输入时尽量回传原串
 */
export function formatGeneratedAt(uploadTime?: string): string {
  const date = uploadTime ? new Date(uploadTime) : new Date();
  if (Number.isNaN(date.getTime())) return uploadTime ?? "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 曲目标题。
 *
 * @param score - 至少含 `id`；有 `song_name` 则优先
 * @returns 标题字符串
 */
export function songTitle(score: { song_name?: string; id: number }): string {
  return score.song_name ?? String(score.id);
}

/**
 * 将 DX 分格式化为成绩卡使用的文案。
 *
 * @param dxScore - 当前 DX 分
 * @param dxMax - 可选满分；有效正数时显示为 `score/max`
 * @returns 如 `"2055/2283"` 或 `"2055"`
 * @example formatDxScore(2055, 2283); // "2055/2283"
 * @remarks 稳定性：高级展示 API，输出文案可能随海报设计调整。
 * @beta
 */
export function formatDxScore(dxScore: number, dxMax?: number): string {
  if (dxMax != null && Number.isFinite(dxMax) && dxMax > 0) {
    return `${dxScore}/${Math.floor(dxMax)}`;
  }
  return String(dxScore);
}

/**
 * 将精确定数或等级文案格式化为成绩卡显示值。
 *
 * @param levelValue - 精确定数（优先）
 * @param level - 等级文案回退，如 `"14+"`
 * @returns 一位小数定数、`level` 原文，或 `"--"`
 * @example formatLevelConstant(14.7, "14+"); // "14.7"
 * @remarks 稳定性：高级展示 API，输出文案可能随海报设计调整。
 * @beta
 */
export function formatLevelConstant(levelValue?: number, level?: string): string {
  if (levelValue != null && Number.isFinite(levelValue)) {
    return (Math.round(levelValue * 10) / 10).toFixed(1);
  }
  if (level) return level;
  return "--";
}

/**
 * 将单曲 Rating 格式化为成绩卡显示值。
 *
 * @param dxRating - 单曲 Rating；缺省或非法 → `"--"`
 * @returns 整数字符串或 `"--"`
 * @example formatChartRating(315.9); // "315"
 * @remarks 稳定性：高级展示 API，输出文案可能随海报设计调整。
 * @beta
 */
export function formatChartRating(dxRating?: number): string {
  if (dxRating == null || !Number.isFinite(dxRating)) return "--";
  return String(Math.floor(dxRating));
}
