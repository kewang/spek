## Context

The repository ships five surfaces (Web, VS Code, IntelliJ, the demo page, the composite action) and
publishes two npm packages, with no automated gate on any of it. The three existing workflows all
publish or deploy; none runs on `pull_request`.

Constraints that shape the design:

- **`@spekjs/core`'s package entry is `dist/`.** `web` and `ui` type-check against
  `packages/core/dist/*.d.ts`, not core's sources, so any gate must build core first or it reports
  errors unrelated to the change under test.
- **`core` and `ui` build and type-check with the same `tsconfig.json`**, which emits to `dist` and
  is what `files: ["dist"]` publishes. The test `exclude` is therefore load-bearing for the build
  even though it is a hole in the check.
- **`@spekjs/ui` builds at publish time, not install time.** A `prepare` hook runs before npm creates
  the workspace symlinks, so ui's build cannot resolve `@spekjs/core` and takes `npm ci` down with
  it. Anything needing ui's `dist` must build it explicitly.
- **The composite action checks out `spekhq/spek` at `spek-version` (default `master`) into
  `.spek-builder`** and builds from that copy — not from the caller's checkout.
- **npm Trusted Publishing requires npm ≥ 11.5.1 and Node ≥ 22.14.0.** `.nvmrc` pins Node 22.22.0,
  which satisfies the Node floor but ships npm 10.9.4 — below the npm floor.

## Goals / Non-Goals

**Goals:**

- A pull request cannot merge without tests, type checks, lint, and builds having run.
- The type check means the whole repository, including test files and `scripts/`.
- The composite action has a gate that observes whether it actually produces output.
- Publishing `@spekjs/core` / `@spekjs/ui` requires no local `npm publish` and no stored token.
- Both package version lines become navigable from git history.

**Non-Goals:**

- Tests for `packages/vscode` (it gains `type-check` only).
- A CI detector for unreleased package changes — see "Deliberately deferred" in the proposal.
- Reformatting the repository. Introducing Prettier would rewrite nearly every file; see Decisions.
- Changing how the product line (`v*` tags → VS Code / IntelliJ Marketplaces) is released.
- Branch protection rules. Those are repository settings, not files, and are the maintainer's to
  apply once the workflow reports a stable status name.

## Decisions

### Two workflows, not one

`ci.yml` (gates) and `npm-publish.yml` (publishing) stay separate files.

The publishing workflow's filename is registered with the npm registry and matched exactly, so it is
effectively immutable configuration. Folding the gates into it would make an ordinary CI refactor
able to break publishing. Keeping them apart means `ci.yml` can be reorganized freely.

*Alternative considered*: one workflow with a conditional publish job. Rejected for the coupling
above.

### The publish job re-runs the gates itself rather than chaining on CI

`npm-publish.yml` runs install → build core → test → type-check itself before publishing, instead of
triggering on `workflow_run` after `ci.yml` succeeds.

`workflow_run` evaluates the workflow file from the default branch rather than the triggering
commit, and its success/failure coupling is easy to get subtly wrong — a misconfiguration publishes
on a red build, which is unrecoverable because a published version cannot be withdrawn. A
self-contained job is auditable in one file.

The cost is duplicated work, but only on a push that actually publishes: eight times in four months.

*Alternative considered*: `workflow_run` chaining. Rejected — the failure mode is unrecoverable and
the saving is negligible at this frequency.

### Version-diff detection, skipping quietly

For each package, compare the declared version against the registry (`npm view <pkg>@<version>`), and
publish only on a difference. A version already on the registry is a **skip with a successful exit**,
not a failure.

Nearly every push to `master` changes no version. A workflow that errors on "already published"
would make red the normal state of `master`, and a real failure would be indistinguishable from the
noise.

*Alternative considered*: a dedicated `core-v*` tag push as the trigger. Rejected — the version bump
is already the deliberate, reviewed act; a second signal adds a step that can be forgotten without
adding information. (The tags still exist — they are created *by* a successful publish, so they
record what happened rather than gating it.)

### npm CLI is upgraded in the job

The job runs `npm install -g npm@latest` (or a pinned `npm@^11.5.1`) after `setup-node` and before
publishing.

`.nvmrc`'s Node 22.22.0 bundles npm 10.9.4, which predates trusted publishing. Without this the job
fails at the publish step with an authentication error that does not name the cause.

### One flat workflow, no reusable-workflow indirection

The publish steps live directly in `npm-publish.yml`.

npm's OIDC validation checks the *calling* workflow's name when a reusable workflow is involved, so
the registered filename would no longer match what runs. `id-token: write` would also have to be
granted at both levels.

### Permissions and concurrency

