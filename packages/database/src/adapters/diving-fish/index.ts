export {
  DivingFishMaimaiDatabase,
  DIVING_FISH_DEFAULT_BASE_URL,
  DIVING_FISH_DEFAULT_COVER_BASE_URL,
} from "./diving-fish-database";
export type { DivingFishMaimaiDatabaseOptions } from "./diving-fish-database";
export type {
  DivingFishChartStat,
  DivingFishChartStats,
  DivingFishDifficultyStats,
} from "./chart-stats";
export { DivingFishDatabaseError, isDivingFishDatabaseError } from "./error";
// map-songs / coverId 仅适配内部使用，不从包根公开
