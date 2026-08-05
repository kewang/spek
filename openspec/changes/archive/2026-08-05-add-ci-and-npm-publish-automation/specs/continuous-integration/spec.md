## ADDED Requirements

### Requirement: Quality gates run on every pull request and every push to master

The repository SHALL provide a GitHub Actions workflow that runs the quality gates — tests, type
checking, lint, and builds — on every `pull_request` and on every `push` to `master`.

The workflow SHALL NOT be limited to tag pushes. Every other workflow in this repository is a
publish pipeline gated on a tag; a gate that only runs at release time cannot prevent a defect from
reaching `master`, which is what `spek-version: master` (the composite action's default) exposes to
consumers.

#### Scenario: Pull request opened

- **WHEN** a pull request is opened or updated against `master`
- **THEN** the workflow runs and reports a status on the pull request

#### Scenario: Push to master

- **WHEN** a commit is pushed to `master`
- **THEN** the workflow runs against that commit

#### Scenario: Failing gate blocks the report

- **WHEN** any gate — test, type check, lint, or build — fails
- **THEN** the workflow is marked failed

### Requirement: Every workspace package resolved through its dist is built before the gates

The workflow SHALL build **both** `@spekjs/core` and `@spekjs/ui` after installing dependencies and
before running the type check or any build that imports them. It SHALL NOT assume that installing
dependencies produced either one.

Both packages' entry points are `dist/`, so `@spekjs/web` type-checks against
`packages/core/dist/*.d.ts` and `packages/ui/dist/*.d.ts` rather than against their sources. Neither
`dist` survives a fresh `npm ci`: core's build is on `prepare`, and ui's is deliberately on
`prepublishOnly`, because a `prepare` hook would run before npm creates the workspace symlinks and
take the whole install down (see `ui-package`).

The failure is invisible to local runs, where a `dist` from an earlier build is always present, and
it does not name its cause — it surfaces as `TS2307: Cannot find module '@spekjs/ui'` plus a spray
of implicit-`any` errors in the files that imported it.

#### Scenario: Fresh runner checkout

- **WHEN** the workflow runs on a runner with no pre-existing `packages/core/dist` or
  `packages/ui/dist`
- **THEN** both packages are built before the type check runs
- **AND** the type check reports only errors attributable to the checked-out code

#### Scenario: A newly added workspace package resolved through dist

- **WHEN** a workspace package that resolves through a built `dist` is added and imported by another
  package that the gates check
- **THEN** the workflow builds it before the gates, rather than relying on an install-time hook

### Requirement: The type check covers every TypeScript source in the repository

The root `type-check` script SHALL check every workspace that contains TypeScript — `@spekjs/core`,
`@spekjs/ui`, `@spekjs/web`, and `spek-vscode` — and each of those workspaces SHALL expose its own
`type-check` script. It SHALL also cover the repository-root `scripts/` directory.

A root script that checks a single workspace reports success for the monorepo while three of four
packages are unchecked. `@spekjs/core` and `@spekjs/ui` are published to the public registry, so an
unchecked package is one whose type errors reach consumers.

`scripts/build-demo.ts` and `scripts/generate-badges.ts` are named by no `tsconfig.json` in the
repository, so nothing checks them at all — and they are what the composite action and the published
demo page actually execute.

#### Scenario: Root type check covers all workspaces

- **WHEN** `npm run type-check` is run at the repository root
- **THEN** `@spekjs/core`, `@spekjs/ui`, `@spekjs/web`, and `spek-vscode` are each type-checked

#### Scenario: Root scripts are type-checked

- **WHEN** `npm run type-check` is run at the repository root
- **THEN** the TypeScript files under `scripts/` are type-checked

#### Scenario: A type error in any workspace fails the check

- **WHEN** a type error is introduced in any one of those workspaces, or under `scripts/`
- **THEN** `npm run type-check` exits non-zero

### Requirement: Type-checking test files does not change what is published

Including test files in type checking SHALL NOT cause them to be emitted into any package's build
output.

`@spekjs/core` and `@spekjs/ui` build with the same `tsconfig.json` that carries the test `exclude`,
and both emit to `dist` while declaring `files: ["dist"]`. Removing the exclude outright would put
compiled test files into the published tarball — trading a silent gap for a silent regression in
what consumers download.

#### Scenario: Published tarball carries no tests

- **WHEN** either package's tarball is inspected after this change
- **THEN** it contains no compiled test file

#### Scenario: Build output carries no tests

- **WHEN** `npm run build` completes for either package
- **THEN** `dist/` contains no compiled test file

### Requirement: Test files are type-checked

Every package's TypeScript configuration SHALL include that package's test files in type checking.
No package SHALL exclude its own tests from the type check.

The test suites run through `tsx`, which strips types without checking them, so a type-invalid test
file runs green. Combined with an exclude, a broken test fixture is invisible to both gates at once:
`packages/core/src/aggregate.test.ts` currently fails to type-check with two `TS2741`s while
`npm test` reports every test passing, and the same pair of holes hid the `defaultSchema` breakage
in `packages/ui`.

#### Scenario: Type-invalid test fixture fails the check

- **WHEN** a test file constructs a fixture that does not satisfy the type it is passed as
- **THEN** `npm run type-check` exits non-zero, naming that test file

#### Scenario: No package excludes its own tests

- **WHEN** each package's `tsconfig.json` (or the project the type check runs) is inspected
- **THEN** none of them excludes that package's test files from type checking

### Requirement: Lint is real and enforced

The repository SHALL provide a working lint setup — a configuration and the tools it needs — exposed
through a root `lint` script and run by the workflow. A package SHALL NOT declare a `lint` or
`format` script that cannot execute.

`packages/web` declares both today while neither `eslint` nor `prettier` is installed and no
configuration exists anywhere in the repository. A script that exits with a "command not found"
class of error is worse than no script: it reads as a gate that exists.

#### Scenario: Root lint runs

- **WHEN** `npm run lint` is run at the repository root on a clean checkout after `npm ci`
- **THEN** the linter executes and reports results

#### Scenario: Lint failure fails the workflow

- **WHEN** the linter reports an error
- **THEN** the workflow is marked failed

#### Scenario: No unrunnable script is declared

- **WHEN** any workspace's `package.json` declares a `lint` or `format` script
- **THEN** that script executes successfully on a clean checkout after `npm ci`

### Requirement: The Kotlin suite runs in CI

The workflow SHALL run `packages/intellij`'s Gradle test suite on JDK 17, in a job separate from the
Node gates.

`packages/intellij` re-implements the core scanning rules in Kotlin (`ArtifactDiscovery.kt`,
`SchemaOrder.kt`, `TaskParser.kt`), with its own tests under `src/test/kotlin`. Those rules are
aligned with the TypeScript ones by convention only — nothing links them — so the Kotlin suite is
the only thing that observes a divergence.

#### Scenario: Gradle tests run

- **WHEN** the workflow runs
- **THEN** `./gradlew test` executes in `packages/intellij` on JDK 17

#### Scenario: Kotlin test failure fails the workflow

- **WHEN** a Kotlin test fails
- **THEN** the workflow is marked failed

### Requirement: The composite action is smoke-tested

The workflow SHALL invoke the composite action defined by `action.yml` against this repository, with
badge generation enabled, and SHALL assert that the files named by the `html-path` and `badges-path`
outputs exist and are non-empty.

`action.yml` is the only shipped artifact with no test coverage, and it fails silently: moving
`@spekjs/ui`'s build from `prepare` to `prepublishOnly` removed the action's only source of ui
`dist` and the Marketplace action was broken for a full day with nothing raising an alarm. Asserting
that the outputs merely have values is not sufficient — a step output is set whether or not the
build produced anything.

#### Scenario: Action produces the HTML

- **WHEN** the smoke job runs the action against this repository
- **THEN** the file at the `html-path` output exists and is non-empty

#### Scenario: Action produces badges

- **WHEN** the smoke job runs the action with `generate-badges: "true"`
- **THEN** the directory at the `badges-path` output exists and contains at least one badge file

#### Scenario: Broken build chain fails the job

- **WHEN** the action's build chain stops producing a workspace package's `dist`
- **THEN** the smoke job fails rather than reporting success with an empty output

### Requirement: The gates are runnable locally by the same commands

Every gate the workflow runs SHALL be invocable locally through a documented root npm script, and
the workflow SHALL invoke those same scripts rather than reimplementing a gate inline.

A gate that only exists inside a workflow file cannot be reproduced by a contributor before pushing,
and drifts from what the scripts do.

#### Scenario: Contributor reproduces CI locally

- **WHEN** a contributor runs the documented root scripts for test, type check, lint, and build
- **THEN** they exercise the same gates the workflow runs

#### Scenario: Gates are documented

- **WHEN** a contributor reads `CONTRIBUTING.md`
- **THEN** it names the commands that must pass before opening a pull request
