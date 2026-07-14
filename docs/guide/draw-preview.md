<script setup lang="ts">
import DrawGallery from "../.vitepress/components/DrawGallery.vue";
</script>

# Draw 渲染预览

`@mai-kit/draw` 使用同一套视觉语言生成完整 B50 海报、Best 板、单曲成绩卡和加分推荐板。
下面的图片均由仓库内 LXNS 集成测试真实渲染，不是单独制作的设计稿。

<DrawGallery mode="full" />

## 对应 API

| 版式          | PNG            | SVG               | 输入                                        |
| ------------- | -------------- | ----------------- | ------------------------------------------- |
| 完整 B50 海报 | `poster`       | `posterSvg`       | 玩家档案 + `Bests`，或聚合后的 `PosterData` |
| Best 曲目板   | `best15/35/50` | `best15/35/50Svg` | 玩家署名 + `Bests`，库内按源顺序切割        |
| 单曲成绩卡    | `chart`        | `chartSvg`        | 单个 `ScoreChart`                           |
| 加分推荐板    | `upgrades`     | `upgradesSvg`     | analysis 计算后得到的 `UpgradeBoardData`    |

所有方法最后一参都接受 `RenderOptions`，可设置渲染倍率、字体、页脚和素材失败策略。完整调用方式见
[快速开始](./getting-started#可选版式) 与 [`@mai-kit/draw` API](/api/@mai-kit/draw/)。
