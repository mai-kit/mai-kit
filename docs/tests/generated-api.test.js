import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const apiRoot = new URL("../api/", import.meta.url);

async function readApi(path) {
  return readFile(new URL(path, apiRoot), "utf8");
}

async function readAllGeneratedMarkdown() {
  const paths = await readdir(apiRoot, { recursive: true });
  const markdown = paths.filter((path) => path.endsWith(".md"));
  return Promise.all(markdown.map(async (path) => readApi(path)));
}

void test("API plugin removes inherited Error members", async () => {
  const pages = await readAllGeneratedMarkdown();
  const api = pages.join("\n");

  assert.doesNotMatch(api, /captureStackTrace|prepareStackTrace/);
});

void test("API plugin removes cross-package re-exports", async () => {
  const prober = await readApi("@mai-kit/prober/index.md");

  assert.doesNotMatch(prober, /\bLevelIndex\b/u);
});

void test("API plugin keeps class interfaces without repeating member relations", async () => {
  const database = await readApi("@mai-kit/database/classes/LxnsMaimaiDatabase.md");

  assert.match(database, /^## 实现$/mu);
  assert.doesNotMatch(database, /^#{4,6} (接口|实现了|重写|重写了)$/gmu);
});

void test("public signatures do not reference undocumented helper types", async () => {
  const pages = await readAllGeneratedMarkdown();
  const api = pages.join("\n");
  const database = await readApi("@mai-kit/database/index.md");

  assert.doesNotMatch(api, /\bIfDefined\b/u);
  // 水鱼公开适配面：统计模型保留；原始 music_data 条目与 map 函数已收出包根
  assert.match(database, /DivingFishChartStats/u);
  assert.doesNotMatch(database, /DivingFishMusicEntry/u);
});

void test("package and base error documentation are attached to the intended reflections", async () => {
  const assets = await readApi("@mai-kit/assets/index.md");
  const errorClass = await readApi("@mai-kit/shared/classes/MaiKitError.md");
  const errorOptions = await readApi("@mai-kit/shared/interfaces/MaiKitErrorOptions.md");

  assert.match(assets, /统一静态资源/u);
  assert.match(errorClass, /领域错误统一基类/u);
  assert.doesNotMatch(errorOptions, /领域错误统一基类/u);
});

void test("advanced draw exports remain discoverable", async () => {
  const draw = await readApi("@mai-kit/draw/index.md");

  assert.match(draw, /B50Poster/u);
  assert.match(draw, /BestBoardLayout/u);
  assert.match(draw, /formatDxScore/u);
});

void test("docs omit private class members and unexported adapter helpers", async () => {
  const draw = await readApi("@mai-kit/draw/classes/Draw.md");
  assert.doesNotMatch(draw, /resolvePosterInput|renderPosterSvg|renderBestSvg|enrichChart/u);

  const pages = await readAllGeneratedMarkdown();
  const api = pages.join("\n");
  // 水鱼 map / 标签快照 / coverId 已收出包根公开面，不应再出现在 API 文档
  assert.doesNotMatch(api, /mapDivingFishRecord|mapDivingFishBestsFromCharts|divingFishCoverId/u);
  assert.doesNotMatch(api, /getLocalChartTags|getChartTagSnapshot|DXRATING_TAGS_SOURCE_URL/u);
  // 已扁平化：不应再导出中间绘制句柄
  assert.doesNotMatch(api, /PlayerDraw|ChartDraw|UpgradesDraw|withPlayer|withChart|withUpgrades/u);
});

void test("public API tables do not contain empty descriptions", async () => {
  const pages = await readAllGeneratedMarkdown();

  for (const page of pages) assert.doesNotMatch(page, /\| - \|/u);
});

void test("sidebar uses semantic API categories", async () => {
  const sidebarText = await readApi("typedoc-sidebar.json");
  const sidebar = JSON.parse(sidebarText);

  assert.match(sidebarText, /"text": "接口与模型"/u);
  assert.match(sidebarText, /"text": "LXNS 适配"/u);
  assert.match(sidebarText, /"text": "Diving-Fish 适配"/u);
  assert.match(sidebarText, /"text": "布局与格式化"/u);
  assert.match(sidebarText, /"text": "常用公式"/u);
  assert.match(sidebarText, /"text": "判定计算"/u);
  assert.match(sidebarText, /"text": "判定求解"/u);
  assert.match(sidebarText, /"text": "判定反推"/u);
  assert.match(sidebarText, /"text": "谱面索引"/u);
  assert.match(sidebarText, /"text": "B50 分析"/u);
  assert.match(sidebarText, /"text": "升分分析"/u);
  assert.match(sidebarText, /"text": "快照对比"/u);

  // 依赖心智序：shared → utils → judgement-solver → judgement-inference → database → prober → assets → analysis → draw
  assert.deepEqual(
    sidebar.map((item) => item.text),
    [
      "@mai-kit/shared",
      "@mai-kit/utils",
      "@mai-kit/judgement-solver",
      "@mai-kit/judgement-inference",
      "@mai-kit/database",
      "@mai-kit/prober",
      "@mai-kit/assets",
      "@mai-kit/analysis",
      "@mai-kit/draw",
    ],
  );

  for (const packageItem of sidebar) {
    assert.ok(packageItem.items.length > 0, `${packageItem.text} has no API categories`);
    for (const category of packageItem.items) {
      assert.ok(category.items.length > 0, `${packageItem.text}/${category.text} is empty`);
    }
  }
});

void test("utils public entry points remain separated in API docs", async () => {
  const utils = await readApi("@mai-kit/utils/index.md");
  const root = await readApi("@mai-kit/utils/index/index.md");
  const judgement = await readApi("@mai-kit/utils/judgement/index.md");
  const song = await readApi("@mai-kit/utils/song/index.md");

  assert.match(utils, /@mai-kit\/utils\/judgement/u);
  assert.match(utils, /@mai-kit\/utils\/song/u);
  const sidebar = JSON.parse(await readApi("typedoc-sidebar.json"));
  const utilsSidebar = sidebar.find((item) => item.text === "@mai-kit/utils");
  assert.ok(utilsSidebar);

  const judgementCategory = utilsSidebar.items.find((item) => item.text === "判定计算");
  assert.ok(judgementCategory);
  const judgementTexts = judgementCategory.items.map((item) => item.text);
  assert.ok(judgementTexts.includes("@mai-kit/utils/judgement"));
  assert.ok(judgementTexts.includes("normalizeChartJudgements"));
  assert.ok(judgementTexts.includes("calculateAchievement"));

  const songCategory = utilsSidebar.items.find((item) => item.text === "谱面索引");
  assert.ok(songCategory);
  const songTexts = songCategory.items.map((item) => item.text);
  assert.ok(songTexts.includes("@mai-kit/utils/song"));
  assert.ok(songTexts.includes("buildSongDxMaxMap"));

  const formulaCategory = utilsSidebar.items.find((item) => item.text === "常用公式");
  assert.ok(formulaCategory);
  const formulaTexts = formulaCategory.items.map((item) => item.text);
  assert.ok(formulaTexts.includes("@mai-kit/utils"));
  assert.ok(formulaTexts.includes("calculateDxRating"));

  assert.doesNotMatch(root, /normalizeChartJudgements\.md/u);
  assert.match(judgement, /normalizeChartJudgements/u);
  assert.match(song, /buildSongDxMaxMap/u);
});

void test("API pages link to repository sources with full monorepo paths", async () => {
  const pages = await readAllGeneratedMarkdown();
  const api = pages.join("\n");
  const draw = await readApi("@mai-kit/draw/classes/Draw.md");
  const assets = await readApi("@mai-kit/assets/functions/getRateBadge.md");
  const utils = await readApi("@mai-kit/utils/song/functions/buildSongDxMaxMap.md");

  assert.match(draw, /github\.com\/wsyzxjn\/mai-kit\/blob\/main\/packages\/draw\/src\/draw\.ts#L/u);
  assert.match(assets, /blob\/main\/packages\/assets\/src\/index\.ts#L/u);
  assert.match(utils, /blob\/main\/packages\/utils\/src\/song-maps\.ts#L/u);
  assert.doesNotMatch(api, /github\.com\/wsyzxjn\/mai-kit\/blob\/main\/(?!packages\/)/u);
});

void test("key public APIs include usage examples", async () => {
  const paths = [
    "@mai-kit/shared/interfaces/Collection.md",
    "@mai-kit/utils/judgement/functions/calculateAchievement.md",
    "@mai-kit/judgement-solver/functions/evaluateJudgementPlan.md",
    "@mai-kit/judgement-solver/functions/solveJudgementLimit.md",
    "@mai-kit/judgement-solver/functions/solveJudgementLimits.md",
    "@mai-kit/judgement-inference/functions/inferJudgementDistribution.md",
    "@mai-kit/database/classes/DatabaseCache.md",
    "@mai-kit/prober/interfaces/Score.md",
    "@mai-kit/assets/functions/getDefaultFontBuffers.md",
    "@mai-kit/analysis/functions/recalculateBests.md",
    "@mai-kit/draw/interfaces/PosterData.md",
  ];

  const pages = await Promise.all(paths.map(async (path) => [path, await readApi(path)]));
  for (const [path, page] of pages) {
    assert.match(page, /^## 示例$/mu, `${path} is missing an example`);
  }
});

void test("package pages include usage examples", async () => {
  const database = await readApi("@mai-kit/database/index.md");
  const draw = await readApi("@mai-kit/draw/index.md");
  const prober = await readApi("@mai-kit/prober/index.md");
  const analysis = await readApi("@mai-kit/analysis/index.md");
  const judgementSolver = await readApi("@mai-kit/judgement-solver/index.md");
  const judgementInference = await readApi("@mai-kit/judgement-inference/index.md");

  assert.match(database, /^## 启用缓存$/mu);
  assert.match(draw, /^## 处理 PNG 结果$/mu);
  assert.match(prober, /^## 错误处理$/mu);
  assert.match(analysis, /^## 示例$/mu);
  assert.match(analysis, /^\*\*重算 Best50\*\*$/mu);
  assert.match(judgementSolver, /^## 示例$/mu);
  assert.match(judgementSolver, /^\*\*已有失误后的剩余容错\*\*$/mu);
  assert.match(judgementInference, /^## 示例$/mu);
});

void test("cross-package error docs link to shared MaiKitError", async () => {
  const database = await readApi("@mai-kit/database/classes/MaimaiDatabaseError.md");
  const prober = await readApi("@mai-kit/prober/classes/ProberError.md");
  const draw = await readApi("@mai-kit/draw/classes/DrawError.md");

  assert.match(database, /\/api\/@mai-kit\/shared\/classes\/MaiKitError/u);
  assert.match(prober, /\/api\/@mai-kit\/shared\/classes\/MaiKitError/u);
  assert.match(draw, /\/api\/@mai-kit\/shared\/classes\/MaiKitError/u);
  // @see {@link …} 应产出可点击链接，而不是纯文本参阅项
  assert.match(database, /\[isMaimaiDatabaseError\]/u);
  assert.match(database, /\[MaiKitError\]/u);
});
