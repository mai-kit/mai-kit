---
name: ts-library-monorepo
description: Scaffold and configure a modern TypeScript library monorepo — pnpm workspaces + tsdown (rolldown) build + tsc --noEmit build-first typecheck + oxlint/oxfmt + ESM packages. Use this skill whenever the user wants to create, bootstrap, or set up a new TS monorepo, add a package to an existing monorepo, configure monorepo build/typecheck/lint tooling, or asks about monorepo architecture choices (project references vs build-first, tsup vs tsdown, nodenext vs bundler, where to put @types/node, sourcemap/hash/fixedExtension, etc.). Also trigger when the user mentions pnpm workspace, tsdown, library monorepo, publishing ESM packages, or wants a modern TS toolchain. Even if they just say "set up a new project" or "add a package" in a TS context, prefer this skill. In this mai-kit monorepo, also use for adapter packages, package-level vs adapter errors, NotImplemented errors, public API surface narrowing, and TypeDoc rules (no private/internal in docs).
---

# Modern TypeScript Library Monorepo

A reference architecture for publishing **ESM library packages** from a pnpm monorepo, using the newest toolchain. Distilled from a real (maimai tooling) monorepo aligned to Vercel's `vercel/chat` SDK conventions.

The guiding principle: **the bundler (tsdown) owns `dist`; `tsc` only typechecks (`--noEmit`) and never emits.** Every decision below follows from that.

---

## Toolchain — use the new stack, not the legacy one

Prefer the latest majors. These are battle-tested together:

| Concern | Tool | Version (as of writing) | Why this, not the alternative |
|---|---|---|---|
| Package manager | **pnpm** | `11.x` (`packageManager: pnpm@11.12.0`) | Strict, fast, workspace-native. Pin an exact version; not npm/yarn. |
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
├── tsconfig.json           # files: [] + references; editor solution index only
├── tsconfig.test.json      # Node test typecheck project
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
- **Cross-package types**: resolved through the built `dist/*.d.ts` via pnpm symlinks + `exports`. No `paths` and no composite package-dependency reference graph. A root solution-style `tsconfig.json` may reference leaf configs solely so editors discover every project.
- **Orchestration**: `pnpm -r` (topological). Add **turbo** only when you need caching/at scale (≥ ~10 packages); for small monorepos pnpm -r is enough.

---

## Core decisions (and why)

### 1. Platform-neutral ES2023 base + `moduleResolution: "bundler"`, `module: "esnext"` — not `nodenext`
Use `target: "es2023"`, `lib: ["es2023"]`, and `types: []` in the shared base. Keeping `lib` explicit matters: omitting it makes TypeScript add its default DOM-oriented libraries for this target. Packages opt into `dom` / `dom.iterable` only when their source uses Web APIs, and opt into `types: ["node"]` only when their source contains Node-specific implementations. A bundler (tsdown/rolldown) resolves imports at build time, so tsc doesn't need Node-strict resolution. Source-relative imports and exports stay extensionless (`./foo`, not `./foo.js`); tsdown still emits stable `.js` files for publication. `nodenext` is for tsc-as-builder or pure-Node-resolution setups.

### 2. Build-first typecheck — NOT composite project-reference builds
`tsc --noEmit` typechecks against the **built dist** of dependencies. Root `typecheck` builds all packages (topo order) first, then runs `tsc --noEmit` per package. Cross-package imports resolve via `exports` → `dist/*.d.ts`.

**Why not composite package references** (`composite` + package dependency `references` + `tsc --build`)? Project References is designed for when **tsc is the build tool** (it emits JS + d.ts as the build output, giving incremental builds). When you have a separate bundler, the forced emit becomes a liability: tsc's per-file d.ts fights the bundler's rolled-up d.ts for `dist`, and `composite`'s rootDir/include constraints are painful (TS6059/TS6307/TS6310). With a bundler, tsc should be a pure typechecker (`--noEmit`), and build-first is the matching pattern.

A root solution-style `tsconfig.json` is a narrow exception: it has `files: []` and references package/test configs only so tsserver and editors can associate files with an arbitrarily named config such as `tsconfig.test.json`. It is not used by build scripts, does not introduce package dependency edges, and leaf configs do not enable `composite`.

