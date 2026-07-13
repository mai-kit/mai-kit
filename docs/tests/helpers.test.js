import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildExternalSymbolLinkMappings,
  categoryFor,
  categoryWeight,
  expandModuleChildren,
  matchesPattern,
  packageNameFromModule,
  packageNameFromSource,
  ruleMatches,
  shouldDrop,
  sidebarItemText,
  sortCategoryList,
  sortModuleNames,
} from "../typedoc-api-helpers.js";

const categoriesConfig = JSON.parse(
  await readFile(new URL("../api-categories.json", import.meta.url), "utf8"),
);

const KIND_NAMES = { Module: 2, Function: 64, Class: 128 };

void test("packageNameFromModule / packageNameFromSource", () => {
  assert.equal(packageNameFromModule("@mai-kit/draw"), "draw");
  assert.equal(packageNameFromModule("draw"), null);
  assert.equal(packageNameFromSource("packages/database/src/error.ts"), "database");
  assert.equal(packageNameFromSource("src/error.ts"), null);
});

void test("categoryWeight and sortCategoryList", () => {
  const order = ["接口与模型", "错误", "*"];
  assert.equal(categoryWeight("错误", order), 1);
  assert.equal(categoryWeight("其他", order), 2);
  const sorted = sortCategoryList([{ title: "错误" }, { title: "接口与模型" }], order);
  assert.deepEqual(
    sorted.map((c) => c.title),
    ["接口与模型", "错误"],
  );
});

void test("sortModuleNames follows packageOrder", () => {
  const ordered = sortModuleNames(
    ["@mai-kit/draw", "@mai-kit/judgement-solver", "@mai-kit/shared", "@mai-kit/utils"],
    categoriesConfig.packageOrder,
  );
  assert.deepEqual(ordered, [
    "@mai-kit/shared",
    "@mai-kit/utils",
    "@mai-kit/judgement-solver",
    "@mai-kit/draw",
  ]);
});

void test("ruleMatches file / name / kind", () => {
  assert.ok(
    ruleMatches(
      { file: "/error\\.ts$", category: "错误" },
      { name: "MaimaiDatabaseError", sources: [{ fileName: "packages/database/src/error.ts" }] },
    ),
  );
  assert.ok(
    !ruleMatches(
      { file: "/error\\.ts$", category: "错误" },
      { name: "Song", sources: [{ fileName: "packages/database/src/models.ts" }] },
    ),
  );
  assert.ok(
    ruleMatches(
      { kind: "Module", name: "^judgement$", category: "判定计算" },
      { name: "judgement", kind: 2 },
      KIND_NAMES,
    ),
  );
  assert.ok(
    !ruleMatches(
      { kind: "Module", name: "^judgement$", category: "判定计算" },
      { name: "judgement", kind: 64 },
      KIND_NAMES,
    ),
  );
});

void test("matchesPattern invalid regex fails closed", () => {
  assert.equal(matchesPattern("(", "x"), false);
});

void test("categoryFor uses declarative rules", () => {
  const packages = categoriesConfig.packages;

  assert.equal(
    categoryFor(
      {
        name: "LxnsMaimaiDatabase",
        sources: [{ fileName: "packages/database/src/adapters/lxns/database.ts" }],
      },
      "database",
      packages,
      KIND_NAMES,
    ),
    "LXNS 适配",
  );

  assert.equal(
    categoryFor({ name: "judgement", kind: 2 }, "utils", packages, KIND_NAMES),
    "判定计算",
  );

  assert.equal(
    categoryFor(
      {
        name: "calculateDxRating",
        sources: [{ fileName: "packages/utils/src/rating.ts" }],
      },
      "utils",
      packages,
      KIND_NAMES,
    ),
    "Rating 与评级",
  );

  assert.equal(
    categoryFor(
      {
        name: "UnknownThing",
        sources: [{ fileName: "packages/utils/src/brand-new.ts" }],
      },
      "utils",
      packages,
      KIND_NAMES,
    ),
    null,
  );

  assert.equal(
    categoryFor(
      {
        name: "getRateBadge",
        sources: [{ fileName: "packages/assets/src/index.ts" }],
      },
      "assets",
      packages,
      KIND_NAMES,
    ),
    "徽章",
  );
});

void test("shouldDrop inherited and cross-package", () => {
  assert.equal(shouldDrop({ flags: { isInherited: true } }, "draw"), true);
  assert.equal(shouldDrop({ inheritedFrom: {} }, "draw"), true);
  assert.equal(
    shouldDrop({ sources: [{ fileName: "packages/shared/src/maimai.ts" }] }, "prober"),
    true,
  );
  assert.equal(
    shouldDrop({ sources: [{ fileName: "packages/prober/src/models.ts" }] }, "prober"),
    false,
  );
});

void test("sidebarItemText for utils multi-entry", () => {
  assert.equal(sidebarItemText("@mai-kit/utils", { name: "index", kind: 2 }, 2), "@mai-kit/utils");
  assert.equal(
    sidebarItemText("@mai-kit/utils", { name: "judgement", kind: 2 }, 2),
    "@mai-kit/utils/judgement",
  );
  assert.equal(sidebarItemText("@mai-kit/draw", { name: "Draw", kind: 128 }, 2), "Draw");
});

void test("expandModuleChildren", () => {
  const mod = {
    name: "judgement",
    kind: 2,
    children: [{ name: "a" }, { name: "b" }],
  };
  assert.deepEqual(
    expandModuleChildren(mod, 2)?.map((c) => c.name),
    ["a", "b"],
  );
  assert.equal(expandModuleChildren({ name: "Draw", kind: 128 }, 2), null);
});

void test("buildExternalSymbolLinkMappings", () => {
  const map = buildExternalSymbolLinkMappings([
    {
      packageName: "shared",
      symbols: [
        { name: "MaiKitError", kindDir: "classes" },
        { name: "isMaiKitError", kindDir: "functions" },
      ],
    },
  ]);
  assert.equal(map["@mai-kit/shared"].MaiKitError, "/api/@mai-kit/shared/classes/MaiKitError");
  assert.equal(
    map["@mai-kit/shared"].isMaiKitError,
    "/api/@mai-kit/shared/functions/isMaiKitError",
  );
});
