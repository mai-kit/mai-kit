export { createDivingFishClient } from "./client";
export type { DivingFishClient, DivingFishClientOptions } from "./client";
export type { DivingFishDeveloperPlayer } from "./player";
export type {
  DivingFishPlayerQuery,
  DivingFishRatingRankEntry,
  DivingFishVersionScore,
} from "./types";
export { DivingFishProberError, isDivingFishProberError } from "./error";
// mappers / 原始 payload 类型仅适配内部使用；用户走 createDivingFishClient → ProberPlayer