**Why not `paths`-to-source** (redirecting `@scope/foo` → source for clean-repo typecheck)? It works but is a workaround: every package maintains `paths` entries, self-references get hacky, and typecheck runs against source instead of the published dist. Build-first is simpler and typechecks against what consumers actually get. Use it.

### 3. tsc NEVER emits — dist is 100% the bundler's
`tsconfig.base.json` carries **no emit options** (`declaration`/`declarationMap`/`sourceMap`/`outDir`/`rootDir` are all omitted — they're inert under `--noEmit` and only cause confusion). Per-package tsconfigs also omit `outDir`/`rootDir`. This guarantees `pnpm typecheck` produces zero files and never pollutes or overwrites `dist`.

### 4. Platform types are explicit; Node tests stay isolated
- Base uses only `lib: ["es2023"]` and `types: []`; neither DOM nor Node globals leak into every package.
- A package whose source uses Web APIs such as `fetch`, `URL`, `Response`, `AbortController`, or browser globals adds `lib: ["es2023", "dom", "dom.iterable"]` in its own tsconfig.
- A package whose **source** contains an explicit Node implementation (for example a dynamic `import("node:fs")`) adds `compilerOptions.types: ["node"]` in its own tsconfig and declares `@types/node` in its own `devDependencies`. A dual implementation package may intentionally opt into both DOM libs and Node types.
- Node-based tests use a separate test tsconfig with `types: ["node"]`. Keep production package tsconfigs scoped to `src`; otherwise importing `node:test` from tests re-pollutes the source compilation and defeats the dual-runtime guardrail.
- Reference the test config from the root solution config so VS Code assigns test files to it instead of an inferred project.

This is a type-surface guardrail, not proof of runtime portability. Keep Node-only imports dynamic or behind an explicit Node-only API, and verify the browser bundle with a real Web smoke test.

### 5. ESM-only, extensionless source imports, `.js` publication
- `"type": "module"` on every package.
- Relative imports / exports in TypeScript source omit extensions because `moduleResolution: "bundler"` and tsdown own resolution.
- `exports` points to `./dist/index.js` + `./dist/index.d.ts` (stable `.js` names).
- tsdown `format: ["esm"]`.

### 6. Per-package tsdown config — generated exports plus two NON-default overrides
Set `exports: true` so tsdown derives `package.json#exports` from the configured entries and actual build outputs. Treat the generated field as build-owned: review it after changing entries instead of maintaining a second manual export map.

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
  "packageManager": "pnpm@11.12.0",
  "scripts": {
    "build": "pnpm -r run build",
    "typecheck": "pnpm -r run build && pnpm -r run typecheck",
    "test": "pnpm -r run test",
    "lint": "pnpm run build && oxlint .",
    "lint:fix": "pnpm run build && oxlint --fix .",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "check": "pnpm run format:check && pnpm run lint",
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
> `typecheck` and type-aware `lint` are **build-first**: build all packages before resolving cross-package types from `dist/*.d.ts`. `check` must also pass after deleting every `dist`; do not let a dirty local workspace mask a clean-checkout failure.

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
    "types": []
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
For a package whose source intentionally contains Node-only branches:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```
For a package that uses Web APIs:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["es2023", "dom", "dom.iterable"]
  },
  "include": ["src"]
}
```
For a dual implementation package with Web APIs and Node-specific branches, combine both explicit opt-ins in that package config.
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
Do not add Node tests to the production package `include`. Typecheck them through a separate root config so Node globals do not become visible while checking `src`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["packages/*/tests/**/*.ts"]
}
```
Add a standard root `tsconfig.json` so editors discover the arbitrary test config name:
```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared/tsconfig.json" },
    { "path": "./packages/core/tsconfig.json" },
    { "path": "./tsconfig.test.json" }
  ]
}
```
No `outDir`, no `rootDir`, no `paths`, and no `composite` in leaf configs. Do not run `tsc -b` as the package build; the root references are an editor solution index, not the build graph.

### Per-package `tsdown.config.ts` (single-entry library)
```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2023",
  exports: true,
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
  exports: true,
  fixedExtension: false,
  hash: false,
  sourcemap: false,
  clean: true,
  dts: { sourcemap: false },
});
```
> `exports: true` makes tsdown own the generated package exports. `fixedExtension: false` and `hash: false` are **required overrides** for libraries (see decision #6). Do not delete them without verifying the generated manifest and build output stay aligned on stable `.js` names.

### Per-package `package.json`
```json
{
  "name": "@scope/pkg",
  "version": "0.0.0",
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@scope/shared": "workspace:*"
  }
}
```
- The shown `exports` field is generated by `tsdown` during `build`; do not maintain a parallel manual map. Keep `types` for tooling that still reads the top-level declaration entry.
- Internal deps use `"workspace:*"`.
- Declare `@types/node` only in packages whose published source uses Node APIs. A package that uses Node only from tests relies on the root `@types/node` and the separate test tsconfig; it does not need a package-level declaration.
- Do **not** publish `src` for a normal bundled library. Ship `dist`, README, LICENSE, and only runtime assets that code actually loads (for example `assets` or `data`). Verify the real tarball with `pnpm pack --dry-run --json`; inspecting `files` alone is not enough.
- For a CLI, add `"bin": { "my-cli": "./dist/cli.js" }`.

### `.gitignore`
```
node_modules
dist
*.tsbuildinfo
.DS_Store
```

### oxlint / oxfmt (minimal)
`.oxlintrc.json` and `.oxfmtrc.json` — start minimal and let `oxlint --fix` / `oxfmt --write` shape them. The root scripts (`check`, `fix`) drive them. Keep Oxfmt's package manifest ordering enabled explicitly:

```json
{
  "sortPackageJson": true
}
```

---

## Scaffolding workflow

1. `pnpm init` the root; set `"private": true`, `"type": "module"`, and an exact `"packageManager": "pnpm@<version>"`. Avoid `corepack use` when it appends an integrity suffix or rewrites the project lockfile as package-manager installation state.
2. Add `pnpm-workspace.yaml` (`packages: ["packages/*"]`).
3. Add root devDeps: `pnpm add -D -w tsdown typescript @types/node oxlint oxfmt oxlint-tsgolint`.
4. Create `tsconfig.base.json` (template above) with only ES libs and `types: []`.
5. For each package: create `packages/<name>/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`, `src/index.ts`. Add DOM libs and Node types locally only where source code needs them; use a separate Node test tsconfig for tests.
6. Add a root solution-style `tsconfig.json` referencing all package configs and the test config so editors discover them. Keep it out of build commands and keep leaf configs non-composite.
7. `pnpm install` (links workspace deps).
8. Delete all `dist`, then verify: `pnpm check` (build-first lint + format), `pnpm typecheck`, and tests. Before publishing, inspect `pnpm --filter './packages/*' -r pack --dry-run --json` to confirm no `src`, tests, configs, or scripts are shipped.
9. Add tests: `node --test tests/foo.test.ts` (Node 24 type-strips `.ts`) or vitest. Tests that import the package by name need the package built first — run `build` before `node --test`, or rely on root `typecheck` (which builds).

---

## GitHub Actions — validate once, release from the validated commit

For a publishable monorepo, keep **source validation**, **package release**, and **deployment** as separate trust boundaries:

```
pull_request ──> CI (build once + every gate)
main push ─────> CI (same gates + reusable artifacts)
                    ├─ success ─> Release (Version PR or OIDC publish)
                    └─ success ─> Deploy (consume validated artifact only)
