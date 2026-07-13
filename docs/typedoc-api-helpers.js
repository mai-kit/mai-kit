/**
 * TypeDoc API 文档插件用的纯函数（可单测，无 TypeDoc 运行时依赖）。
 */

/**
 * @param {string} name
 * @returns {string | null}
 */
export function packageNameFromModule(name) {
  const m = /^@mai-kit\/([^/]+)$/.exec(name);
  return m ? m[1] : null;
}

/**
 * @param {string | undefined} fileName
 * @returns {string | null}
 */
export function packageNameFromSource(fileName) {
  if (!fileName) return null;
  const file = fileName.replace(/\\/g, "/");
  const m = /(?:^|\/)packages\/([^/]+)\//.exec(file);
  return m ? m[1] : null;
}

/**
 * @param {string} title
 * @param {string[]} order
 */
export function categoryWeight(title, order) {
  const index = order.indexOf(title);
  if (index >= 0) return index;
  const wildcard = order.indexOf("*");
  return wildcard >= 0 ? wildcard : order.length;
}

/**
 * @param {{ title: string }[]} categories
 * @param {string[]} order
 */
export function sortCategoryList(categories, order) {
  return [...categories].sort(
    (a, b) => categoryWeight(a.title, order) - categoryWeight(b.title, order),
  );
}

/**
 * @param {string[]} moduleNames
 * @param {string[]} packageOrder full names like @mai-kit/shared
 */
export function sortModuleNames(moduleNames, packageOrder) {
  return [...moduleNames].sort((a, b) => {
    const ai = packageOrder.indexOf(a);
    const bi = packageOrder.indexOf(b);
    const aw = ai >= 0 ? ai : packageOrder.length;
    const bw = bi >= 0 ? bi : packageOrder.length;
    if (aw !== bw) return aw - bw;
    return a.localeCompare(b);
  });
}

/**
 * @param {string | undefined} pattern
 * @param {string} value
 */
export function matchesPattern(pattern, value) {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return false;
  }
}

/**
 * @typedef {{ file?: string, name?: string, kind?: string, category: string }} CategoryRule
 * @typedef {{ name: string, kind?: number | string, sources?: Array<{ fileName?: string }> }} CategoryTarget
 */

/**
 * @param {CategoryRule} rule
 * @param {CategoryTarget} reflection
 * @param {Record<string, number>} [kindNames] ReflectionKind name → id
 */
export function ruleMatches(rule, reflection, kindNames = {}) {
  const file = reflection.sources?.[0]?.fileName?.replace(/\\/g, "/") ?? "";
  if (rule.file !== undefined && !matchesPattern(rule.file, file)) return false;
  if (rule.name !== undefined && !matchesPattern(rule.name, reflection.name)) return false;
  if (rule.kind !== undefined) {
    const expected =
      typeof reflection.kind === "string"
        ? reflection.kind
        : Object.entries(kindNames).find(([, id]) => id === reflection.kind)?.[0];
    if (expected !== rule.kind) return false;
  }
  return true;
}

/**
 * @param {CategoryTarget} reflection
 * @param {string} packageName short name e.g. database
 * @param {Record<string, { rules: CategoryRule[] }>} packagesConfig
 * @param {Record<string, number>} [kindNames]
 * @returns {string | null}
 */
export function categoryFor(reflection, packageName, packagesConfig, kindNames = {}) {
  const pkg = packagesConfig[packageName];
  if (!pkg?.rules?.length) return null;
  for (const rule of pkg.rules) {
    if (ruleMatches(rule, reflection, kindNames)) return rule.category;
  }
  return null;
}

/**
 * @param {{ flags?: { isInherited?: boolean }, inheritedFrom?: unknown, sources?: Array<{ fileName?: string }> }} child
 * @param {string | null} modulePackage
 */
export function shouldDrop(child, modulePackage) {
  if (child.flags?.isInherited || child.inheritedFrom) return true;
  if (modulePackage && Array.isArray(child.sources) && child.sources.length > 0) {
    const srcPkg = packageNameFromSource(child.sources[0]?.fileName);
    if (srcPkg && srcPkg !== modulePackage) return true;
  }
  return false;
}

/**
 * 多入口包在 TypeDoc 内以文件名命名；侧栏显示实际导入路径。
 *
 * @param {string} modName
 * @param {{ name: string, kind?: number | string }} child
 * @param {number} [moduleKind] ReflectionKind.Module
 */
export function sidebarItemText(modName, child, moduleKind = 2) {
  const isModule = child.kind === moduleKind || child.kind === "Module" || child.kind === "module";
  if (modName !== "@mai-kit/utils" || !isModule) return child.name;
  return child.name === "index" ? modName : `${modName}/${child.name}`;
}

/**
 * 将模块反射的子符号展开为侧栏叶子（utils 多入口用）。
 *
 * @template T
 * @param {{ name: string, kind?: number | string, children?: T[] }} child
 * @param {number} moduleKind
 * @param {(item: T) => boolean} [keep]
 * @returns {T[] | null} null 表示不展开，用 child 自身
 */
export function expandModuleChildren(child, moduleKind, keep = () => true) {
  const isModule = child.kind === moduleKind || child.kind === "Module" || child.kind === "module";
  if (!isModule || !Array.isArray(child.children) || child.children.length === 0) {
    return null;
  }
  return child.children.filter(keep);
}

/**
 * @param {string} packageShortName e.g. shared
 * @param {string} symbolName
 * @param {string} kindDir e.g. classes | functions | interfaces
 */
export function apiDocPath(packageShortName, symbolName, kindDir) {
  return `/api/@mai-kit/${packageShortName}/${kindDir}/${symbolName}`;
}

/**
 * 为 monorepo 内各包公开符号生成 TypeDoc externalSymbolLinkMappings 片段。
 * key 为 npm 包名；value 为 symbol → site path。
 *
 * @param {Array<{ packageName: string, symbols: Array<{ name: string, kindDir: string }> }>} packages
 * @returns {Record<string, Record<string, string>>}
 */
export function buildExternalSymbolLinkMappings(packages) {
  /** @type {Record<string, Record<string, string>>} */
  const mappings = {};
  for (const pkg of packages) {
    const npm = pkg.packageName.startsWith("@") ? pkg.packageName : `@mai-kit/${pkg.packageName}`;
    const short = packageNameFromModule(npm) ?? pkg.packageName;
    /** @type {Record<string, string>} */
    const map = {};
    for (const sym of pkg.symbols) {
      map[sym.name] = apiDocPath(short, sym.name, sym.kindDir);
    }
    mappings[npm] = map;
  }
  return mappings;
}