The publish job requests `id-token: write` (OIDC) and `contents: write` (pushing the release tag),
and takes a `concurrency` group so two rapid pushes to `master` cannot race into a double publish.
`ci.yml` needs neither write permission.

### Test files are checked by a separate project, not by deleting the exclude

Each of `core` and `ui` gains a `tsconfig.test.json` that extends its build config, clears the test
`exclude`, and sets `noEmit`. The `type-check` script runs both the build config and the test
config; `build` keeps using the unchanged build config.

Deleting the exclude from `tsconfig.json` would compile `aggregate.test.ts` into `dist/`, and
`files: ["dist"]` would publish it — trading a silent gap for a silent regression in what consumers
download. `web` already includes its tests under a `noEmit` config and needs nothing; `vscode` builds
through esbuild and its `tsconfig.json` is already `noEmit`, so it only needs the script.

`scripts/` gets a small `tsconfig.scripts.json` at the root, since no existing project names it.

The stale root `tsconfig.json` — project references listing only `core` and `web`, invoked by
nothing — is **removed**. No script runs `tsc -b`, no tool resolves it (the language server and
typescript-eslint both find the nearest per-package config), and the `type-check` script is now the
single description of what gets checked. A second, partial description of the project graph is a
drift source of exactly the kind this change exists to remove.

### The smoke job must pin the action to the commit under test

The smoke job invokes the action with `spek-version: ${{ github.sha }}`.

The action checks out `spekhq/spek` at `spek-version` and builds from *that* copy. Left at the
default `master`, the job would run the pull request's workflow file against master's action
implementation and report green on a pull request that breaks the action — precisely the failure it
exists to catch.

It must run the real action rather than calling `build-demo.ts` / `generate-badges.ts` directly: the
regression this guards against was in the action's own build chain, not in the scripts.

Assertions are on file contents, not on output values — a step output is set whether or not the
build produced anything, which is how the ui-`dist` breakage stayed invisible.

*Observed*: the pinned checkout resolves on a same-repository pull request — PR #36's smoke job
passed, checking out `github.sha` (the `refs/pull/N/merge` commit) from `spekhq/spek` without
special handling.

*Fork caveat, still unobserved*: a fork's pull request produces a merge commit in the **base**
repository by the same mechanism, so it is expected to resolve identically — but no fork PR has run
against this workflow yet, and the action hard-codes `repository: spekhq/spek`, so a fork's own
commits are genuinely absent from what it checks out. If a fork PR fails here, the fallback is to
run the smoke job on `push: master` only: that catches a break after merge instead of before, which
is still strictly better than not running the action at all. Decide it on the first fork
contribution rather than pre-emptively.

### ESLint only; no Prettier

Add a flat ESLint config at the root (`typescript-eslint` recommended plus `eslint-plugin-react-hooks`
for the web and ui sources) and a root `lint` script. Do not add Prettier; remove
`packages/web`'s dead `format` script.

The codebase is already formatted consistently. Introducing Prettier would rewrite nearly every file
in one commit, destroying `git blame` for no defect caught. `react-hooks` earns its place — this
codebase's correctness lives in hooks (`useFileWatcher`, `refreshTracker`, the aggregation-scope
context), where a missing dependency is a real bug rather than a style opinion.

The rule set starts at the recommended baseline. A stricter set would land with a violation backlog
that has to be either fixed in the same change or suppressed, and a config suppressed into silence
is the same dead gate this change is removing.

### Tag namespace and backfill

Release tags are `core-vX.Y.Z` and `ui-vX.Y.Z`, deliberately outside the product `v*` namespace so
the existing publish workflows' `v[0-9]+.[0-9]+.[0-9]+` patterns cannot match them.

All twelve published versions map to a commit that declared them:

| tag | commit | tag | commit |
|---|---|---|---|
| `core-v1.0.0` | `66ffd31` | `core-v1.3.0` | `e66e631` |
| `core-v1.1.0` | `0257e9b` | `core-v1.4.0` | `0f5c162` |
| `core-v1.1.1` | `2e65a11` | `ui-v1.0.0` | `0939532` |
| `core-v1.1.2` | `bc4df70` | `ui-v1.0.1` | `2e65a11` |
| `core-v1.1.3` | `baa08b4` | `ui-v1.1.0` | `b54639e` |
| `core-v1.2.0` | `8395812` | `ui-v1.2.0` | `494f8ce` |

`2e65a11` carries two tags — it published both packages. Three versions (`core-v1.0.0`,
`core-v1.1.0`, `ui-v1.0.0`) predate the `chore(npm): publish …` message convention, which is why the
convention cannot be the anchor and the tags must be.

Only additions: no existing tag is moved or deleted.

### The version decision stays in the release skill