```

### 1. CI is the only source gate

- Trigger on `pull_request`, `push` to `main`, and optionally `workflow_dispatch` for diagnostics.
- Build packages **once**. Run typecheck, unit tests, docs, and browser smoke against that `dist`.
- Keep standalone local scripts build-first, but add explicit CI-only built entries:

```json
{
  "scripts": {
    "test:web": "pnpm run build && pnpm run test:web:built",
    "test:web:built": "vite build tests/web && node tests/web/run.mjs",
    "docs:build": "pnpm run build && pnpm run docs:build:built",
    "docs:build:built": "pnpm --filter docs build"
  }
}
```

After `pnpm check` has built the workspace, CI calls only `test:web:built` / `docs:build:built`. Do not hide an unconditional build inside every CI step.

If a downstream deployment needs generated files, upload them only for a `main` push after all relevant generation/verification steps. A normal `actions/upload-artifact` artifact can be downloaded by a later `workflow_run` using the triggering run id.

### 2. Release runs only after successful main CI

Use `workflow_run`, not a second `push` workflow that repeats all gates:

```yaml
name: Release

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.event == 'push' &&
      github.event.workflow_run.head_branch == 'main' &&
      github.event.workflow_run.head_repository.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.workflow_run.head_sha }}
          fetch-depth: 0
      # setup runtime and install frozen dependencies
      - uses: changesets/action@v1
        with:
          branch: main
          version: pnpm run ci:version
          publish: pnpm run ci:publish
