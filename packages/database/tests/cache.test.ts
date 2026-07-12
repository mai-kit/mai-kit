import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseCache, LxnsMaimaiDatabase, MemoryCacheStore } from "@mai-kit/database";

void test("MemoryCacheStore evicts the least recently used entry", async () => {
  const store = new MemoryCacheStore({ maxEntries: 2 });
  await store.set("a", { value: new Uint8Array([1]) });
  await store.set("b", { value: new Uint8Array([2]) });
  await store.get("a");
  await store.set("c", { value: new Uint8Array([3]) });

  assert.deepEqual(await store.get("a"), { value: new Uint8Array([1]) });
  assert.equal(await store.get("b"), undefined);
  assert.deepEqual(await store.get("c"), { value: new Uint8Array([3]) });
});

void test("DatabaseCache coalesces concurrent loads and returns independent JSON values", async () => {
  const cache = new DatabaseCache({ store: new MemoryCacheStore({ maxEntries: 10 }) });
  let loads = 0;
  const load = async () => {
    loads += 1;
    return { nested: { value: 1 } };
  };

  const [first, second] = await Promise.all([cache.json("json", load), cache.json("json", load)]);
  first.nested.value = 99;
  const third = await cache.json("json", load);

  assert.equal(loads, 1);
  assert.equal(second.nested.value, 1);
  assert.equal(third.nested.value, 1);
});

void test("DatabaseCache does not cache failures or share mutable bytes", async () => {
  const store = new MemoryCacheStore({ maxEntries: 10 });
  const cache = new DatabaseCache({ store });
  let attempts = 0;

  await assert.rejects(
    cache.bytes("asset", async () => {
      attempts += 1;
      throw new Error("load failed");
    }),
    /load failed/,
  );

  const first = await cache.bytes("asset", async () => {
    attempts += 1;
    return new Uint8Array([1, 2, 3]);
  });
  first[0] = 9;
  const second = await cache.bytes("asset", async () => {
    attempts += 1;
    return new Uint8Array([4]);
  });

  assert.equal(attempts, 2);
  assert.deepEqual(second, new Uint8Array([1, 2, 3]));
});

void test("DatabaseCache reloads expired entries", async () => {
  const store = new MemoryCacheStore({ maxEntries: 10 });
  await store.set("expired", { value: new Uint8Array([1]), expiresAt: 0 });
  const cache = new DatabaseCache({ store, ttlMs: 60_000 });
  let loads = 0;

  const value = await cache.bytes("expired", async () => {
    loads += 1;
    return new Uint8Array([2]);
  });

  assert.equal(loads, 1);
  assert.deepEqual(value, new Uint8Array([2]));
  const refreshed = await store.get("expired");
  assert.ok(refreshed?.expiresAt !== undefined && refreshed.expiresAt > Date.now());
});

void test("LxnsMaimaiDatabase enables caching only when cache options are supplied", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ id: 1, title: "Cached Song" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const cached = new LxnsMaimaiDatabase({
      baseURL: "https://cache.test/api/v0/",
      cache: { store: new MemoryCacheStore({ maxEntries: 10 }) },
    });
    const [first, second] = await Promise.all([cached.getSong(1), cached.getSong(1)]);
    assert.equal(first.title, "Cached Song");
    assert.equal(second.title, "Cached Song");
    assert.equal(requests, 1);

    const uncached = new LxnsMaimaiDatabase({ baseURL: "https://cache.test/api/v0/" });
    await uncached.getSong(1);
    await uncached.getSong(1);
    assert.equal(requests, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
