import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DatabaseCache,
  FileSystemCacheStore,
  LxnsMaimaiDatabase,
  MemoryCacheStore,
  isMaimaiDatabaseError,
} from "@mai-kit/database";

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

void test("DatabaseCache applies decoders to cached JSON values", async () => {
  const store = new MemoryCacheStore({ maxEntries: 10 });
  await store.set("validated", {
    value: new TextEncoder().encode(JSON.stringify({ value: "invalid" })),
  });
  const cache = new DatabaseCache({ store });

  await assert.rejects(
    cache.json(
      "validated",
      async () => ({ value: 1 }),
      (value) => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("value" in value) ||
          typeof value.value !== "number"
        ) {
          throw new Error("invalid cached value");
        }
        return value.value;
      },
    ),
    /invalid cached value/u,
  );
});

void test("DatabaseCache validates loaded JSON before writing it", async () => {
  const store = new MemoryCacheStore({ maxEntries: 10 });
  const cache = new DatabaseCache({ store });
  let loads = 0;
  const decode = (value: unknown): number => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("value" in value) ||
      typeof value.value !== "number"
    ) {
      throw new Error("invalid loaded value");
    }
    return value.value;
  };

  await assert.rejects(
    cache.json(
      "validate-before-write",
      async () => {
        loads += 1;
        return { value: "invalid" };
      },
      decode,
    ),
    /invalid loaded value/u,
  );
  assert.equal(await store.get("validate-before-write"), undefined);

  const result = await cache.json(
    "validate-before-write",
    async () => {
      loads += 1;
      return { value: 2 };
    },
    decode,
  );
  assert.equal(result, 2);
  assert.equal(loads, 2);
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

void test("FileSystemCacheStore persists entries across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mai-kit-fs-cache-"));
  try {
    const first = new FileSystemCacheStore({ directory });
    await first.set("song:1", { value: new Uint8Array([1, 2, 3]), expiresAt: 9_999_999_999_000 });
    const second = new FileSystemCacheStore({ directory });
    assert.deepEqual(await second.get("song:1"), {
      value: new Uint8Array([1, 2, 3]),
      expiresAt: 9_999_999_999_000,
    });
    await second.delete("song:1");
    assert.equal(await second.get("song:1"), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("FileSystemCacheStore evicts oldest files when over maxEntries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mai-kit-fs-cache-"));
  try {
    const store = new FileSystemCacheStore({ directory, maxEntries: 2 });
    await store.set("a", { value: new Uint8Array([1]) });
    await new Promise((r) => setTimeout(r, 15));
    await store.set("b", { value: new Uint8Array([2]) });
    await new Promise((r) => setTimeout(r, 15));
    await store.set("c", { value: new Uint8Array([3]) });

    assert.equal(await store.get("a"), undefined);
    assert.deepEqual(await store.get("b"), { value: new Uint8Array([2]) });
    assert.deepEqual(await store.get("c"), { value: new Uint8Array([3]) });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("FileSystemCacheStore clear removes all bin entries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mai-kit-fs-cache-"));
  try {
    const store = new FileSystemCacheStore({ directory });
    await store.set("x", { value: new Uint8Array([9]) });
    await store.set("y", { value: new Uint8Array([8]) });
    await store.clear();
    assert.equal(await store.get("x"), undefined);
    assert.equal(await store.get("y"), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("DatabaseCache works with FileSystemCacheStore and rejects corrupt files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mai-kit-fs-cache-"));
  try {
    const store = new FileSystemCacheStore({ directory });
    const cache = new DatabaseCache({ store, ttlMs: 60_000 });
    let loads = 0;
    const first = await cache.bytes("jacket:1", async () => {
      loads += 1;
      return new Uint8Array([10, 20]);
    });
    const second = await cache.bytes("jacket:1", async () => {
      loads += 1;
      return new Uint8Array([99]);
    });
    assert.equal(loads, 1);
    assert.deepEqual(first, new Uint8Array([10, 20]));
    assert.deepEqual(second, new Uint8Array([10, 20]));

    // 写入损坏文件后 get 应抛包级错误
    const crypto = await import("node:crypto");
    const fs = await import("node:fs/promises");
    const hash = crypto.createHash("sha256").update("bad", "utf8").digest("hex");
    await fs.writeFile(join(directory, `${hash}.bin`), new Uint8Array([0, 1, 2]));
    await assert.rejects(
      store.get("bad"),
      (error: unknown) =>
        isMaimaiDatabaseError(error) && /invalid magic|truncated/u.test(error.message),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("LxnsMaimaiDatabase enables caching only when cache options are supplied", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(
      JSON.stringify({
        id: 1,
        title: "Cached Song",
        artist: "Artist",
        genre: "maimai",
        bpm: 180,
        version: 24_000,
        difficulties: { standard: [], dx: [], utage: [] },
        upstream_only: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const cached = new LxnsMaimaiDatabase({
      baseURL: "https://cache.test/api/v0/",
      cache: { store: new MemoryCacheStore({ maxEntries: 10 }) },
    });
    const [first, second] = await Promise.all([cached.getSong(1), cached.getSong(1)]);
    assert.equal(first.title, "Cached Song");
    assert.equal(second.title, "Cached Song");
    assert.equal("upstream_only" in first, false);
    assert.equal(requests, 1);

    const uncached = new LxnsMaimaiDatabase({ baseURL: "https://cache.test/api/v0/" });
    await uncached.getSong(1);
    await uncached.getSong(1);
    assert.equal(requests, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
