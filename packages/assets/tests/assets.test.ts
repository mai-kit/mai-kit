import assert from "node:assert/strict";
import test from "node:test";
import {
  getClassRankBadge,
  getCourseRankBadge,
  getDefaultFontBuffers,
  getDxStarAssetRate,
  getDxStarBadge,
  getPlayBonusBadge,
  getRateBadge,
  getResvgWasmBytes,
  getResvgWasmUrl,
} from "@mai-kit/assets";

void test("badge getters return bundled PNG data URIs", () => {
  for (const uri of [
    getRateBadge("sssp"),
    getPlayBonusBadge("app"),
    getCourseRankBadge(23),
    getClassRankBadge(25),
    getDxStarBadge(3),
  ]) {
    assert.match(uri, /^data:image\/png;base64,/u);
    assert.ok(uri.length > 100);
  }
});

void test("badge getters reject missing ids instead of inventing assets", () => {
  assert.throws(() => getCourseRankBadge(24), /missing badge/u);
  assert.throws(() => getClassRankBadge(26), /missing badge/u);
});

void test("DX star asset rate keeps exact three-tier mapping", () => {
  assert.equal(getDxStarAssetRate(0), undefined);
  assert.equal(getDxStarAssetRate(1), 1);
  assert.equal(getDxStarAssetRate(4), 2);
  assert.equal(getDxStarAssetRate(5), 3);
});

void test("font and wasm resources load once from packaged files", async () => {
  const firstFonts = await getDefaultFontBuffers();
  const secondFonts = await getDefaultFontBuffers();
  assert.strictEqual(firstFonts, secondFonts);
  assert.ok(firstFonts.notoSansSc.byteLength > 1_000_000);
  assert.ok(firstFonts.comfortaa.byteLength > 10_000);

  const wasm = new Uint8Array(await getResvgWasmBytes());
  assert.deepEqual([...wasm.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
  assert.equal(getResvgWasmUrl().protocol, "file:");
});
