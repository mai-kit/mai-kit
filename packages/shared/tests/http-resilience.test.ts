import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithResilience, RequestCoalescer } from "@mai-kit/shared";

void test("RequestCoalescer merges concurrent work for the same key", async () => {
  const coalescer = new RequestCoalescer();
  let runs = 0;
  const task = async () => {
    runs += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return runs;
  };

  const [a, b] = await Promise.all([coalescer.run("k", task), coalescer.run("k", task)]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(runs, 1);
});

void test("fetchWithResilience retries network failures then succeeds", async () => {
  let attempts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("network down");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const response = await fetchWithResilience("https://example.test/x", undefined, {
      retries: 2,
    });
    assert.equal(response.status, 200);
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = original;
  }
});

void test("fetchWithResilience does not retry HTTP 4xx", async () => {
  let attempts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response("nope", { status: 404 });
  };

  try {
    const response = await fetchWithResilience("https://example.test/x", undefined, {
      retries: 3,
    });
    assert.equal(response.status, 404);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = original;
  }
});

void test("fetchWithResilience retries HTTP 5xx then returns last response", async () => {
  let attempts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 2) return new Response("err", { status: 503 });
    return new Response("ok", { status: 200 });
  };

  try {
    const response = await fetchWithResilience("https://example.test/x", undefined, {
      retries: 2,
    });
    assert.equal(response.status, 200);
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = original;
  }
});
