## 1. Make the type check cover the repository

- [x] 1.1 Add `tsconfig.test.json` to `packages/core` and `packages/ui`, each extending that
      package's `tsconfig.json`, clearing the test `exclude` and setting `noEmit: true`. Leave the
      build `tsconfig.json` untouched — it emits into the published `dist`.
- [x] 1.2 Add a `tsconfig.scripts.json` at the repository root covering `scripts/*.ts` with
      `noEmit: true`.
- [x] 1.3 Add a `type-check` script to `packages/core`, `packages/ui`, and `packages/vscode`. For
      core and ui it runs both the build config and the test config with `--noEmit`.
- [x] 1.4 Change the root `type-check` script to run every workspace plus the scripts config,
      replacing the current web-only invocation.
- [x] 1.5 Resolve the stale root `tsconfig.json` (project references naming only core and web,
      consumed by nothing) — repair it to match the current package set or remove it.
- [x] 1.6 Fix the two `TS2741`s in `packages/core/src/aggregate.test.ts` (missing `vcs` on the
      `WorktreeInfo` fixtures at lines 269-270).
- [x] 1.7 Run `npm run build:core && npm run type-check` and fix everything it now reports. Note
      that only core's tests were measured beforehand; `scripts/` has never been type-checked.
- [x] 1.8 Verify `npm run build -w @spekjs/core` and `npm run build -w @spekjs/ui` still emit no
      test file into `dist/`, and that `npm pack --dry-run` for each carries none.

## 2. Add working lint

- [x] 2.1 Install ESLint with `typescript-eslint` and `eslint-plugin-react-hooks` as root dev
      dependencies. Do not add Prettier.
- [x] 2.2 Run ESLint with the recommended baseline before writing the final config, to size the
      violation backlog and decide which rules can land enabled.
- [x] 2.3 Add a flat ESLint config at the repository root covering `packages/*/src`,
      `packages/web/server`, and `scripts/`. Record a reason inline for any rule disabled to keep
      the backlog manageable.
- [x] 2.4 Fix the violations the enabled rule set reports.
- [x] 2.5 Add a root `lint` script; make `packages/web`'s `lint` script functional and delete its
      dead `format` script.
- [x] 2.6 Verify `npm run lint` passes from a clean `npm ci`.

## 3. Add the CI workflow

- [x] 3.1 Create `.github/workflows/ci.yml` triggered on `pull_request` and `push` to `master`.
- [x] 3.2 Add the Node job: `npm ci` → `npm run build:core` → `npm test` → `npm run type-check` →
      `npm run lint` → `npm run build` → `npm run build:demo`. Invoke the root scripts rather than
      reimplementing any gate inline. Build core before the type check.
- [x] 3.3 Set `NODE_ENV=production` for the `build:demo` step so CI does not exercise a different
      build than the one that ships.
- [x] 3.4 Add the Kotlin job: JDK 17 (temurin) + `./gradlew test` in `packages/intellij`, running in
      parallel with the Node job.
- [x] 3.5 Confirm the workflow needs no write permissions and declare the minimum explicitly.

## 4. Smoke-test the composite action in CI

- [x] 4.1 Add a smoke job to `ci.yml` that invokes the action from `./` with
      `generate-badges: "true"` and `spek-version: ${{ github.sha }}` — the default `master` would
      test master's action implementation instead of the commit under test.
- [x] 4.2 Assert the file at the `html-path` output exists and is non-empty, and that the
      `badges-path` directory exists and holds at least one badge file. Assert on file contents, not
      on the output values being set.
- [x] 4.3 Verify the job fails when the action's build chain is broken — temporarily remove the
      `Build @spekjs/ui` step from a scratch branch, confirm the job goes red, then restore it.
