/**
 * TypeDoc 精简与导航插件：
 * 1. 按包边界 / 源文件为公开 API 分配语义分类
 * 2. 去掉继承成员（Error.stack / captureStackTrace 等）
 * 3. 去掉源码不在本包内的符号（跨包 re-export）
 * 4. 去掉方法级「实现接口 / 重写成员」关系（类级关系保留）
 *
 * 在 packages 合并之后、写出 markdown 之前执行。
 * 优先挂 Converter.EVENT_END；若仍是单包扁平 project 则按源路径推断。
 * 另挂 Renderer.EVENT_BEGIN 作为合并后的最终兜底。
 */
import { Comment, CommentTag, Converter, ReflectionKind, Renderer } from "typedoc";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {import("typedoc").Application} app
 */
export function load(app) {
  const run = (/** @type {import("typedoc").ProjectReflection} */ project) => {
    slimProject(project);
  };

  // TypeDoc 内置 CategoryPlugin 在 RESOLVE_END -200 执行；提前注入 @category。
  app.converter.on(
    Converter.EVENT_RESOLVE_END,
    (context) => {
      assignCategories(context.project);
    },
    100,
  );

  // 各包子转换结束时（扁平 children）
  app.converter.on(Converter.EVENT_END, (context) => {
    run(context.project);
  });

  // packages 合并后的最终 project
  app.renderer.on(Renderer.EVENT_BEGIN, (event) => {
    sortCategories(event.project, app.options.getValue("categoryOrder"));
    run(event.project);
    linkSources(
      event.project,
      app.options.getValue("sourceLinkTemplate"),
      app.options.getValue("gitRevision"),
    );
  });

  // VitePress theme 先生成默认侧栏；随后按模块语义分类重写。
  app.renderer.postRenderAsyncJobs.push(async (output) => {
    const sidebar = buildSemanticSidebar(app, output.project);
    writeFileSync(
      join(output.outputDirectory, "typedoc-sidebar.json"),
      `${JSON.stringify(sidebar, null, 2)}\n`,
    );
  });
}

/**
 * packages 合并会丢失子项 categoryOrder；渲染前统一重排。
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {string[]} order
 */
function sortCategories(project, order) {
  for (const child of project.children ?? []) {
    if (!child.categories) continue;
    child.categories.sort(
      (a, b) => categoryWeight(a.title, order) - categoryWeight(b.title, order),
    );
  }
}

/**
 * @param {string} title
 * @param {string[]} order
 */
function categoryWeight(title, order) {
  const index = order.indexOf(title);
  if (index >= 0) return index;
  const wildcard = order.indexOf("*");
  return wildcard >= 0 ? wildcard : order.length;
}

/**
 * packages 模式会用各包 basePath 生成 URL；合并后改用仓库相对路径。
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {string} template
 * @param {string} revision
 */
function linkSources(project, template, revision) {
  if (!template) return;
  for (const reflection of Object.values(project.reflections)) {
    if (!("sources" in reflection) || !Array.isArray(reflection.sources)) continue;
    for (const source of reflection.sources) {
      let file = source.fileName.replace(/\\/g, "/");
      if (!/(?:^|\/)packages\//u.test(file)) {
        const packageName = reflectionPackageName(reflection);
        if (packageName) {
          file = `packages/${packageName}/${file.startsWith("src/") ? file : `src/${file}`}`;
        }
      }
      source.url = template
        .replaceAll("{gitRevision}", revision)
        .replaceAll("{path}", file)
        .replaceAll("{line}", String(source.line));
    }
  }
}

/**
 * @param {import("typedoc").Reflection} reflection
 * @returns {string | null}
 */
function reflectionPackageName(reflection) {
  let current = reflection;
  while (current) {
    const packageName = packageNameFromModule(current.name);
    if (packageName) return packageName;
    current = current.parent;
  }
  return null;
}

/**
 * @param {import("typedoc").Application} app
 * @param {import("typedoc").ProjectReflection} project
 */
function buildSemanticSidebar(app, project) {
  const router = app.renderer.router;
  return (project.children ?? [])
    .filter((child) => child.kind === ReflectionKind.Module)
    .map((mod) => {
      const moduleUrl = router.getFullUrl(mod).replace(/index\.md$/u, "");
      const categories = (mod.categories ?? [])
        .map((category) => ({
          text: category.title,
          collapsed: true,
          items: category.children.map((child) => ({
            text: sidebarItemText(mod, child),
            link: `/api/${router.getFullUrl(child)}`,
          })),
        }))
        .filter((category) => category.items.length > 0);

      return {
        text: mod.name,
        link: `/api/${moduleUrl}`,
        collapsed: true,
        items: categories,
      };
    });
}