```

`workflow_run` is privileged: it can receive write permissions and secrets even when the upstream workflow cannot. Therefore all four checks above are mandatory, and the privileged workflow must never checkout a PR/fork head or execute an untrusted artifact. Checkout `workflow_run.head_sha`, not an implicitly newer `main`.

Release does **not** rerun format, lint, typecheck, tests, docs, or browser smoke. A publish command should still perform one fresh package build immediately before `changeset publish`; that build produces the exact tarball being released.

When using Changesets from `workflow_run`, set its `branch` input explicitly (`main` here). The checkout is intentionally an exact detached SHA, so branch inference is not a suitable release contract.

Pull requests created or updated with the repository `GITHUB_TOKEN` can produce approval-required `pull_request` runs. The post-merge main CI remains the hard publish gate, so this does not weaken release safety. If branch policy requires bot-created Version PR checks to start automatically, use a narrowly scoped GitHub App installation token; do not introduce a broad personal token merely to bypass approval.

Avoid a manual Release trigger that bypasses CI. Rerun the failed CI or Release workflow instead. If a manual path is truly required, it must independently execute the full validation contract before publishing.

### 3. Pages/deploy workflows consume artifacts, not source

For a privileged deployment triggered from CI:

- Apply the same success/event/branch/repository filter as Release.
- Give it only the permissions it needs (`actions: read`, deployment permission, OIDC if required).
- Download the artifact with `actions/download-artifact`, `run-id: ${{ github.event.workflow_run.id }}`, and `github-token`.
- Prefer downloading into `${{ runner.temp }}`. Do not checkout or run repository scripts in this workflow.

This keeps external deployment failure separate from CI/release eligibility while avoiding a second dependency install and build.

### 4. npm Trusted Publishing (OIDC)

Release requirements:

- GitHub-hosted runner (not self-hosted).
- `permissions: id-token: write`.
- `actions/setup-node` with the npm registry URL; disable release dependency caching when reproducibility matters.
- Node `>=22.14.0`; pin a known-good npm version rather than installing `npm@latest` (mai-kit uses `npm@11.16.0`).
- No `NPM_TOKEN` or `NODE_AUTH_TOKEN` for publish.
- Every published package has `publishConfig.access: "public"`, a repository URL matching the GitHub repo, and only the intended runtime files.
- Keep the `npm publish` command in the workflow file registered with npm. With `workflow_call`, npm may validate the caller workflow filename instead.

Configure each package after its name exists on the registry (the trust command requires an existing package):

```bash
npm trust github @scope/pkg \
  --file release.yml \
  --repo owner/repo \
  --allow-publish \
  --yes

