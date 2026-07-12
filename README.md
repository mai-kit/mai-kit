<p align="center">
  <img src="docs/public/mai-kit-chibi.png" alt="mai-kit Q 版角色" width="180">
</p>

# mai-kit

面向舞萌 DX 的 TypeScript 工具集，提供玩家成绩查询、游戏数据读取、Rating 计算、
Best50 分析和成绩海报渲染等能力。各个包可以独立使用，也可以按需要组合。

## 包

| 包                  | 用途                        |
| ------------------- | --------------------------- |
| `@mai-kit/prober`   | 查询玩家档案、Best50 和成绩 |
| `@mai-kit/database` | 读取曲目、谱面与图片素材    |
| `@mai-kit/utils`    | 计算 Rating、达成率和 DX 分 |
| `@mai-kit/analysis` | 重算 Best50、分析升分与快照 |
| `@mai-kit/assets`   | 读取徽章、字体等静态资源    |
| `@mai-kit/draw`     | 生成成绩海报和 Best 单图    |
| `@mai-kit/shared`   | 共用类型与错误基类          |

## 示例

下面以 LXNS 为例，查询自己的 Best50 并生成成绩海报：

```ts
import { writeFile } from "node:fs/promises";
import { LxnsMaimaiDatabase } from "@mai-kit/database";
import { Draw } from "@mai-kit/draw";
import { createLxnsClient } from "@mai-kit/prober";

const player = createLxnsClient({
  personalAccessToken: process.env.LXNS_API_PERSONAL_ACCESS_TOKEN!,
}).me();

const [profile, bests] = await Promise.all([player.getProfile(), player.getBests()]);
const draw = await new Draw({
  database: new LxnsMaimaiDatabase(),
}).withPlayer(profile, bests);

await writeFile("poster.png", await draw.render("poster"));
```

## 文档

- [使用指南](https://wsyzxjn.github.io/mai-kit/guide/getting-started)
- [API 参考](https://wsyzxjn.github.io/mai-kit/api/)
- [各包职责与组合方式](https://wsyzxjn.github.io/mai-kit/guide/architecture)
