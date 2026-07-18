import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { rankBestsUpgradeCandidates } from "@mai-kit/analysis";
import { LxnsMaimaiDatabase, MemoryCacheStore } from "@mai-kit/database";
import {
  BEST_HEIGHT,
  BEST_WIDTH,
  buildPosterData,
  Draw,
  POSTER_HEIGHT,
  POSTER_WIDTH,
} from "@mai-kit/draw";
import { createLxnsClient } from "@mai-kit/prober";
import { buildSongLevelMap, scoreMapKey } from "@mai-kit/utils/song";

/**
 * 集成冒烟：prober + database + draw 全部版式。
 *
 * - 玩家：profile / bests / 全量 scores
 * - 加分：全曲 + 定数 + **真实 bests 地板**，`rankBestsUpgradeCandidates`（能抬 B15/B35）
 *
 * 令牌：`LXNS_API_PERSONAL_ACCESS_TOKEN`（仓库根 `.env`）。
 * 运行：`pnpm --filter @mai-kit/draw test:integration:lxns`。
 */

const token = process.env.LXNS_API_PERSONAL_ACCESS_TOKEN;
const hasToken = typeof token === "string" && token.length > 0;
const outputScale = 2;
const minPngBytes = 10_000;
/** 加分目标：至少 SSS+（与 analysis `minRate` 一致） */
const minRate = "sssp" as const;

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

    const [profile, bests, allScores, songList] = await Promise.all([
      me.getProfile(),
      me.getBests(),
      me.getScores(),
      database.getSongList({ notes: true }),
    ]);
    const draw = new Draw({ database });
    const data = await buildPosterData(profile, bests, database);

    const withMax = data.charts.filter((c) => c.dx_max != null).length;
    assert.ok(withMax > 0, `应有 dx_max（实际 ${withMax}/${data.charts.length}）`);
    const withLevel = data.charts.filter((c) => c.level_value != null).length;
    assert.ok(withLevel > 0, `应有 level_value 定数（实际 ${withLevel}/${data.charts.length}）`);

    assert.equal(data.charts.length, 50, "真实 B50 应包含 50 张成绩卡");
    assert.equal(data.charts.slice(0, 15).length, 15, "B15 应有 15 张卡");
    assert.equal(data.charts.slice(15, 50).length, 35, "B35 应有 35 张卡");
    assert.ok(allScores.length > 50, `全曲成绩应多于 B50（实际 ${allScores.length}）`);

    const player = {
      name: profile.name,
      rating: profile.rating,
      course_rank: profile.course_rank,
      class_rank: profile.class_rank,
      icon: profile.icon,
      upload_time: profile.upload_time,
    };
    const footers = {
      scale: outputScale,
      header: "mai-kit",
      footerLeft: "maimai.lxns.net",
      footerRight: "Designed by Amatsuka",
    };
    const boardSize = Draw.getBoardSize(outputScale);

    // 单曲卡：取 B50 第 1 首（已有 dx_max / level_value）
    const topChart = data.charts[0];
    assert.ok(topChart, "B50 至少应有一首成绩");

    // 加分板：全曲 + 定数，按能否抬 B15/B35 排序（不是单曲随便抬达成率）
    const levelMap = buildSongLevelMap(songList.songs);
    const songVersion = new Map<number, number>();
    for (const song of songList.songs) {
      if (song.version !== undefined) songVersion.set(song.id, song.version);
    }
    const versions = [...songVersion.values()];
    assert.ok(versions.length > 0, "LXNS 曲目表应提供数字版本");
    const currentVersion = Math.max(...versions);
    const isNewSong = (score: { id: number }) => songVersion.get(score.id) === currentVersion;

    const upgradeEntries = allScores.flatMap((score) => {
      const levelValue = levelMap.get(scoreMapKey(score));
      if (levelValue == null) return [];
      return [{ score, levelValue }];
    });
    assert.ok(
      upgradeEntries.length > 50,
      `加分候选池应覆盖全曲有定数成绩（实际 ${upgradeEntries.length}）`,
    );
    const ranked = rankBestsUpgradeCandidates(upgradeEntries, {
      currentBests: bests,
      isNewSong,
      minRate,
      limit: 10,
    });
    assert.ok(
      ranked.every((item) => item.targetRate === minRate),
      "候选目标评级应与 minRate 一致",
    );
    assert.ok(ranked.length > 0, "应至少有一首能抬 B50 的加分候选");

    const output = new URL("../../output/", import.meta.url);
    mkdirSync(output, { recursive: true });

    await Promise.all([
      writeRenderedPng(
        "poster",
        "lxns.png",
        POSTER_WIDTH * outputScale,
        POSTER_HEIGHT * outputScale,
        async () => draw.poster(profile, bests, footers),
        output,
      ),
      writeRenderedPng(
        "best50",
        "lxns-best50.png",
        BEST_WIDTH * outputScale,
        BEST_HEIGHT * outputScale,
        async () => draw.best50(player, bests, footers),
        output,
      ),
      writeRenderedPng(
        "best15",
        "lxns-best15.png",
        BEST_WIDTH * outputScale,
        BEST_HEIGHT * outputScale,
        async () => draw.best15(player, bests, footers),
        output,
      ),
      writeRenderedPng(
        "best35",
        "lxns-best35.png",
        BEST_WIDTH * outputScale,
        BEST_HEIGHT * outputScale,
        async () => draw.best35(player, bests, footers),
        output,
      ),
      writeRenderedPng(
        "chart",
        "lxns-chart.png",
        boardSize.width,
        boardSize.height,
        async () => draw.chart(topChart, footers),
        output,
      ),
      writeRenderedPng(
        "upgrades",
        "lxns-upgrades.png",
        boardSize.width,
        boardSize.height,
        async () =>
          draw.upgrades(
            {
              candidates: ranked,
            },
            footers,
          ),
        output,
      ),
    ]);
  },
);
