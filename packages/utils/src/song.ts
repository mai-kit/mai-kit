/**
 * @packageDocumentation
 *
 * `@mai-kit/utils/song` — 谱面查找、稳定 key 与曲目索引构建。
 *
 * 用于关联成绩与曲目数据。Rating、达成率和 DX 分等常用公式从 `@mai-kit/utils`
 * 包根导入。
 */

export { chartMapKey, scoreMapKey } from "./score-key";
export {
  buildSongDxMaxMap,
  buildSongLevelMap,
  findSongDifficulty,
  type DifficultyLists,
  type DifficultyMeta,
  type SongDifficultiesMeta,
  type SongMeta,
} from "./song-maps";
