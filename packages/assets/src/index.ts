/**
 * @packageDocumentation
 *
 * `@mai-kit/assets` — 统一静态资源（徽章 / 字体 / resvg wasm）。
 *
 * - 徽章：`getRateBadge` 等 → **data URI**（模块加载时预读）
 * - 字体 / wasm：按需 `ArrayBuffer`（draw 渲染用）
 * - Node `file:` 走 fs，Web 走 fetch；**公开 API 无环境分叉**
 *
 * @example
 * ```ts
 * import { getRateBadge, getCourseRankBadge } from "@mai-kit/assets";
 * const sssPlus = getRateBadge("sssp"); // data:image/png;base64,...
 * ```
 *
 * 徽章返回 data URI，可在 Node 与 Web 中直接作为图片源：
 *
 * ```ts
 * image.src = getCourseRankBadge(10);
 * ```
 *
 * [包与职责](/guide/architecture)
 */

import type { FCType, FSType, RateType } from "@mai-kit/shared";

/** DX 分数星星的素材档位（1–2 星→1，3–4 星→2，5 星→3） */
export type DxStarAssetRate = 1 | 2 | 3;

const RATE_NAMES = [
  "sssp",
  "sss",
  "ssp",
  "ss",
  "sp",
  "s",
  "aaa",
  "aa",
  "a",
  "bbb",
  "bb",
  "b",
  "c",
  "d",
] as const;

const BONUS_NAMES = [
  "app",
  "ap",
  "fcp",
  "fc",
  "fsdp",
  "fsd",
  "fsp",
  "fs",
  "sync",
  "blank",
] as const;

