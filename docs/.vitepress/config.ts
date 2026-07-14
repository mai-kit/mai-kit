import { defineConfig } from "vitepress";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const sidebarPath = join(root, "../api/typedoc-sidebar.json");
const repository = process.env.GITHUB_REPOSITORY ?? "mai-kit/mai-kit";
const [repositoryOwner, repositoryName] = repository.split("/");
const isProjectPage =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryOwner !== undefined &&
  repositoryName !== `${repositoryOwner}.github.io`;
const base = process.env.DOCS_BASE ?? (isProjectPage ? `/${repositoryName}/` : "/");

type SidebarItem = {
  text?: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
};

/** TypeDoc 侧栏 link 带 `.md`，VitePress cleanUrls 需要去掉 */
function normalizeSidebar(items: SidebarItem[]): SidebarItem[] {
  return items.map((item) => ({
    ...item,
    link: item.link?.replace(/\.md$/u, ""),
    items: item.items ? normalizeSidebar(item.items) : undefined,
  }));
}

function isSidebarItem(value: unknown): value is SidebarItem {
  if (value == null || typeof value !== "object") return false;
  const item: Record<string, unknown> = { ...value };
  return (
    (item.text === undefined || typeof item.text === "string") &&
    (item.link === undefined || typeof item.link === "string") &&
    (item.collapsed === undefined || typeof item.collapsed === "boolean") &&
    (item.items === undefined || (Array.isArray(item.items) && item.items.every(isSidebarItem)))
  );
}

function loadApiSidebar(): SidebarItem[] {
  const parsed: unknown = JSON.parse(readFileSync(sidebarPath, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every(isSidebarItem)) {
    throw new TypeError(`Invalid TypeDoc sidebar: ${sidebarPath}`);
  }
  return normalizeSidebar(parsed);
}

const apiSidebar = loadApiSidebar();

export default defineConfig({
  title: "mai-kit",
  description: "舞萌 DX 工具集：查成绩、算 Rating、生成成绩海报",
  lang: "zh-CN",
  base,
  head: [["link", { rel: "icon", type: "image/png", href: `${base}favicon.png` }]],
  cleanUrls: true,
  lastUpdated: true,
  // 自动生成的 API 文档在 docs/api（TypeDoc 输出）
  // ignoreDeadLinks: true, // 如有需要再开

  themeConfig: {
    logo: "/mai-kit-chibi.png",
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "渲染预览", link: "/guide/draw-preview" },
      { text: "API", link: "/api/" },
      { text: "关于", link: "/guide/about" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "指南",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "Draw 渲染预览", link: "/guide/draw-preview" },
            { text: "包与职责", link: "/guide/architecture" },
            { text: "关于", link: "/guide/about" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API 参考",
          items: [{ text: "概览", link: "/api/" }, ...apiSidebar],
        },
      ],
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索", buttonAriaLabel: "搜索文档" },
          modal: {
            displayDetails: "显示详细列表",
            resetButtonTitle: "清除查询",
            backButtonTitle: "关闭搜索",
            noResultsText: "没有结果",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
    socialLinks: [{ icon: "github", link: `https://github.com/${repository}` }],
    outline: { label: "本页目录", level: [2, 3] },
    docFooter: { prev: "上一页", next: "下一页" },
    lastUpdated: { text: "最后更新于" },
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
  },
});