/**
 * 多入口包在 TypeDoc 内以文件名命名；侧栏显示实际导入路径。
 *
 * @param {import("typedoc").DeclarationReflection} mod
 * @param {import("typedoc").Reflection} child
 */
function sidebarItemText(mod, child) {
  if (mod.name !== "@mai-kit/utils" || child.kind !== ReflectionKind.Module) return child.name;
  return child.name === "index" ? mod.name : `${mod.name}/${child.name}`;
}

/**
 * @param {import("typedoc").ProjectReflection} project
 */
function assignCategories(project) {
  const children = project.children ?? [];
  const packageName =
    packageNameFromModule(project.packageName ?? "") ?? inferPackageFromChildren(children);
  if (!packageName) return;

  for (const child of children) {
    const category = categoryFor(child, packageName);
    if (!category) continue;
    const signatureComment = child.signatures?.find((signature) => signature.comment)?.comment;
    const comment = child.comment ?? signatureComment ?? new Comment();
    if (comment.getTag("@category")) continue;
    if (!child.comment && !signatureComment) child.comment = comment;
    comment.blockTags.push(new CommentTag("@category", [{ kind: "text", text: category }]));
  }
}

/**
 * @param {import("typedoc").DeclarationReflection} reflection
 * @param {string} packageName
 * @returns {string | null}
 */
function categoryFor(reflection, packageName) {
  const file = reflection.sources?.[0]?.fileName?.replace(/\\/g, "/") ?? "";

  if (packageName === "assets") {
    if (/Font|font/u.test(reflection.name)) return "字体";
    if (/Resvg|Wasm/u.test(reflection.name)) return "栅格化";
    return "徽章";
  }

  if (packageName === "shared") {
    return file.endsWith("/error.ts") ? "错误" : "领域类型";
  }

  if (packageName === "database") {
    if (file.includes("/adapters/lxns/")) return "LXNS 适配";
    if (file.includes("/adapters/diving-fish/")) return "Diving-Fish 适配";
    if (file.endsWith("/cache.ts")) return "缓存";
    if (file.endsWith("/error.ts")) return "错误";
    return "接口与模型";
  }

  if (packageName === "prober") {
    if (file.includes("/adapters/lxns/")) return "LXNS 适配";
    if (file.includes("/adapters/diving-fish/")) return "Diving-Fish 适配";
    if (file.endsWith("/error.ts")) return "错误";
    return "接口与模型";
  }

  if (packageName === "draw") {
    if (file.includes("/components/") || file.endsWith("/formatters.ts")) return "布局与格式化";
    if (file.endsWith("/error.ts")) return "错误";
    return "绘制接口";
  }

  if (packageName === "analysis") {
    if (file.endsWith("/bests.ts")) return "B50 分析";
    if (file.endsWith("/upgrades.ts")) return "升分分析";
    if (file.endsWith("/compare.ts")) return "快照对比";
    return "接口与模型";
  }

  if (packageName === "utils") {
    if (reflection.kind === ReflectionKind.Module) {
      if (reflection.name === "index") return "常用公式";
      if (reflection.name === "judgement") return "判定计算";
      if (reflection.name === "song") return "谱面索引";
    }
    if (
      file.endsWith("/judgement.ts") ||
      /Judgement|Penalty|NOTE_|BREAK_|NoteType|ChartNoteCounts|calculateAchievement|calculateChartDxScore|calculateDxScore|calculateMaxAchievementScores|dxMaxFromNoteCounts|normalizeBreak|normalizeChart|normalizeJudgement|normalizeNote|noteTotal/u.test(
        reflection.name,
      )
    ) {
      return "判定计算";
    }
    if (
      /\/(achievement|rate|rating)\.ts$/u.test(file) ||
      /normalizeAchievement|minimumAchievementForRate|rateFromAchievement|calculateDxRating|dxRatingCoefficient|requiredLevelValue/u.test(
        reflection.name,
      )
    ) {
      return "Rating 与评级";
    }
    if (file.endsWith("/dx-score.ts") || /Dx/u.test(reflection.name)) return "DX 分";
    return "谱面索引";
  }

  return null;
}

/**
 * @param {import("typedoc").ProjectReflection} project
 */
