# @mai-kit/assets

提供评级、FC / FS、段位等徽章，以及 draw 使用的默认字体和 resvg wasm。
Node 从包内文件读取资源，浏览器通过 bundler 或 fetch 加载；公开 API 在两端一致。

## 目录

```
assets/
├── rank/          # sssp … d
├── bonus/         # app / fc / fs / …
├── course_rank/   # 0 … 23  段位
├── class_rank/    # 0 … 25  阶级
├── dx_score/      # 1 / 2 / 3
├── fonts/
│   ├── comfortaa/Comfortaa-Bold.ttf      # Latin 装饰
│   └── noto-sans-sc/NotoSansSC-Bold.otf  # 简体中文 / CJK
└── resvg/
    └── index_bg.wasm   # Web 栅格化
src/index.ts
dist/badges.json        # build 时由上述徽章 PNG 合并；发布运行时读取
```

徽章目录是仓库内的原始素材；发布包只携带单一 `dist/badges.json` 清单以及字体 / wasm，
避免浏览器为每一张徽章分别发请求。

## 徽章 PNG

```ts
import {
  getRateBadge,
  getPlayBonusBadge,
  getCourseRankBadge,
  getClassRankBadge,
  getDxStarAssetRate,
  getDxStarBadge,
} from "@mai-kit/assets";

getRateBadge("sssp"); // → data:image/png;base64,...
getCourseRankBadge(16);
getClassRankBadge(10);

const tier = getDxStarAssetRate(5); // → 3
if (tier) getDxStarBadge(tier);
```

- 首次 `import` 时通过 top-level await 读取一次徽章清单（不再逐图请求）
- 可直接用于 `<img src>` / satori

## 字体与 Web 栅格化

```ts
import { getDefaultFontBuffers, getResvgWasmBytes, getResvgWasmUrl } from "@mai-kit/assets";

const { notoSansSc, comfortaa } = await getDefaultFontBuffers();
const wasm = await getResvgWasmBytes(); // Web initWasm
// bundler 也可跟 getResvgWasmUrl() 打包
```

Web bundler 使用本包时：须能解析/拷贝 `dist/badges.json`、`assets/fonts/*` 与
`assets/resvg/*.wasm`（经 `import.meta.url`）。仓库的 `pnpm test:web` 会用 Vite +
headless Chrome 覆盖这些真实浏览器路径。
