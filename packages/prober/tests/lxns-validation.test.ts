import assert from "node:assert/strict";
import { test } from "node:test";
import { createLxnsClient, isLxnsProberError } from "@mai-kit/prober";

const profile = {
  name: "LXNS",
  rating: 15_000,
  friend_code: 123456789,
  course_rank: 10,
  class_rank: 5,
  star: 2,
  upload_time: "2026-07-14T00:00:00Z",
};

void test("LXNS validates response data and removes unknown fields", async () => {
  await withMockedFetch(
    {
      ...profile,
      trophy: {
        name: "溶けてしまいそう",
        required: [{ fc: "fs" }, { fc: "ap" }, { fs: "fsd" }],
      },
      upstream_only: true,
    },
    async () => {
      const player = createLxnsClient({
        personalAccessToken: "token",
        baseURL: "https://example.test/api/v0/",
      }).me();
      const result = await player.getProfile();

      assert.equal(result.name, "LXNS");
      assert.equal(result.trophy?.required?.[0]?.fc, undefined);
      assert.equal(result.trophy?.required?.[0]?.fs, "fs");
      assert.equal(result.trophy?.required?.[1]?.fc, "ap");
      assert.equal(result.trophy?.required?.[2]?.fs, "fsd");
      assert.equal("upstream_only" in result, false);
    },
  );
});

void test("LXNS dev collection responses normalize FS codes from the upstream fc field", async () => {
  await withMockedFetch(
    { id: 5524, name: "溶けてしまいそう", required: [{ fc: "fsp" }] },
    async () => {
      const client = createLxnsClient({
        devAccessToken: "token",
        baseURL: "https://example.test/api/v0/",
      });
      const result = await client.getPlayerCollection(123456789, "trophy", 5524);

      assert.equal(result.required?.[0]?.fc, undefined);
      assert.equal(result.required?.[0]?.fs, "fsp");
    },
  );
});

void test("LXNS wraps schema failures in adapter errors", async () => {
  await withMockedFetch({ ...profile, rating: "15000" }, async () => {
    const player = createLxnsClient({
      personalAccessToken: "token",
      baseURL: "https://example.test/api/v0/",
    }).me();

    await assert.rejects(
      player.getProfile(),
      (error: unknown) =>
        isLxnsProberError(error) &&
        error.message.includes("unexpected response structure") &&
        error.message.includes("rating"),
    );
  });
});

async function withMockedFetch(data: unknown, action: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, code: 200, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