`.agents/skills/release/SKILL.md` gains a step covering the package line: for each package, diff
`packages/<pkg>/src` against that package's last release tag; if it changed, decide the increment
from the archived changes' stated impact, update that package's CHANGELOG, bump the version, and
commit `chore(npm): publish @spekjs/<pkg>@X.Y.Z`. CI takes it from there.

Deriving the increment from commit prefixes was measured against this repository's history and gets
it wrong half the time (proposal, and the `npm-package-cicd` spec). The information needed to decide
correctly — "this adds a public export", "this changes observable behavior" — is already required to
be recorded in a change's proposal or design by project convention. The release flow is where that
record is read.

## Risks / Trade-offs

**Publishing cannot work until the trusted publisher is registered** → The workflow authenticates
only after the maintainer configures a trusted publisher for both packages on npmjs.com, pointing at
`spekhq/spek` and `npm-publish.yml`. Until then a version bump reaching `master` fails the publish
job. Do the registration before the first version bump lands, and verify with a deliberate patch
release.

**A workflow rename silently breaks publishing** → The registered filename is matched exactly; a
rename leaves a workflow that runs, resolves the version difference, and fails only at
authentication. Mitigated by a comment at the top of the file and a note in `CLAUDE.md`, which is the
same mechanism already used for the action's build-chain trap.

**Turning on lint surfaces an unknown backlog** → The violation count is not knowable until ESLint
is installed. Run it as the first step of that task, before writing the config, and size the rule
set to what can be fixed in this change. Disabling a rule is acceptable when recorded with a reason;
shipping a config that fires on nothing is not.

**Type-checking tests surfaces more than the two known errors** → Only `core` was measured
(`aggregate.test.ts`, two `TS2741`s); `ui` was measured clean, `web` already checks its tests, and
`scripts/` has never been checked at all. Others may appear. They are in scope — that is the point
of the change — but the count could exceed the estimate.

**The smoke job is slow and network-dependent** → It performs a full `npm ci` plus core/ui builds
inside `.spek-builder`, and fetches the OpenSpec CLI. Keep it a separate job so it does not delay the
fast gates, and let its optional CLI install keep failing soft as it already does.

**Publishing on `push: master` fires while a branch is mid-merge-train** → The concurrency group
serializes runs; the version-diff check makes a second run a quiet skip rather than a double publish.

## Migration Plan

1. Land the gates (`ci.yml`, type-check expansion, test-inclusive projects, the `aggregate.test.ts`
   fix, lint) first. This is self-contained and reversible — deleting the workflow restores the
   status quo.
2. Backfill the twelve tags and push them. Additive; nothing depends on them yet.
3. Register the trusted publisher for both packages on npmjs.com.
4. Land `npm-publish.yml` and the release-skill step.
5. Verify with a deliberate patch release of one package, checking that the publish succeeds, the
   provenance attestation appears on the registry, and the release tag lands on the right commit.

Rollback: each step is a file deletion or a tag that nothing reads. A failed publish leaves the
registry untouched, since the tag is created only after a successful publish.

## Verified at implementation time

- **The gates run and catch what they exist to catch.** PR #36's first run failed on this workflow's
  own missing ui build; a throwaway PR (#37, closed unmerged) confirmed the original hole is closed —
  `Test` passed 267 assertions and `Type check` then failed with the expected `TS2741`.
- **The smoke job's assertions** were exercised against five shapes (valid output, empty HTML, no
  badge, missing file, empty output value), and the causal chain confirmed: with `ui/dist` removed,
  `build-demo.ts` exits 1 and produces nothing.
- **The publish workflow's skip path ran for real** when #36 merged: both packages were detected as
  already on the registry, the publish job was skipped, and the run was green. Nothing was published
  and no tag was created.
- **`spek-version: ${{ github.sha }}` resolves** on a same-repository pull request.

## Knowingly unverified

**The OIDC authentication step has never executed.** Reaching it requires an actual `npm publish`,
and neither package's `src/` had changed since its last release — so under this change's own rules
neither was due for one, and publishing an identical tarball under a new number purely to test the
pipeline is not a trade worth making against a registry that cannot be un-published.

What *is* verified is everything up to that point: the version comparison against the real registry
(across four cases), the check job on a real runner, the job-to-job output passing, and the skip
path. What remains unknown is whether the trusted-publisher registration and the npm upgrade are
correct.

The cost of finding out late is bounded: a failed publish leaves the registry untouched, and the tag
is created only after a successful publish, so a first-release failure means re-running the workflow
rather than cleaning anything up. This is why the verification was dropped rather than forced.

## Open Questions

- Whether the smoke job's `spek-version: ${{ github.sha }}` resolves for a fork pull request. Decide
  on observation at the first fork contribution; the fallback is stated above.
- How large the initial ESLint backlog is, and therefore how much of the recommended rule set can
  land enabled in this change.
