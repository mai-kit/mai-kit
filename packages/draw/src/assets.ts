/**
 * 占位图、本地图片、默认字体入口。
 * 静态资源（字体 / 徽章 / wasm）统一在 `@mai-kit/assets`，draw 不自带 assets/。
 */
import { getDefaultFontBuffers } from "@mai-kit/assets";
import type { SatoriOptions } from "satori";
import { bytesDataUri, svgDataUri } from "./encoding";
import { DrawError } from "./error";
import { isNodeRuntime } from "./runtime";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * 解析封面/头像路径为 data URI 或可直接使用的 URL。
 * - data: / http(s): / blob: → 原样返回
 * - 本地文件系统路径 → 仅 Node 可读；Web 返回 undefined
 */
export async function loadLocalImage(path?: string): Promise<string | undefined> {
  if (!path) return undefined;
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  if (!isNodeRuntime()) return undefined;

  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const absolute = pathMod.resolve(path);
  if (!fs.existsSync(absolute)) return undefined;
  const ext = pathMod.extname(absolute).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return bytesDataUri(new Uint8Array(fs.readFileSync(absolute)), mime);
}

export function placeholderCover(seed: number, title: string): string {
  const hues = [255, 273, 12, 318, 214, 45, 286, 184, 338, 25];
  const hue = hues[seed % hues.length] ?? 260;
  const safeTitle = escapeXml(title.slice(0, 18));
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue}, 88%, 72%)"/>
          <stop offset=".52" stop-color="hsl(${(hue + 44) % 360}, 82%, 42%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 105) % 360}, 90%, 17%)"/>
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>
      <rect width="180" height="180" fill="url(#g)"/>
      <circle cx="${32 + ((seed * 19) % 96)}" cy="${24 + ((seed * 31) % 118)}" r="58" fill="#fff" opacity=".18" filter="url(#blur)"/>
      <path d="M-12 ${128 - (seed % 5) * 9} C 28 88, 70 170, 118 102 S 186 36, 206 72" fill="none" stroke="#fff" stroke-width="13" opacity=".32"/>
      <path d="M12 32 L156 8 L172 148 L42 172 Z" fill="none" stroke="#1f1550" stroke-width="4" opacity=".35"/>
      <text x="16" y="146" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#fff">${safeTitle}</text>
    </svg>
  `);
}

export function placeholderAvatar(name: string): string {
  const initial = escapeXml(name.slice(0, 1).toUpperCase());
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="a" cx=".3" cy=".25" r=".8">
          <stop offset="0" stop-color="#f4d8ff"/>
          <stop offset=".42" stop-color="#8c6dff"/>
          <stop offset="1" stop-color="#151038"/>
        </radialGradient>
      </defs>
      <rect width="256" height="256" fill="url(#a)"/>
      <circle cx="80" cy="76" r="68" fill="#fff" opacity=".22"/>
      <path d="M36 190 C66 114, 186 104, 220 190 L220 256 L36 256 Z" fill="#211949" opacity=".84"/>
      <circle cx="126" cy="105" r="54" fill="#f5ddea"/>
      <path d="M72 104 C82 42, 176 34, 200 100 C160 82, 126 88, 72 104 Z" fill="#171230"/>
      <text x="128" y="220" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#ffffff">${initial}</text>
    </svg>
  `);
}

let cachedFonts: Promise<SatoriOptions["fonts"]> | undefined;

/**
 * 默认字体：来自 `@mai-kit/assets`。
 *
 * - 注册顺序不影响按字回退；真正选型看 CSS `fontFamily`
 * - 默认 `fontFamily`：`Noto Sans SC, Comfortaa`
 *   - 简体/CJK 走 Noto（全字集，不会因缺简体字出 □）
 *   - Latin 在 Noto 无优先匹配时用 Comfortaa（更圆的装饰体）
 *
 * 可通过 {@link RenderOptions.fonts} 整表覆盖。
 */
export async function loadFonts(): Promise<SatoriOptions["fonts"]> {
  cachedFonts ??= (async () => {
    try {
      const { notoSansSc, comfortaa } = await getDefaultFontBuffers();
      return [
        {
          name: "Noto Sans SC",
          data: notoSansSc,
          weight: 700 as const,
          style: "normal" as const,
        },
        {
          name: "Comfortaa",
          data: comfortaa,
          weight: 700 as const,
          style: "normal" as const,
        },
      ];
    } catch (error) {
      throw new DrawError("Failed to load default fonts from @mai-kit/assets", { cause: error });
    }
  })();
  return cachedFonts;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
