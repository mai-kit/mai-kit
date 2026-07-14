---
"@mai-kit/prober": patch
"@mai-kit/database": minor
---

使用 Zod Mini 校验 LXNS、Diving-Fish 与内置标签快照的外部 JSON，并在 database 缓存命中时复用端点 decoder；同时兼容水鱼的空白曲名与等级文案 `chart_stats.diff`，并将 LXNS 收藏要求中误放在 `fc` 的 FS 码归一到 `fs`。
