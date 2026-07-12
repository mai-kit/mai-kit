/**
 * 海报视觉主题：画布尺寸、字体、横版曲卡几何。
 * 组件样式文件只 import 这里的常量，不互相 import 样式对象。
 */

/** 横版画布 */
export const W = 1920;
export const H = 1080;
export const POSTER_WIDTH = W;
export const POSTER_HEIGHT = H;

/** satori 按列表回退：中文用 Noto Sans SC，Latin 装饰用 Comfortaa */
export const font = "Noto Sans SC, Comfortaa";

export const LANDSCAPE_GRID_COLUMNS = 5;
/** 左右内容区共用同一底线；其下保留页脚安全区 */
export const LANDSCAPE_FOOTER_HEIGHT = 30;

export const songSectionWidth = 1230;
export const songSectionPadding = 10;
export const songGridGap = 7;
export const songGridWidth = songSectionWidth - songSectionPadding * 2;
export const songCardWidth =
  (songGridWidth - songGridGap * (LANDSCAPE_GRID_COLUMNS - 1)) / LANDSCAPE_GRID_COLUMNS;

/**
 * B15 / B35 统一曲卡高度与方形封面边长。
 * 封面为正方形，maimai jacket 完整显示。
 */
export const LANDSCAPE_CARD_HEIGHT = 78;
export const LANDSCAPE_CARD_COVER = 78;

/** 横版曲卡标题可用宽度 / 字号（供按像素截断） */
export const SONG_TITLE_LAYOUT = {
  maxWidth: songCardWidth - LANDSCAPE_CARD_COVER - 21,
  fontSize: 13,
  top: { maxWidth: 104, fontSize: 13 },
} as const;