const DX_STAR_NAMES = ["1", "2", "3"] as const;

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions != null &&
    typeof process.versions.node === "string"
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** 读取包内 `assets/<rel>` 为字节（双端） */
async function readPackageBytes(rel: string): Promise<Uint8Array> {
  const url = new URL(`../assets/${rel}`, import.meta.url);
  if (isNodeRuntime() && url.protocol === "file:") {
    const fs = await import("node:fs");
    return new Uint8Array(fs.readFileSync(url));
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`@mai-kit/assets: failed to load ${rel}: HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function loadDataUri(rel: string): Promise<string> {
  const bytes = await readPackageBytes(rel);
  return `data:image/png;base64,${bytesToBase64(bytes)}`;
}

/** category/name → data URI（模块加载时填满） */
const BADGES: Map<string, string> = await (async () => {
  const entries: Array<[string, string]> = [];
  for (const name of RATE_NAMES) entries.push(["rank", name]);
  for (const name of BONUS_NAMES) entries.push(["bonus", name]);
  for (let id = 0; id <= 23; id += 1) entries.push(["course_rank", String(id)]);
  for (let id = 0; id <= 25; id += 1) entries.push(["class_rank", String(id)]);
  for (const name of DX_STAR_NAMES) entries.push(["dx_score", name]);

  const pairs = await Promise.all(
    entries.map(async ([category, name]) => {
      const uri = await loadDataUri(`${category}/${name}.png`);
      return [`${category}/${name}`, uri] as const;
    }),
  );
  return new Map(pairs);
})();

function badge(category: string, name: string | number): string {
  const key = `${category}/${name}`;
  const uri = BADGES.get(key);
  if (!uri) {
    throw new Error(`@mai-kit/assets: missing badge "${key}"`);
  }
  return uri;
}

/**
 * 评级徽章（`sssp`…`d`）→ PNG data URI。
 * @throws 未知 code 时
 *
 * @example
 * ```ts
 * image.src = getRateBadge("sssp");
 * ```
 */
export function getRateBadge(code: RateType): string {
  return badge("rank", code);
}

/**
 * FC / AP / FS 等游玩标记徽章 → PNG data URI。
 * @param code - `FCType` 或 `FSType`
 *
 * @example
 * ```ts
 * image.src = getPlayBonusBadge("app");
 * ```
 */
export function getPlayBonusBadge(code: FCType | FSType): string {
  return badge("bonus", code);
}

/**
 * 课段位徽章 → PNG data URI。
 * @param id - 与 prober `course_rank` 一致（含 0=初学者）
 *
 * @example
 * ```ts
 * image.src = getCourseRankBadge(profile.course_rank);
 * ```
 */
export function getCourseRankBadge(id: number): string {
  return badge("course_rank", id);
}

/**
 * 对战阶级徽章 → PNG data URI。
 * @param id - 与 prober `class_rank` 一致（0–25）
 *
 * @example
 * ```ts
 * image.src = getClassRankBadge(profile.class_rank);
 * ```
 */
export function getClassRankBadge(id: number): string {
  return badge("class_rank", id);
}

/**
 * 将 DX 星数（1–5）映射到素材档位 1|2|3。
 * @returns 0 或非法时 `undefined`（不画星）
 *
 * @example
 * ```ts
 * getDxStarAssetRate(1); // 1
 * getDxStarAssetRate(4); // 2
 * getDxStarAssetRate(5); // 3
 * ```
 */
export function getDxStarAssetRate(dxStar: number): DxStarAssetRate | undefined {
  if (!Number.isFinite(dxStar) || dxStar < 1) return undefined;
  if (dxStar <= 2) return 1;
  if (dxStar <= 4) return 2;
  return 3;
}

/**
 * 单颗 DX 星图 data URI。画 N 星时重复引用 N 次同一 URI。
 *
 * @example
 * ```ts
 * const rate = getDxStarAssetRate(score.dx_star ?? 0);
 * const starUri = rate === undefined ? undefined : getDxStarBadge(rate);
 * ```
 */
export function getDxStarBadge(rate: DxStarAssetRate): string {
  return badge("dx_score", rate);
}

// ─── fonts / wasm（draw 等消费；不预载） ─────────────────────────────────────

/** draw 默认字体的二进制数据，可直接交给 satori。 */
export type DefaultFontBuffers = {
  /** Noto Sans SC Bold — 简体中文 + 通用 CJK */
  notoSansSc: ArrayBuffer;
  /** Comfortaa Bold — Latin 装饰字 */
  comfortaa: ArrayBuffer;
};

let cachedFonts: Promise<DefaultFontBuffers> | undefined;

/**
 * 默认海报字体（源文件在 `assets/fonts/`）。
 * 模块级缓存；satori 等直接用 ArrayBuffer。
 *
 * 用法约定（见 draw `loadFonts` / `fontFamily`）：
 * - 中文 / 日文：Noto Sans SC
 * - 英文装饰：Comfortaa
 *
 * @example
 * ```ts
 * const { notoSansSc, comfortaa } = await getDefaultFontBuffers();
 * const fonts = [
 *   { name: "Noto Sans SC", data: notoSansSc, weight: 700, style: "normal" },
 *   { name: "Comfortaa", data: comfortaa, weight: 700, style: "normal" },
 * ];
 * ```
 */
export async function getDefaultFontBuffers(): Promise<DefaultFontBuffers> {
  cachedFonts ??= (async () => {
    const [cjk, latin] = await Promise.all([
      readPackageBytes("fonts/noto-sans-sc/NotoSansSC-Bold.otf"),
      readPackageBytes("fonts/comfortaa/Comfortaa-Bold.ttf"),
    ]);
    return {
      notoSansSc: toArrayBuffer(cjk),
      comfortaa: toArrayBuffer(latin),
    };
  })();
  return cachedFonts;
}

/**
 * resvg-wasm 二进制 URL（bundler 可据此拷贝/打包）。
 *
 * @example
 * ```ts
 * const wasmUrl = getResvgWasmUrl();
 * console.log(wasmUrl.href);
 * ```
 */
export function getResvgWasmUrl(): URL {
  return new URL("../assets/resvg/index_bg.wasm", import.meta.url);
}

let cachedWasm: Promise<ArrayBuffer> | undefined;

/**
 * resvg-wasm 字节（Web `initWasm` 用）。
 *
 * @example
 * ```ts
 * import { initWasm } from "@resvg/resvg-wasm";
 *
 * await initWasm(await getResvgWasmBytes());
 * ```
 */
export async function getResvgWasmBytes(): Promise<ArrayBuffer> {
  cachedWasm ??= readPackageBytes("resvg/index_bg.wasm").then(toArrayBuffer);
  return cachedWasm;
}
