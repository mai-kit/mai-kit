# 更新日志

mai-kit 的各个包独立遵循语义化版本。请选择要查看的包；页面内容直接引用各包由 Changesets
维护的 `CHANGELOG.md`，因此会随发版记录同步更新。

| 包                                                      | 内容                                   |
| ------------------------------------------------------- | -------------------------------------- |
| [`@mai-kit/shared`](./shared)                           | 共享错误与 maimai 领域原语             |
| [`@mai-kit/utils`](./utils)                             | Rating、达成率、判定与谱面索引等纯函数 |
| [`@mai-kit/judgement-solver`](./judgement-solver)       | 混合判定检查与剩余容错                 |
| [`@mai-kit/judgement-inference`](./judgement-inference) | 基于 GLPK/WASM 的完整判定反推          |
| [`@mai-kit/database`](./database)                       | 游戏静态数据与素材适配器               |
| [`@mai-kit/prober`](./prober)                           | 玩家数据与查分器适配器                 |
| [`@mai-kit/analysis`](./analysis)                       | Best50、升分候选与成绩快照分析         |
| [`@mai-kit/assets`](./assets)                           | 徽章、字体与 resvg wasm 等静态资源     |
| [`@mai-kit/draw`](./draw)                               | 成绩海报与卡片渲染                     |

只有文档、CI 或仓库维护方式发生变化时，可能不会产生 npm 包版本。此类记录请查看仓库的
[提交历史](https://github.com/mai-kit/mai-kit/commits/main/)。