npm trust list @scope/pkg --json
```

The workflow filename is case-sensitive and is only the basename (`release.yml`, not `.github/workflows/release.yml`). The registry currently allows one trusted publisher configuration per package. A brand-new package therefore needs one authenticated bootstrap publish before OIDC can be attached; inspect the tarball first and do not claim local provenance.

After the OIDC publish path has succeeded, restrict the package's Publishing access to disallow traditional token publishing and revoke obsolete automation tokens. Do this after verification so maintainers retain a recovery path during migration.

---

## Gotchas — verify, don't assume

- **`fixedExtension` / `hash` are not defaults in tsdown.** Removing them silently changes output to `.mjs` + hashed chunk names and breaks `exports`. Always build and inspect `dist/` before deleting any tsdown option that looks "default-ish."
- **tsc must stay `--noEmit`.** If typecheck ever writes files to `dist`, it'll fight the bundler. The base tsconfig has zero emit options precisely to prevent this.
- **Root-installed `@types/node` is automatically visible unless `types` is explicit.** Keep base `types: []`; merely removing `types: ["node"]` is insufficient because TypeScript otherwise auto-includes visible `@types/*` packages.
- **Omitting `lib` is not platform-neutral.** TypeScript supplies default libraries that include DOM declarations for common targets. Keep base `lib: ["es2023"]`, then opt into DOM per package.
- **Do not put Node tests in the production package tsconfig.** A test import from `node:test` forces that compilation to load Node types and can hide accidental `process` / `Buffer` usage in browser-targeted source. Typecheck tests separately.
- **An arbitrary `tsconfig.test.json` is not discovered by the editor on its own.** Reference it from a root `files: []` solution config. This is editor indexing only; do not turn it into a composite package build graph.
- **`skipNodeModulesBundle: true` is usually redundant.** tsdown already externalizes `dependencies`. Only reach for `external: [...]` when you have a specific dep to force out.
- **Composite Project References + a bundler = pain.** If you find yourself fighting `composite`/rootDir/emit, keep the root references as an editor-only solution index and use build-first package checks instead.
- **Cross-package typecheck fails on a clean repo?** That means typecheck isn't build-first. Make root `typecheck` run `build` first (`pnpm -r run build && pnpm -r run typecheck`), or — at scale — use turbo with `typecheck dependsOn: ["^build"]`.
- **Type-aware lint passes locally but fails in CI with error/any types?** Existing `dist` masked a missing build step. Make root lint/check build-first and reproduce from `pnpm clean`; do not weaken the lint rules.
- **Latest `pnpm/action-setup` cannot self-update to the package's pinned pnpm?** Do not duplicate or downgrade the pnpm version in every workflow. Run `actions/setup-node` first, then `corepack enable pnpm`; Corepack reads the exact root `packageManager`. Remove `setup-node`'s `cache: pnpm` unless pnpm is already available before that action. Keep the lockfile as one YAML document—package-manager bootstrap dependencies do not belong in the project lockfile.
- **Package tarballs contain `src`?** Remove `src` from package `files`. Keep only `dist`, README, LICENSE, and explicit runtime assets; inspect the actual `pnpm pack --dry-run --json` output before publishing.

---

## Adapter-style packages & error layering (mai-kit)

When a package exposes a **generic interface** and multiple **data-source adapters** (this monorepo: `@mai-kit/database`, `@mai-kit/prober`), follow the layout and error rules below. Full project rules live in repo-root **`AGENTS.md`**.

### Package layout

```
packages/<name>/
├── src/
│   ├── index.ts           # public exports
│   ├── error.ts           # package-level errors (base + NotImplemented + guards)
│   ├── models.ts          # generic models / interfaces
│   └── adapters/<source>/ # concrete adapter only
│       ├── error.ts       # adapter-specific errors extending package base
│       └── …
```

- Generic interface + models stay at package root; **never** put LXNS/Diving-Fish-only fields on the generic model.
- Adapters implement the interface; document source-specific APIs only under `adapters/<name>/` and README adapter sections.

### Error hierarchy (hard rule)

```
MaiKitError                              # @mai-kit/shared
  └─ <Package>Error                      # src/error.ts — HTTP / auth / business / cache
       ├─ <Package>NotImplementedError   # src/error.ts — capability missing (source-agnostic)
       └─ <Adapter>Error                 # adapters/<name>/error.ts — that source's failures
```

| Kind | Where | Throw when | Guard |
|------|--------|------------|--------|
| Package base | `src/error.ts` | Request/processing failed | `is<Package>Error` |
| **Package NotImplemented** | `src/error.ts` | Generic method **must** exist on the interface, but this adapter's upstream has **no equivalent** | `is<Package>NotImplementedError` |
| Adapter-specific | `adapters/<name>/error.ts` | Failures of that data source only | `isLxns*` / `isDivingFish*` etc. |

### NotImplemented rules (must follow)

1. **Define once at package root** — e.g. `MaimaiDatabaseNotImplementedError`, `ProberNotImplementedError` — with `method`, optional `adapter` (display string only), `is*NotImplementedError`, inherit package base error.
2. **Adapters reuse the package class** — do **not** invent local `unsupported()` that throws `DivingFishDatabaseError` / `LxnsProberError` for “method not available”.
3. **Keep it distinguishable from HTTP/business failures** — `isDivingFishDatabaseError(notImplemented)` must be **false** so callers can degrade/switch source via `is*NotImplementedError` and treat network errors separately.
4. **Prefer type narrowing** — conditional clients / `*Capability` so unsupported methods are **absent from the type**. Only throw NotImplemented when the interface forces a stub (e.g. full `MaimaiDatabase` with no alias API).
5. **Normalize real failures to package/adapter errors** — never leak raw `fetch` exceptions without wrapping (keep `cause` if useful).

```ts
// ✅ package-level NotImplemented from an adapter
throw new MaimaiDatabaseNotImplementedError({
  method: "getAliasList",
  adapter: "Diving-Fish",
});

// ❌ do not mark “unimplemented” as an adapter HTTP/business error
throw new DivingFishDatabaseError({
  message: "Diving-Fish does not support getAliasList",
});
```

### Catch order (callers)

1. `is*NotImplementedError` → missing capability (swap source / skip)
2. `is<Adapter>Error` → that data source failed
3. `is<Package>Error` → any package error
4. `isMaiKitError` → any mai-kit package

When adding a new adapter or a new generic method the source cannot support: throw the **package** NotImplemented error; update README error section; do not add a parallel adapter-only “unsupported” type.

### No redundant API parameters (hard rule)

Public DTOs and functions must not make callers (or intermediate builders) write the **same fact twice**.

| Avoid | Prefer |
|-------|--------|
| Required derived fields that duplicate source data (e.g. both full `charts` and mandatory `ratingDistribution`) | Compute distributions at use/render time from `charts` |
| Two parallel stats bags (`summary` + always-filled `personalMetrics` with overlapping numbers) | One aggregate bag; optional **full override** only |
| Twin APIs with identical behavior (`foo` + `fooAlias`) | One name; document use cases in JSDoc |
| Requiring data URI **and** path **and** remote fetch for the same asset | Optional fallback chain (URI → path → fetch) |

**Source of truth first.** Example (mai-kit draw `PosterData`): authority = `player` / `charts` / `summary` / `radar`; donut/bar metrics derived at render; `personalMetrics` only as optional wholesale override.

Before adding a parameter: *can this be derived from existing inputs?* If yes, do not add it.

### Public API surface & TypeDoc (hard rule)

**Goal:** `import` surface and the generated API site show only **stable, necessary** exports. Adapter helpers, private methods, and build-only symbols stay out of both package root exports and docs.

| Rule | Detail |
|------|--------|
| **Package root `index` = sole public surface** | TypeDoc `entryPoints` follow each package `src/index.ts` (or multi-entry `exports`). Anything not re-exported from there is internal. |
| **private / protected never in docs** | TypeDoc: `excludePrivate` + `excludeProtected` = `true`. Class privates (e.g. `loadAssets`) must not appear on API pages. |
| **`@internal` never in docs** | `excludeInternal` = `true`. Use `@internal` for convenience re-exports and build helpers—not a vague “hidden” comment alone. |
| **Adapter helpers default private to the package** | Do **not** export `mapXxx*`, snapshot loaders, cover-id helpers from package root. Users use `createXxxClient` / interface methods on the adapter class. |
| **Do not widen exports for tests** | Tests may import `../src/adapters/...` or exercise public APIs only. Never `export` something only so `@scope/pkg` can import it in tests. |
| **Advanced exports must be labeled** | If something must stay public (e.g. layout components), mark `@beta` and note “advanced / may change” in README. |

```ts
// ❌ adapter map on package root
export { mapDivingFishRecord } from "./adapters/diving-fish/mappers";

// ✅ user-facing path only
export { createDivingFishClient } from "./adapters/diving-fish";

// ❌ export getLocalChartTags so tests can import from package name
// ✅ test via database.getChartTags() or import "../src/chart-tags.ts"
```

After changing public exports or visibility, run `pnpm docs:build` (includes generated-api checks that private members / unexported helpers must not appear in API markdown).

Full project wording: repo-root **`AGENTS.md`** →「公开面收窄与 API 文档」.

---

## Reference

This architecture borrows the bundler-first, package-local `tsc --noEmit`, and build-before-typecheck shape used by **Vercel's `vercel/chat` SDK**, while deliberately keeping a stricter platform boundary: neutral ES-only base types, DOM/Node opt-in per package, a separately typechecked Node test project, and a root editor solution index. The build remains pnpm + tsdown rather than a composite `tsc -b` graph.

For **mai-kit domain boundaries, docs vs adapters, and delivery gates**, always also read repo-root **`AGENTS.md`**.
