import assert from "node:assert/strict";
import test from "node:test";
import {
  isDivingFishProberError,
  isProberError,
  isProberNotImplementedError,
  ProberError,
  ProberNotImplementedError,
} from "@mai-kit/prober";

void test("ProberNotImplementedError is package-level and catchable", () => {
  const error = new ProberNotImplementedError({
    method: "getHeatmap",
    adapter: "Diving-Fish",
  });

  assert.equal(error.name, "ProberNotImplementedError");
  assert.equal(error.method, "getHeatmap");
  assert.equal(error.adapter, "Diving-Fish");
  assert.match(error.message, /Diving-Fish does not implement getHeatmap\(\)/u);
  assert.equal(isProberNotImplementedError(error), true);
  assert.equal(isProberError(error), true);
  assert.equal(error instanceof ProberError, true);
  assert.equal(isDivingFishProberError(error), false);
});

void test("ProberNotImplementedError allows custom message", () => {
  const error = new ProberNotImplementedError({
    method: "getRecents",
    message: "custom",
  });
  assert.equal(error.message, "custom");
  assert.equal(error.adapter, undefined);
});
