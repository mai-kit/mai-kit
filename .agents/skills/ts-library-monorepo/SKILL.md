---
name: ts-library-monorepo
description: Scaffold and configure a modern TypeScript library monorepo — pnpm workspaces + tsdown (rolldown) build + tsc --noEmit build-first typecheck + oxlint/oxfmt + ESM packages. Use this skill whenever the user wants to create, bootstrap, or set up a new TS monorepo, add a package to an existing monorepo, configure monorepo build/typecheck/lint tooling, or asks about monorepo architecture choices (project references vs build-first, tsup vs tsdown, nodenext vs bundler, where to put @types/node, sourcemap/hash/fixedExtension, etc.). Also trigger when the user mentions pnpm workspace, tsdown, library monorepo, publishing ESM packages, or wants a modern TS toolchain. Even if they just say "set up a new project" or "add a package" in a TS context, prefer this skill.
---

# Modern TypeScript Library Monorepo

A reference architecture for publishing **ESM library packages** from a pnpm monorepo, using the newest toolchain. Distilled from a real (maimai tooling) monorepo aligned to Vercel's `vercel/chat` SDK conventions.

The guiding principle: **the bundler (tsdown) owns `dist`; `tsc` only typechecks (`--noEmit`) and never emits.** Every decision below follows from that.

---

## Toolchain — use the new stack, not the legacy one

Prefer the latest majors. These are battle-tested together:

| Concern | Tool | Version (as of writing) | Why this, not the alternative |
|---|---|---|---|
| Package manager | **pnpm** | `11.x` (`packageManager: pnpm@11.10.0`) | Strict, fast, workspace-native. Not npm/yarn. |
| Runtime | **Node 24+** | `^24` | Native `.ts` execution via type-stripping (`node --test file.ts`). |
| Language | **TypeScript 6** | `^6.0.3` | Not TS 5. |
| Bundler/build | **tsdown** | `^0.22.3` | rolldown-powered successor to tsup. Faster, same DX. Not tsup/rollup/tsc-emit. |
| Lint | **oxlint** | `^1.72` (+ `oxlint-tsgolint`) | Rust/oxc-based, ~50–100× eslint. |
| Format | **oxfmt** | `^0.53` | oxc-based, prettier replacement. |
| Test | **vitest** | `^4` | Not jest. For Node-native `.ts` tests use `node --test` (no runner needed). |
| Node types | **@types/node** | `^24` | Per-package where node APIs are used. |

When scaffolding, pin to these and bump to latest on install. The point is to NOT default to eslint+prettier+tsup+jest — that stack is dated for greenfield TS libraries.

---

## Architecture at a glance

```
my-monorepo/
├── package.json            # root: private, scripts, shared devDeps
├── pnpm-workspace.yaml     # packages: ["packages/*"]
├── tsconfig.base.json      # shared typecheck-only options
├── .oxlintrc.json / .oxfmtrc.json
└── packages/
    ├── shared/             # leaf library
    │   ├── package.json
    │   ├── tsconfig.json   # extends base, include src
    │   ├── tsdown.config.ts
    │   └── src/index.ts
    ├── core/               # depends on shared
    └── cli/                # app-like, may have bin + tests
```

- **Build**: tsdown, one config per package.
- **Typecheck**: `tsc --noEmit` per package. Root `typecheck` = **build-first** (`pnpm -r run build && pnpm -r run typecheck`).
- **Cross-package types**: resolved through the built `dist/*.d.ts` via pnpm symlinks + `exports`. No `paths`, no project references.
- **Orchestration**: `pnpm -r` (topological). Add **turbo** only when you need caching/at scale (≥ ~10 packages); for small monorepos pnpm -r is enough.

---

## Core decisions (and why)

### 1. ES2023 + `moduleResolution: "bundler"`, `module: "esnext"` — not `nodenext`
Use `target: "es2023"` and `lib: ["es2023"]` for the Node 24 + modern-browser baseline. A bundler (tsdown/rolldown) resolves imports at build time, so tsc doesn't need Node-strict resolution. Source-relative imports and exports stay extensionless (`./foo`, not `./foo.js`); tsdown still emits stable `.js` files for publication. `nodenext` is for tsc-as-builder or pure-Node-resolution setups.

### 2. Build-first typecheck — NOT project references
`tsc --noEmit` typechecks against the **built dist** of dependencies. Root `typecheck` builds all packages (topo order) first, then runs `tsc --noEmit` per package. Cross-package imports resolve via `exports` → `dist/*.d.ts`.