function slimProject(project) {
  const children = project.children ?? [];
  const hasModules = children.some((c) => c.kind === ReflectionKind.Module);

  if (hasModules) {
    for (const mod of [...children]) {
      if (mod.kind !== ReflectionKind.Module) continue;
      const modPkg = packageNameFromModule(mod.name);
      slimContainer(project, mod, modPkg);
    }
    return;
  }

  // 单包转换：从「本包」源文件占多数的路径推断包名
  const modPkg = inferPackageFromChildren(children);
  slimContainer(project, project, modPkg);
}

/**
 * @param {import("typedoc").DeclarationReflection[]} children
 * @returns {string | null}
 */
function inferPackageFromChildren(children) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const child of children) {
    const pkg = packageNameFromSource(child.sources?.[0]?.fileName);
    if (!pkg) continue;
    // 忽略 shared/dist 上的再导出，避免把当前包误判成 shared
    if (
      pkg === "shared" &&
      /\/shared\/dist\//.test(child.sources?.[0]?.fileName?.replace(/\\/g, "/") ?? "")
    ) {
      continue;
    }
    counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
  }
  let best = null;
  let n = 0;
  for (const [pkg, count] of counts) {
    if (count > n) {
      best = pkg;
      n = count;
    }
  }
  return best;
}

/**
 * @param {string} name
 * @returns {string | null}
 */
function packageNameFromModule(name) {
  const m = /^@mai-kit\/([^/]+)$/.exec(name);
  return m ? m[1] : null;
}

/**
 * @param {string | undefined} fileName
 * @returns {string | null}
 */
function packageNameFromSource(fileName) {
  if (!fileName) return null;
  const file = fileName.replace(/\\/g, "/");
  const m = /(?:^|\/)packages\/([^/]+)\//.exec(file);
  return m ? m[1] : null;
}

/**
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").ContainerReflection} container
 * @param {string | null} modulePackage
 */
function slimContainer(project, container, modulePackage) {
  stripMemberRelations(container);

  if (container.children?.length) {
    for (const child of [...container.children]) {
      if (shouldDrop(child, modulePackage)) {
        project.removeReflection(child);
        continue;
      }
      // 类/接口成员：去掉继承属性与方法
      slimContainer(project, child, modulePackage);
    }
  }

  // 去掉删光后的空分组，避免「## 枚举」空表、「#### 属性」空壳
  pruneEmptyGroups(container);
}

/**
 * @param {import("typedoc").Reflection} reflection
 */
function stripMemberRelations(reflection) {
  if ("implementationOf" in reflection) reflection.implementationOf = undefined;
  if ("overwrites" in reflection) reflection.overwrites = undefined;

  if ("signatures" in reflection && Array.isArray(reflection.signatures)) {
    for (const signature of reflection.signatures) stripMemberRelations(signature);
  }
  if ("indexSignatures" in reflection && Array.isArray(reflection.indexSignatures)) {
    for (const signature of reflection.indexSignatures) stripMemberRelations(signature);
  }
  if ("getSignature" in reflection && reflection.getSignature) {
    stripMemberRelations(reflection.getSignature);
  }
  if ("setSignature" in reflection && reflection.setSignature) {
    stripMemberRelations(reflection.setSignature);
  }
}

/**
 * @param {import("typedoc").ContainerReflection} container
 */
function pruneEmptyGroups(container) {
  if (Array.isArray(container.groups)) {
    for (const group of container.groups) {
      group.children = group.children.filter((c) => container.children?.includes(c));
    }
    container.groups = container.groups.filter((g) => g.children.length > 0);
    if (container.groups.length === 0) delete container.groups;
  }
  if (Array.isArray(container.categories)) {
    for (const category of container.categories) {
      category.children = category.children.filter((c) => container.children?.includes(c));
    }
    container.categories = container.categories.filter((c) => c.children.length > 0);
    if (container.categories.length === 0) delete container.categories;
  }
}

/**
 * @param {import("typedoc").Reflection} child
 * @param {string | null} modulePackage
 */
function shouldDrop(child, modulePackage) {
  // DeclarationReflection 字段在运行时存在；用可选链避免强制断言
  const flags = "flags" in child ? child.flags : undefined;
  const inheritedFrom = "inheritedFrom" in child ? child.inheritedFrom : undefined;
  const sources = "sources" in child ? child.sources : undefined;

  if (flags?.isInherited || inheritedFrom) return true;
  if (modulePackage && Array.isArray(sources) && sources.length > 0) {
    const srcPkg = packageNameFromSource(sources[0]?.fileName);
    if (srcPkg && srcPkg !== modulePackage) return true;
  }

  return false;
}
