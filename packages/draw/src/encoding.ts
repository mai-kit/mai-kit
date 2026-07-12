/** 双端可用的 base64 / data URI 工具（不依赖 Node Buffer）。 */

export function bytesToBase64(bytes: Uint8Array): string {
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

export function bytesDataUri(bytes: Uint8Array, mime = "image/png"): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export function svgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  return `data:image/svg+xml;base64,${bytesToBase64(bytes)}`;
}
