/**
 * TypeDoc 精简与导航插件：
 * 1. 按 docs/api-categories.json 为公开 API 分配语义分类（未匹配则报错）
 * 2. 去掉继承成员（Error.stack / captureStackTrace 等）
 * 3. 去掉源码不在本包内的符号（跨包 re-export）
 * 4. 去掉方法级「实现接口 / 重写成员」关系（类级关系保留）
 * 5. 按依赖心智重排侧栏包序；utils 多入口展开到具体导出
 * 6. 修正 monorepo 源码 GitHub 链接；合并 shared 等跨包 external 链接映射
 *
 * 生命周期（为何 slim 挂两次）：
 * - Converter.EVENT_END：各**单包**转换结束时，project 仍是扁平 children，先精简一轮。
 * - Renderer.EVENT_BEGIN：packages **合并后**的最终 project，再 sort + slim + 源码链接
 *   （合并会带回跨包 re-export / 打乱 category 顺序，必须再跑）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Comment, CommentTag, Converter, ReflectionKind, Renderer } from "typedoc";

import {
  categoryFor,
  packageNameFromModule,
  packageNameFromSource,
  sidebarItemText,
  sortCategoryList,
  sortModuleNames,
  shouldDrop,
  expandModuleChildren,
} from "./typedoc-api-helpers.js";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const categoriesConfig = JSON.parse(readFileSync(join(pluginDir, "api-categories.json"), "utf8"));

/** ReflectionKind 名 → 数值（去掉 TS 枚举反向映射） */
const KIND_NAMES = Object.fromEntries(
  Object.entries(ReflectionKind)
    .filter(([k, v]) => typeof v === "number" && Number.isNaN(Number(k)))
    .map(([k, v]) => [k, v]),
);

/**
 * @param {import("typedoc").Application} app
 */
