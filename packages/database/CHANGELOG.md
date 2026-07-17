# @mai-kit/database

## 0.3.0

### Minor Changes

- 5f83e50: 使用 Zod Mini 校验 LXNS、Diving-Fish 与内置标签快照的外部 JSON，并在 database 缓存命中时复用端点 decoder；同时兼容水鱼的空白曲名与等级文案 `chart_stats.diff`，并将 LXNS 收藏要求中误放在 `fc` 的 FS 码归一到 `fs`。

### Patch Changes

- 24b251b: 补充各 npm 包的核心搜索关键词。
- Updated dependencies [24b251b]
  - @mai-kit/shared@0.1.2

## 0.2.0

### Minor Changes

- 3a0f621: 收紧适配器缺失字段与异常响应处理，避免伪造默认数据；Draw 批量复用曲目索引并限制素材
  并发；assets 将徽章合并为单一运行时清单，并增加真实浏览器 smoke 门禁。

## 0.1.1

### Patch Changes

- b2eecbc: 精简 npm 发布内容，不再携带不必要的 TypeScript 源码。
- Updated dependencies [b2eecbc]
  - @mai-kit/shared@0.1.1
