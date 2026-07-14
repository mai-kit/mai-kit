import assert from "node:assert/strict";
import { test } from "node:test";
import { LxnsMaimaiDatabase, isLxnsDatabaseError } from "@mai-kit/database";

void test("LXNS database rejects malformed public API data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1, title: "Incomplete" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const database = new LxnsMaimaiDatabase({ baseURL: "https://example.test/api/v0/" });
    await assert.rejects(
      database.getSong(1),
      (error: unknown) =>
        isLxnsDatabaseError(error) &&
        error.message.includes("unexpected response structure") &&
        error.message.includes("artist"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("LXNS collection requirements normalize FS codes from the upstream fc field", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        trophies: [
          {
            id: 5524,
            name: "溶けてしまいそう",
            required: [
              { fc: "fs", songs: [{ id: 1043, title: "メルト", type: "dx" }] },
              { fc: "ap" },
              { fs: "fsd" },
            ],
          },
        ],
      }),
    );

  try {
    const database = new LxnsMaimaiDatabase({ baseURL: "https://example.test/api/v0/" });
    const [trophy] = await database.getCollectionList("trophy");
    assert.equal(trophy?.required?.[0]?.fc, undefined);
    assert.equal(trophy?.required?.[0]?.fs, "fs");
    assert.equal(trophy?.required?.[1]?.fc, "ap");
    assert.equal(trophy?.required?.[1]?.fs, undefined);
    assert.equal(trophy?.required?.[2]?.fs, "fsd");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
