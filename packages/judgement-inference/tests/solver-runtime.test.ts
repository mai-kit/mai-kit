import assert from "node:assert/strict";
import test from "node:test";

interface SolverRuntimeModule {
  createRetryableCachedLoader<T>(loader: () => Promise<T>): () => Promise<T>;
}

function isSolverRuntimeModule(value: unknown): value is SolverRuntimeModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "createRetryableCachedLoader" in value &&
    typeof value.createRetryableCachedLoader === "function"
  );
}

const loadedSolverRuntime: unknown = await import(
  new URL("../src/solver-runtime.ts", import.meta.url).href
);
if (!isSolverRuntimeModule(loadedSolverRuntime)) {
  throw new TypeError("solver runtime test module has an unexpected shape");
}
const solverRuntime = loadedSolverRuntime;

void test("retries a rejected loader without duplicating concurrent or successful loads", async () => {
  let attempts = 0;
  const expected = { solver: "loaded" };
  const load = solverRuntime.createRetryableCachedLoader(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary load failure");
    return expected;
  });

  const failed = await Promise.allSettled([load(), load()]);
  assert.equal(attempts, 1);
  assert.deepEqual(
    failed.map((result) => result.status),
    ["rejected", "rejected"],
  );

  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(attempts, 2);
  assert.equal(first, expected);
  assert.equal(second, expected);
  assert.equal(await load(), expected);
  assert.equal(attempts, 2);
});