export function load(app) {
  mergeExternalLinkMappings(app);

  const runSlim = (/** @type {import("typedoc").ProjectReflection} */ project) => {
    slimProject(project);
  };

  // TypeDoc 内置 CategoryPlugin 在 RESOLVE_END -200 执行；提前注入 @category。
  app.converter.on(
    Converter.EVENT_RESOLVE_END,
    (context) => {
      assignCategories(context.project, app.logger);
    },
    100,
  );

  // 单包转换结束（扁平 children）
  app.converter.on(Converter.EVENT_END, (context) => {
    runSlim(context.project);
  });

  // packages 合并后的最终 project
  app.renderer.on(Renderer.EVENT_BEGIN, (event) => {
    sortCategories(event.project, app.options.getValue("categoryOrder"));
    runSlim(event.project);
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
 * 把 shared（及配置中的）公开符号补进 externalSymbolLinkMappings，
 * 避免类型签名 / 注释里跨包名落成纯文本。
 *
 * @param {import("typedoc").Application} app
 */
function mergeExternalLinkMappings(app) {
  /** @type {Record<string, Record<string, string>>} */
  const extra = {
    "@mai-kit/shared": {
      RateType: "/api/@mai-kit/shared/type-aliases/RateType",
      SongType: "/api/@mai-kit/shared/type-aliases/SongType",
      FCType: "/api/@mai-kit/shared/type-aliases/FCType",
      FSType: "/api/@mai-kit/shared/type-aliases/FSType",
      LevelIndex: "/api/@mai-kit/shared/enumerations/LevelIndex",
      Collection: "/api/@mai-kit/shared/interfaces/Collection",
      CollectionType: "/api/@mai-kit/shared/type-aliases/CollectionType",
      CollectionRequired: "/api/@mai-kit/shared/interfaces/CollectionRequired",
      CollectionRequiredSong: "/api/@mai-kit/shared/interfaces/CollectionRequiredSong",
      MaiKitError: "/api/@mai-kit/shared/classes/MaiKitError",
      MaiKitErrorOptions: "/api/@mai-kit/shared/interfaces/MaiKitErrorOptions",
      isMaiKitError: "/api/@mai-kit/shared/functions/isMaiKitError",
    },
  };

  try {
    const current = app.options.getValue("externalSymbolLinkMappings") ?? {};
    const merged = { ...current };
    for (const [pkg, map] of Object.entries(extra)) {
      merged[pkg] = { ...(merged[pkg] ?? {}), ...map };
    }
    app.options.setValue("externalSymbolLinkMappings", merged);
  } catch {
    // 选项尚未注册时忽略；typedoc.json 仍保有基线映射
  }
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
    child.categories = sortCategoryList(child.categories, order);
  }
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
  const modules = (project.children ?? []).filter((child) => child.kind === ReflectionKind.Module);
  const orderedNames = sortModuleNames(
    modules.map((m) => m.name),
    categoriesConfig.packageOrder ?? [],
  );
  const byName = new Map(modules.map((m) => [m.name, m]));

  return orderedNames
    .map((name) => byName.get(name))
    .filter(Boolean)
    .map((mod) => {
      const moduleUrl = router.getFullUrl(mod).replace(/index\.md$/u, "");
      const categories = (mod.categories ?? [])
        .map((category) => ({
          text: category.title,
          collapsed: true,
          items: flattenCategoryItems(mod, category.children, router),
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
 * 分类下的模块入口（如 utils/judgement）展开为「入口 + 子导出」。
 *
 * @param {import("typedoc").DeclarationReflection} mod
 * @param {import("typedoc").DeclarationReflection[]} children
 * @param {import("typedoc").Router} router
 */
function flattenCategoryItems(mod, children, router) {
  /** @type {{ text: string, link: string }[]} */
  const items = [];

  for (const child of children) {
    const expanded = expandModuleChildren(
      child,
      ReflectionKind.Module,
      (c) => !shouldDropReflection(c, packageNameFromModule(mod.name)),
    );

    if (expanded) {
      items.push({
        text: sidebarItemText(mod.name, child, ReflectionKind.Module),
        link: `/api/${router.getFullUrl(child)}`,
      });
      for (const leaf of expanded) {
        // 跳过嵌套 Module / 命名空间噪音
        if (leaf.kind === ReflectionKind.Module) continue;
        items.push({
          text: leaf.name,
          link: `/api/${router.getFullUrl(leaf)}`,
        });
      }
      continue;
    }

    items.push({
      text: sidebarItemText(mod.name, child, ReflectionKind.Module),
      link: `/api/${router.getFullUrl(child)}`,
    });
  }

  return items;
}

/**
 * @param {import("typedoc").Reflection} child
 * @param {string | null} modulePackage
 */
function shouldDropReflection(child, modulePackage) {
  return shouldDrop(
    {
      flags: "flags" in child ? child.flags : undefined,
      inheritedFrom: "inheritedFrom" in child ? child.inheritedFrom : undefined,
      sources: "sources" in child ? child.sources : undefined,
    },
    modulePackage,
  );
}

/**
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").Logger} logger
 */
function assignCategories(project, logger) {
  const children = project.children ?? [];
  const packageName =
    packageNameFromModule(project.packageName ?? "") ?? inferPackageFromChildren(children);
  if (!packageName) return;

  if (!categoriesConfig.packages?.[packageName]) {
    logger.error(`[typedoc-plugin-api] api-categories.json 缺少包 "${packageName}" 的分类规则`);
    return;
  }

  for (const child of children) {
    // 已有手写 @category 不覆盖
    const signatureComment = child.signatures?.find((signature) => signature.comment)?.comment;
    const existing = child.comment ?? signatureComment;
    if (existing?.getTag("@category")) continue;

    const category = categoryFor(
      {
        name: child.name,
        kind: child.kind,
        sources: child.sources,
      },
      packageName,
      categoriesConfig.packages,
      KIND_NAMES,
    );

    if (!category) {
      const file = child.sources?.[0]?.fileName ?? "(no source)";
      logger.error(
        `[typedoc-plugin-api] 未匹配分类: ${packageName}::${child.name} (${file})。请更新 docs/api-categories.json 或在源码写 @category。`,
      );
      continue;
    }

    const comment = existing ?? new Comment();
    if (!child.comment && !signatureComment) child.comment = comment;
    comment.blockTags.push(new CommentTag("@category", [{ kind: "text", text: category }]));
  }
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
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").ContainerReflection} container
 * @param {string | null} modulePackage
 */
function slimContainer(project, container, modulePackage) {
  stripMemberRelations(container);

  if (container.children?.length) {
    for (const child of [...container.children]) {
      if (shouldDropReflection(child, modulePackage)) {
        project.removeReflection(child);
        continue;
      }
      slimContainer(project, child, modulePackage);
    }
  }

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
