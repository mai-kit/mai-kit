import { getResvgWasmBytes } from "@mai-kit/assets";
import { DrawError } from "./error";
import { isNodeRuntime } from "./runtime";

let wasmReady: Promise<void> | undefined;

/**
 * SVG → PNG（双端）。
 * - Node：`@resvg/resvg-js`（原生 addon）
 * - Web：`@resvg/resvg-wasm`（wasm 字节来自 `@mai-kit/assets`）
 */
export async function rasterizeSvgToPng(svg: string, width: number): Promise<Uint8Array> {
  try {
    if (isNodeRuntime()) {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: width },
      });
      return resvg.render().asPng();
    }

    const { initWasm, Resvg } = await import("@resvg/resvg-wasm");
    wasmReady ??= (async () => {
      await initWasm(await getResvgWasmBytes());
    })();
    await wasmReady;

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
    });
    return resvg.render().asPng();
  } catch (error) {
    throw new DrawError("Failed to rasterize poster to PNG", { cause: error });
  }
}
