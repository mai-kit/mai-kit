import assert from "node:assert/strict";
import test from "node:test";
import {
  DivingFishMaimaiDatabase,
  isLxnsDatabaseError,
  isDivingFishDatabaseError,
  isMaimaiDatabaseError,
  isMaimaiDatabaseNotImplementedError,
  MaimaiDatabaseError,
  MaimaiDatabaseNotImplementedError,
  LxnsMaimaiDatabase,
} from "@mai-kit/database";

void test("MaimaiDatabaseNotImplementedError is package-level and catchable", () => {
  const error = new MaimaiDatabaseNotImplementedError({
    method: "getAliasList",
    adapter: "Diving-Fish",
  });

  assert.equal(error.name, "MaimaiDatabaseNotImplementedError");
  assert.equal(error.method, "getAliasList");
  assert.equal(error.adapter, "Diving-Fish");
  assert.match(error.message, /Diving-Fish does not implement MaimaiDatabase\.getAliasList\(\)/u);
  assert.equal(isMaimaiDatabaseNotImplementedError(error), true);
  assert.equal(isMaimaiDatabaseError(error), true);
  assert.equal(error instanceof MaimaiDatabaseError, true);
  assert.equal(isDivingFishDatabaseError(error), false);
});

void test("Diving-Fish unsupported MaimaiDatabase methods throw NotImplemented", async () => {
  const db = new DivingFishMaimaiDatabase();

  await assert.rejects(
    async () => db.getAliasList(),
    (error: unknown) => {
      assert.equal(isMaimaiDatabaseNotImplementedError(error), true);
      assert.ok(isMaimaiDatabaseNotImplementedError(error));
      assert.equal(error.method, "getAliasList");
      assert.equal(error.adapter, "Diving-Fish");
      assert.equal(isDivingFishDatabaseError(error), false);
      return true;
    },
  );

  await assert.rejects(
    async () => db.getAsset("icon", 1),
    (error: unknown) => {
      assert.equal(isMaimaiDatabaseNotImplementedError(error), true);
      assert.ok(isMaimaiDatabaseNotImplementedError(error));
      assert.equal(error.method, "getAsset");
      assert.match(error.message, /jacket/u);
      return true;
    },
  );
});

void test("LXNS adapter rejects malformed successful responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  try {
    await assert.rejects(
      new LxnsMaimaiDatabase({ baseURL: "https://example.test/api/v0/" }).getSongList(),
      (error: unknown) => isLxnsDatabaseError(error),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("Diving-Fish adapter wraps malformed successful JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  try {
    await assert.rejects(
      new DivingFishMaimaiDatabase({
        baseURL: "https://example.test/api/",
      }).getSongList(),
      (error: unknown) => isDivingFishDatabaseError(error),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
