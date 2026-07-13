# 关于

mai-kit 是面向 **舞萌 DX（maimai DX）** 玩家与开发者的 TypeScript 工具集，可用于查询成绩、计算游戏数据和生成成绩海报。这里列出项目使用的第三方服务、数据和素材来源。

> mai-kit 为爱好者开发的非官方工具，与 SEGA / 华立等官方无关，亦不隶属于下文所列第三方服务。

## 适配与中立接口

查成绩（`@mai-kit/prober`）与游戏公开数据（`@mai-kit/database`）都按**中立模型 / 接口**设计，不绑定某一家查分器或 CDN。

仓库目前内置 [落雪查分器（LXNS）](https://maimai.lxns.net/) 和 [Diving-Fish（水鱼）](https://www.diving-fish.com/maimaidx/prober/) 适配。其他数据源可以实现相同接口；`@mai-kit/draw` 只读取约定的玩家数据和素材能力。

## 第三方数据与服务

### 落雪查分器（LXNS）

当使用 LXNS 适配时，可能访问：

- 玩家档案、Best50 等成绩接口（需你自行申请访问令牌）
- 曲目列表等公开 JSON 接口
- 封面、头像等素材 CDN

请遵守 LXNS 的使用条款与频率限制；令牌请自行保管，不要提交到公开仓库。

### Diving-Fish（水鱼查分器）

当使用 Diving-Fish 适配时，可能访问 [diving-fish.com](https://www.diving-fish.com/) 的公开或鉴权接口：

- 公开 B50 查询（受对方隐私设置影响）
- Import-Token / Developer-Token 下的完整成绩
- 公开 Rating 排行
- 曲目表 `music_data`、谱面统计 `chart_stats`、封面 `covers`

这些能力均为只读查询。账号资料、成绩导入 / 删除和水鱼站内功能不属于 mai-kit 的适配范围。
别名、收藏品及封面之外的游戏素材没有对等的水鱼公开接口。请遵守水鱼的使用条款与频率
限制；令牌请自行保管。

### DXRating 社区谱面标签

海报雷达等展示用的谱面标签，可来自 [DXRating](https://dxrating.net/) 社区（数据接口见 [miruku.dxrating.net](https://miruku.dxrating.net/)）。

在使用带标签能力的数据源时，mai-kit 可能使用库内同步的标签快照，而不在每次渲染时请求上游。标签含义与覆盖范围以 DXRating 社区为准；若与实机观感有出入，属社区标注差异，而非官方定数。

### 游戏本身

曲名、谱面、段位与评级等概念均来自 **舞萌 DX / maimai DX** 官方游戏。游戏版权归 SEGA 及相关权利人所有。mai-kit 仅提供查询、计算与展示相关的工具库，不包含完整游戏客户端或官方内容转授权。

## 资源与开源组件

海报渲染使用以下资源和开源项目：

| 类型     | 名称                                                                                          | 用途                                          |
| -------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 渲染     | [satori](https://github.com/vercel/satori)（Vercel）                                          | 将布局转为 SVG                                |
| 渲染     | [resvg](https://github.com/RazrFalcon/resvg) / [resvg-js](https://github.com/yisibl/resvg-js) | 将 SVG 栅格为 PNG                             |
| 字体     | [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)                           | 海报默认中文（及 CJK）正文                    |
| 字体     | [Comfortaa](https://fonts.google.com/specimen/Comfortaa)                                      | 海报默认拉丁装饰字体                          |
| 界面素材 | 评级、FC/AP、段位等徽章图                                                                     | 海报上的标识展示（随 `@mai-kit/assets` 提供） |
| 设计参考 | [maidraw](https://github.com/saltcute/maidraw)（saltcute）                                    | draw 部分素材的设计与呈现方式参考             |

字体通常遵循各发行方的开源字体许可（如 SIL Open Font License）；具体以字体文件或发行页为准。  
徽章等界面素材用于成绩展示；若你二次分发含素材的产物，请自行确认合规与合理使用边界。

完整第三方依赖及许可证以各 npm 包的许可证文件为准。

## 致谢

感谢以下项目与社区（排名不分先后）：

- **落雪查分器（LXNS）** — 成绩与公开数据适配之一
- **Diving-Fish（水鱼）** — 成绩与曲目 / 封面适配之一
- **DXRating 社区** — 谱面标签等社区数据，丰富了海报中的谱面特征展示
- **satori / resvg 及相关维护者** — 矢量与栅格渲染基础
- **maidraw 及其作者与维护者** — draw 部分素材设计与呈现方式的参考
- **Noto、Comfortaa 字体作者与 Google Fonts 等发行方** — 海报可用的中西文显示
- **舞萌 DX 玩家与开发者社区** — 公式、约定与使用反馈
- **所有为本仓库提交问题、建议与代码的贡献者**

若你在衍生作品中使用了 mai-kit 生成的海报或数据，欢迎注明实际使用的查分与数据来源，方便读者追溯。

## 反馈与仓库

- 文档与 API：[快速开始](./getting-started) · [包与职责](./architecture) · [API 参考](/api/)
- 问题与讨论：请前往本项目的 GitHub 仓库提交 Issue 或 Pull Request

感谢使用 mai-kit。
