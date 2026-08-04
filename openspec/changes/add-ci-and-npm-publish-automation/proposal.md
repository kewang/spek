## Why

Nothing in this repository runs tests, type checks, or lint automatically. All three workflows in
`.github/workflows/` are publish/deploy pipelines triggered by tags or `push`; none run on
`pull_request`. Every quality gate is a command a human remembers to type locally (issue #16).

This is not hypothetical. Two independent holes — a root `type-check` that covers only
`@spekjs/web`, and package `tsconfig.json`s that exclude their own test files from checking while
the suites run through `tsx` (which strips types without checking them) — currently hide a real
defect: `packages/core/src/aggregate.test.ts` fails to type-check with two `TS2741`s (`vcs` missing
from `WorktreeInfo`, left behind by the jj aggregation work) while `npm test` reports 60/60 passing.
The same pair of holes produced the `defaultSchema` breakage found by hand during review of #13.
`@spekjs/core` is published to the public registry, so this is exactly the class of defect that
reaches downstream consumers.

Separately, the npm package line is released entirely by hand: bump `package.json`, run
`npm publish`, then write a `chore(npm): publish @spekjs/core@1.4.0` commit. Neither version line
has a single git tag, so "what changed between core 1.3.0 and 1.4.0" cannot be answered from the
repository. More importantly, nothing signals that a release is due — the packages stay current only
because someone happens to notice.

## What Changes

- **Add `.github/workflows/ci.yml`**, running on `pull_request` and `push` to `master`: install,
  build `@spekjs/core`, then test, type-check, lint, and build (including `build:demo`). A separate
  job runs the Kotlin suite (`./gradlew test`, JDK 17) in `packages/intellij`.
- **Smoke-test the composite action in CI.** `action.yml` is the only shipped artifact with no test
  coverage, and `spek-version` defaults to `master`, so a break on master reaches every consumer
  pinned to `@v1` immediately. A CI job invokes the action against this repository and asserts that
  `html-path` and `badges-path` produce actual files.
- **Make `type-check` mean the whole monorepo.** `core`, `ui`, and `vscode` gain a `type-check`
  script; the root script runs all workspaces instead of only `web`.
- **Type-check test files.** The `exclude` patterns that keep `__tests__` / `*.test.ts` out of
  checking are neutralized by a test-inclusive project that CI checks — they cannot simply be
  deleted, because `core` and `ui` build with the same config and would then emit compiled tests
  into the `dist` they publish. Every package's `tsconfig.json` is audited for the same pattern.
- **Type-check `scripts/`.** `scripts/build-demo.ts` and `scripts/generate-badges.ts` are named by
  no `tsconfig.json` in the repository, so nothing checks them — and they are what the composite
  action and the deployed demo page execute.
- **Fix the two `TS2741`s** in `packages/core/src/aggregate.test.ts` that this exposes.
- **Add working lint.** `packages/web` declares `lint` and `format` scripts, but neither `eslint` nor
  `prettier` is installed and no config exists anywhere in the repository — the scripts cannot run.
  They end up either functional and wired into CI, or removed.
- **Add `.github/workflows/npm-publish.yml`.** On `push` to `master`, each of `@spekjs/core` and
  `@spekjs/ui` is compared against the version on the registry; a difference publishes it, an
  identical version is skipped quietly. Authentication uses npm Trusted Publishing (OIDC) — no
  long-lived token in repository secrets — which also attaches provenance automatically. A
  successful publish creates and pushes a `core-vX.Y.Z` / `ui-vX.Y.Z` tag.
- **Extend the `release` skill to cover the npm package line.** It handles only the product line
  today (root version → VS Code + IntelliJ). It gains a step that, for each package, checks whether
  `src/` changed since that package's last publish tag, decides the version bump, updates that
  package's CHANGELOG, and writes the `chore(npm): publish …` commit that CI then acts on.
- **Backfill `core-v*` / `ui-v*` tags** onto the eight existing publish commits, so the tags describe
  the whole history rather than starting from the next release. Tags are only added; none are
  deleted or moved.

Not included: `packages/vscode` still has no test suite. It gains `type-check` here; tests are a
separate change.

## Capabilities

### New Capabilities

- `continuous-integration`: the automated quality gates that run on every pull request and every
  push to `master` — test, type-check, lint, build, the Kotlin suite, and the composite-action smoke
  test — plus the requirement that the same gates are runnable locally by the same commands.
- `npm-package-cicd`: how `@spekjs/core` and `@spekjs/ui` reach the npm registry — the version-diff
  trigger, OIDC authentication, provenance, the release tag created on success, and where the
  version-bump decision is made.

### Modified Capabilities

None. `core-module` and `ui-package` already require *that* each package is published and what its
tarball contains; those requirements are unchanged. What is new is *how* a publish is triggered and
authenticated, which is a separate capability, parallel to the existing `vscode-cicd` and
`intellij-cicd`.

## Impact

**New files**: `.github/workflows/ci.yml`, `.github/workflows/npm-publish.yml`, an ESLint flat
config at the repository root.

**Modified**: root `package.json` (`type-check`, `lint`, dev dependencies);
`packages/{core,ui,vscode}/package.json` (`type-check` script); `packages/{core,ui}/tsconfig.json`
(remove the test excludes); `packages/web/package.json` (make `lint`/`format` real or remove them);
`packages/core/src/aggregate.test.ts` (the two type errors);
`.agents/skills/release/SKILL.md` (the npm package line step); `CLAUDE.md` and `CONTRIBUTING.md`
(the gates now exist and are enforced).

**Repository configuration, outside the repository**: the user must register a trusted publisher for
both `@spekjs/core` and `@spekjs/ui` on npmjs.com, pointing at `spekhq/spek` and the workflow
filename. Until that is done the publish job cannot authenticate. The workflow filename is part of
that registration and matched exactly, so renaming `npm-publish.yml` later silently breaks
publishing.

**Release-notes-relevant**: no public API of either package changes. The `release` skill's behavior
changes for whoever cuts the next release — it now also handles `@spekjs/core` and `@spekjs/ui`
rather than leaving them to a manual afterthought.

**Deliberately deferred**: no CI drift detector that watches for unreleased package changes. The
`release` skill is the checkpoint, and all eight npm publishes to date landed on the same day as a
product `v*` tag, so the two release lines already move together. Once the tags above exist, adding
a detector is a `git diff core-v1.4.0..HEAD -- packages/core/src` away if drift ever appears.
