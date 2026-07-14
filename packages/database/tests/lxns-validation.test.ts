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
