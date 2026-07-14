---
"@mai-kit/prober": patch
"@mai-kit/database": patch
---

使用 Zod Mini 校验 LXNS、Diving-Fish 与内置标签快照的外部 JSON，并在 database 缓存命中时复用端点 decoder，避免未校验的类型断言进入公开模型。
