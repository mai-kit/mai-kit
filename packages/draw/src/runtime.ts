/**
 * 双端运行时探测。
 * 包内静态资源（字体 / wasm / 徽章）已统一到 `@mai-kit/assets`。
 */

/** 以 process.versions.node 为准，避免 bundler 的 process polyfill 误判 */
export function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions != null &&
    typeof process.versions.node === "string"
  );
}
