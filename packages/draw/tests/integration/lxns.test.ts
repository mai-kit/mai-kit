import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { LxnsMaimaiDatabase, MemoryCacheStore } from "@mai-kit/database";
import { BEST_HEIGHT, BEST_WIDTH, Draw, POSTER_HEIGHT, POSTER_WIDTH } from "@mai-kit/draw";
import { createLxnsClient } from "@mai-kit/prober";

/**
 * 集成冒烟：prober（玩家 B50）+ database（曲目物量 / 素材）+ draw（海报）。
 *
 * - 玩家：`@mai-kit/prober` personal token → profile + bests
 * - 静态数据 / 素材：`@mai-kit/database`（标签 + 曲目 notes；dx_max 由 draw 内部算）
 * - 渲染：海报 + Best50 / Best15 / Best35（均为 16:9）
 *
 * 令牌：`LXNS_API_PERSONAL_ACCESS_TOKEN`（仓库根 `.env`）。
 * 运行：`pnpm --filter @mai-kit/draw test:integration:lxns`。
 * 未设置时 skip。
 */

const token = process.env.LXNS_API_PERSONAL_ACCESS_TOKEN;
const hasToken = typeof token === "string" && token.length > 0;
const outputScale = 2;
const minPngBytes = 10_000;

/** PNG IHDR 宽高（大端 uint32，偏移 16 / 20） */
function pngDimensions(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** 是否为 PNG：文件头 8 字节魔数 `\x89PNG\r\n\x1a\n` */
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

async function writeRenderedPng(
  name: string,
  file: string,
  width: number,
  height: number,
  render: () => Promise<Uint8Array>,
  outputDir: URL,
): Promise<void> {
  const png = await render();
  assert.ok(png.length > minPngBytes, `${name} PNG 应有实质内容`);
  assert.ok(isPng(png), `${name} 应为合法 PNG（文件头魔数）`);
  assert.deepEqual(pngDimensions(png), { width, height }, `${name} 画布尺寸应正确`);
  writeFileSync(new URL(file, outputDir), png);
}

void test(
  "lxns integration: prober + database + draw → all PNG layouts",
  { skip: !hasToken },
  async () => {
    assert.ok(hasToken && token, "LXNS_API_PERSONAL_ACCESS_TOKEN 未设置");

    const database = new LxnsMaimaiDatabase({
      cache: {
        store: new MemoryCacheStore({ maxEntries: 256 }),
        ttlMs: 60_000,
      },
    });
    const me = createLxnsClient({ personalAccessToken: token }).me();

    const [profile, bests] = await Promise.all([me.getProfile(), me.getBests()]);

    const renderer = await new Draw({ database }).withPlayer(profile, bests);
    const { data } = renderer;

    const withMax = data.charts.filter((c) => c.dx_max != null).length;
    assert.ok(withMax > 0, `应有 dx_max（实际 ${withMax}/${data.charts.length}）`);
    const withLevel = data.charts.filter((c) => c.level_value != null).length;
    assert.ok(withLevel > 0, `应有 level_value 定数（实际 ${withLevel}/${data.charts.length}）`);

    assert.equal(data.charts.length, 50, "真实 B50 应包含 50 张成绩卡");
    assert.equal(data.charts.slice(0, 15).length, 15, "B15 应有 15 张卡");
    assert.equal(data.charts.slice(15, 50).length, 35, "B35 应有 35 张卡");

    const footers = {
      scale: outputScale,
      footerLeft: "maimai.lxns.net",
      footerRight: "Designed by Amatsuka",
    };
    const jobs = [
      {
        name: "poster" as const,
        file: "lxns.png",
        width: POSTER_WIDTH * outputScale,
        height: POSTER_HEIGHT * outputScale,
      },
      {
        name: "best50" as const,
        file: "lxns-best50.png",
        width: BEST_WIDTH * outputScale,
        height: BEST_HEIGHT * outputScale,
      },
      {
        name: "best15" as const,
        file: "lxns-best15.png",
        width: BEST_WIDTH * outputScale,
        height: BEST_HEIGHT * outputScale,
      },
      {
        name: "best35" as const,
        file: "lxns-best35.png",
        width: BEST_WIDTH * outputScale,
        height: BEST_HEIGHT * outputScale,
      },
    ];

    const output = new URL("../../output/", import.meta.url);
    mkdirSync(output, { recursive: true });
    await Promise.all(
      jobs.map(async ({ name, file, width, height }) => {
        await writeRenderedPng(
          name,
          file,
          width,
          height,
          async () => await renderer.render(name, footers),
          output,
        );
      }),
    );
  },
);