- [x] 4.4 Observe whether the pinned `spek-version` resolves on a fork pull request. If it does not,
      restrict the smoke job to `push: master` and record why in the workflow file.
      *Observed on a same-repo PR (#36): resolves, smoke job passes. A fork PR has still not run —
      recorded in design.md as the remaining unknown, with the `push: master` fallback.*

## 5. Backfill the package release tags

- [x] 5.1 Create the twelve annotated tags on the commits listed in the design's backfill table
      (`core-v1.0.0` … `core-v1.4.0`, `ui-v1.0.0` … `ui-v1.2.0`; `2e65a11` carries two).
- [x] 5.2 Verify each tagged commit's `packages/<pkg>/package.json` declares the version the tag
      names, and that no existing tag was moved or deleted.
- [x] 5.3 Push the tags to origin.

## 6. Add the npm publish workflow

- [x] 6.1 Register a trusted publisher for `@spekjs/core` and `@spekjs/ui` on npmjs.com, pointing at
      `spekhq/spek` and the workflow filename `npm-publish.yml`. **Maintainer action outside the
      repository; publishing cannot authenticate until it is done.**
- [x] 6.2 Create `.github/workflows/npm-publish.yml` on `push` to `master`, with
      `id-token: write` + `contents: write` and a concurrency group. Open the file with a comment
      stating that its filename is registered with the npm registry and must not be renamed without
      re-registering.
- [x] 6.3 Run the gates in the job before publishing: `npm ci` → `npm run build:core` → `npm test` →
      `npm run type-check`. Do not chain on `ci.yml` via `workflow_run`.
- [x] 6.4 Install npm ≥ 11.5.1 after `setup-node` — the Node pinned by `.nvmrc` bundles npm 10.9.4,
      which predates trusted publishing.
- [x] 6.5 For each package, compare the declared version against the registry and publish only on a
      difference; an already-published version exits successfully without publishing.
- [x] 6.6 On a successful publish, create and push the matching `core-vX.Y.Z` / `ui-vX.Y.Z`
      annotated tag. Create no tag when the package was skipped.
- [x] 6.7 Keep the workflow flat — no reusable-workflow indirection, which breaks npm's OIDC
      filename validation.

## 7. Extend the release skill to the package line

- [x] 7.1 Add a step to `.agents/skills/release/SKILL.md` that, for each of `@spekjs/core` and
      `@spekjs/ui`, diffs `packages/<pkg>/src` against that package's last release tag and reports
      whether a release is due.
- [x] 7.2 Specify how the increment is decided: from the archived changes' stated impact (a new
      public export, a behavior change observable by a consumer), never from commit prefixes. Cite
      core 1.3.0 and 1.4.0 as the worked examples of why.
- [x] 7.3 Specify the outputs of the step — that package's CHANGELOG updated, its version bumped,
      and a `chore(npm): publish @spekjs/<pkg>@X.Y.Z` commit written — and that CI publishes from
      there, so the skill no longer runs `npm publish` locally.
- [x] 7.4 Add a guardrail covering the case where neither package changed: bump neither, and say so.

## 8. Update the documentation the gates change

- [x] 8.1 Update `CONTRIBUTING.md` to name the commands that must pass before opening a pull
      request, and to state that CI runs them.
- [x] 8.2 Update `CLAUDE.md`: `action.yml` is no longer untested (revise the "zero test coverage"
      section to describe the smoke job and what it does not cover), record the npm publish flow and
      the workflow-filename trap, and correct the "Development Commands" list where `type-check` and
      `lint` now mean something different.
- [x] 8.3 Update the `README` / `README.zh-TW` development sections if they name the old
      `type-check` scope.

## 9. Verify

- [x] 9.1 Run `npm run build:core && npm test && npm run type-check && npm run lint && npm run build`
      locally from a clean `npm ci` and confirm all pass.
- [x] 9.2 Run `./gradlew test` in `packages/intellij` and confirm it passes.
- [x] 9.3 Open a pull request and confirm every job reports, including the smoke job.
- [x] 9.4 Confirm a pull request that introduces a type error in a test file is caught — the hole
      this change exists to close.
      *Verified on throwaway PR #37 (closed unmerged): `Test` passed 267 assertions, `Type check`
      then failed with the expected `TS2741`.*