**Why not TS Project References** (`composite` + `references` + `tsc --build`)? Project References is designed for when **tsc is the build tool** (it emits JS + d.ts as the build output, giving incremental builds). When you have a separate bundler, the forced emit becomes a liability: tsc's per-file d.ts fights the bundler's rolled-up d.ts for `dist`, and `composite`'s rootDir/include constraints are painful (TS6059/TS6307/TS6310). With a bundler, tsc should be a pure typechecker (`--noEmit`), and build-first is the matching pattern. (Project References is the right answer only if `build = tsc --build` with no bundler.)

**Why not `paths`-to-source** (redirecting `@scope/foo` → source for clean-repo typecheck)? It works but is a workaround: every package maintains `paths` entries, self-references get hacky, and typecheck runs against source instead of the published dist. Build-first is simpler and typechecks against what consumers actually get. Use it.

### 3. tsc NEVER emits — dist is 100% the bundler's
`tsconfig.base.json` carries **no emit options** (`declaration`/`declarationMap`/`sourceMap`/`outDir`/`rootDir` are all omitted — they're inert under `--noEmit` and only cause confusion). Per-package tsconfigs also omit `outDir`/`rootDir`. This guarantees `pnpm typecheck` produces zero files and never pollutes or overwrites `dist`.

### 4. `types: ["node"]` in base, `@types/node` declared per-package where used
- Base sets `types: ["node"]` so node globals (`fetch`, `URL`, `Response`, `fs`, `path`) resolve everywhere without per-package `types` config.
- Each package that **uses node APIs** declares `@types/node` in its own `devDependencies` (self-contained, conventional — Vercel does this). Packages with no node usage (pure type/utility libs) can omit it and resolve from root.

**Do NOT use `lib: ["dom"]` to provide `fetch`/`URL`** — those are Node globals; `dom` is the browser lib and is the wrong source. Use `@types/node`. `lib` should be `["es2023"]` only (add `"dom"` only for packages that genuinely touch browser APIs, e.g. a rendering lib using JSX HTML elements — and even then JSX types usually come from `@types/react`, not `dom`).

### 5. ESM-only, extensionless source imports, `.js` publication
- `"type": "module"` on every package.
- Relative imports / exports in TypeScript source omit extensions because `moduleResolution: "bundler"` and tsdown own resolution.
- `exports` points to `./dist/index.js` + `./dist/index.d.ts` (stable `.js` names).
- tsdown `format: ["esm"]`.

### 6. Per-package tsdown config — with two NON-default overrides
tsdown's defaults are geared toward **apps** (browser cache-busting, fixed extensions). For **libraries** you must override two:
- `fixedExtension: false` → output `.js`/`.d.ts` (tsdown defaults to `.mjs`/`.d.mts`; you want `.js` to match `exports` and `"type": "module"`).
- `hash: false` → stable filenames (tsdown defaults to content-hashed chunk names like `draw-abc123.mjs`; libraries need stable names that `exports` can reference).

These are NOT redundant defaults — verify by building before removing any tsdown option. (tsup differs: its defaults already give `.js` + no hash, which is why Vercel's tsup configs don't set these. tsdown ≠ tsup here.)

Also: `sourcemap: false` (libraries don't ship sourcemaps; consumers bundle them). And you usually do **not** need `deps: { skipNodeModulesBundle: true }` — tsdown auto-externalizes `dependencies`/`peerDependencies`. Only add `external: [...]` for specific cases (a devDep you want out, a native module).

### 7. No turbo until you need it
`pnpm -r` runs scripts in topological order — sufficient for small monorepos. Reach for **turbo** (caching, remote cache, `dependsOn` graph) when you have many packages and slow repeated builds. If using turbo, mirror the build-first rule: `typecheck` task `dependsOn: ["^build"]`.

---

## File templates

### `pnpm-workspace.yaml`
```yaml
packages:
  - "packages/*"
```

### Root `package.json`
```json
{
  "name": "my-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.10.0",
  "scripts": {
    "build": "pnpm -r run build",
    "typecheck": "pnpm -r run build && pnpm -r run typecheck",
    "test": "pnpm -r run test",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "check": "oxfmt --check . && oxlint .",
    "clean": "pnpm -r run clean"
  },
  "devDependencies": {
    "@types/node": "^24",
    "oxfmt": "^0.53",
    "oxlint": "^1.72",
    "oxlint-tsgolint": "^0.24",
    "tsdown": "^0.22",
    "typescript": "^6"
  }
}
```
> `typecheck` is **build-first**: build all packages, then typecheck. This is the equivalent of turbo's `typecheck dependsOn: ^build` using plain pnpm.

### `tsconfig.base.json` (typecheck-only — no emit options)
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "useDefineForClassFields": true,
    "types": ["node"]
  }
}
```

### Per-package `tsconfig.json` (leaf / library)
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```
For a package with JSX (React rendering):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src"]
}
```
If a package also typechecks `tests/` together with `src` (e.g. tests import the package via its name), add `"tests"` to `include`. No `outDir`, no `rootDir`, no `paths`, no `references`, no `composite`.

### Per-package `tsdown.config.ts` (single-entry library)
```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2023",
  fixedExtension: false,
  hash: false,
  sourcemap: false,
  clean: true,
  dts: { sourcemap: false },
});
```
Multi-entry (e.g. library + CLI):
```ts
export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "es2023",
  fixedExtension: false,
  hash: false,
  sourcemap: false,
  clean: true,
  dts: { sourcemap: false },
});
```
> `fixedExtension: false` and `hash: false` are **required overrides** for libraries (see decision #6). Do not delete them without verifying the build output stays `.js` with stable, un-hashed names.

### Per-package `package.json`
```json
{
  "name": "@scope/pkg",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src", "README.md"],
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@scope/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^24",
    "tsdown": "^0.22",
    "typescript": "^6"
  }
}
```
- Internal deps use `"workspace:*"`.
- Declare `@types/node` only in packages that use node APIs.
- For a CLI, add `"bin": { "my-cli": "./dist/cli.js" }`.

### `.gitignore`
```
node_modules
dist
*.tsbuildinfo
.DS_Store
```

### oxlint / oxfmt (minimal)
`.oxlintrc.json` and `.oxfmtrc.json` — start minimal and let `oxlint --fix` / `oxfmt --write` shape them. The root scripts (`check`, `fix`) drive them.

---

## Scaffolding workflow

1. `pnpm init` the root; set `"private": true`, `"type": "module"`, `"packageManager": "pnpm@<latest>"`.
2. Add `pnpm-workspace.yaml` (`packages: ["packages/*"]`).
3. Add root devDeps: `pnpm add -D -w tsdown typescript @types/node oxlint oxfmt oxlint-tsgolint`.
4. Create `tsconfig.base.json` (template above).
5. For each package: create `packages/<name>/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`, `src/index.ts`.
6. `pnpm install` (links workspace deps).
7. Verify: `pnpm build` (all packages build, `.js`+`.d.ts`, no `.mjs`/hash), `pnpm typecheck` (build-first, passes), `pnpm check` (lint+format).
8. Add tests: `node --test tests/foo.test.ts` (Node 24 type-strips `.ts`) or vitest. Tests that import the package by name need the package built first — run `build` before `node --test`, or rely on root `typecheck` (which builds).

---

## Gotchas — verify, don't assume

- **`fixedExtension` / `hash` are not defaults in tsdown.** Removing them silently changes output to `.mjs` + hashed chunk names and breaks `exports`. Always build and inspect `dist/` before deleting any tsdown option that looks "default-ish."
- **tsc must stay `--noEmit`.** If typecheck ever writes files to `dist`, it'll fight the bundler. The base tsconfig has zero emit options precisely to prevent this.
- **`dom` lib is a crutch for Node globals.** `fetch`/`URL`/`Response` come from `@types/node`, not `dom`. Don't put `dom` in the base lib for Node packages.
- **`skipNodeModulesBundle: true` is usually redundant.** tsdown already externalizes `dependencies`. Only reach for `external: [...]` when you have a specific dep to force out.
- **Project References + a bundler = pain.** If you find yourself fighting `composite`/rootDir/emit, you probably want build-first instead. Project References is for tsc-as-builder setups.
- **Cross-package typecheck fails on a clean repo?** That means typecheck isn't build-first. Make root `typecheck` run `build` first (`pnpm -r run build && pnpm -r run typecheck`), or — at scale — use turbo with `typecheck dependsOn: ["^build"]`.

---

## Reference

This architecture is aligned to **Vercel's `vercel/chat` SDK** (pnpm + turbo + tsup + `tsc --noEmit` + `typecheck dependsOn: ^build` + `moduleResolution: bundler` + per-package build config + no project references). The differences from Vercel's setup, by choice: tsdown instead of tsup; `pnpm -r` instead of turbo (for small monorepos); `@types/node` declared per-package only where node APIs are used.
