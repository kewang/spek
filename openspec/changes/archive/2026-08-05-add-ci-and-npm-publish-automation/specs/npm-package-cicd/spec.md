## ADDED Requirements

### Requirement: Publishing is triggered by a version difference against the registry

The repository SHALL provide a GitHub Actions workflow that, on every `push` to `master`, compares
each publishable package's declared `version` against the version published on the npm registry, and
publishes that package when the two differ.

`@spekjs/core` and `@spekjs/ui` SHALL be evaluated independently: one may publish while the other
does not.

The trigger is the version field rather than a dedicated tag because the version bump is already a
deliberate, reviewed act performed by the release flow; requiring a second signal adds a step that
can be forgotten without adding information.

#### Scenario: Version differs from the registry

- **WHEN** a commit lands on `master` in which `packages/core/package.json` declares a version not
  present on the registry
- **THEN** `@spekjs/core` is published at that version

#### Scenario: Packages evaluated independently

- **WHEN** only `@spekjs/ui`'s version differs from the registry
- **THEN** `@spekjs/ui` is published and `@spekjs/core` is not

#### Scenario: Already-published version is skipped quietly

- **WHEN** a commit lands on `master` in which a package's declared version is already on the
  registry
- **THEN** that package is not published
- **AND** the workflow succeeds rather than failing

The skip must not fail. Most pushes to `master` change neither version, so a workflow that errors on
"already published" would report a red `master` as its normal state, and a genuine failure would be
indistinguishable from the noise.

### Requirement: Publishing authenticates through OIDC, not a stored token

The workflow SHALL authenticate to the npm registry using npm Trusted Publishing (OIDC). It SHALL
NOT read a long-lived npm token from repository secrets.

The job SHALL request the `id-token: write` permission, and SHALL ensure an npm CLI new enough to
perform a trusted publish before invoking `npm publish` — the Node version pinned by `.nvmrc` ships
an npm older than the minimum, so relying on the bundled npm fails.

Trusted publishing attaches a provenance attestation automatically. Both packages already declare
the `repository` URL and `directory` that provenance requires.

#### Scenario: No npm token in the repository

- **WHEN** the repository's secrets and workflow files are inspected
- **THEN** no npm authentication token is stored or referenced

#### Scenario: Publish carries provenance

- **WHEN** a package is published by the workflow
- **THEN** the published version carries a provenance attestation linking it to the workflow run and
  commit that produced it

#### Scenario: npm CLI too old to publish

- **WHEN** the workflow runs on a Node version whose bundled npm predates trusted publishing support
- **THEN** the workflow installs a new enough npm before publishing, rather than failing at the
  publish step

### Requirement: The publishing workflow's filename is part of its configuration

The publishing workflow's filename SHALL be treated as configuration shared with the npm registry
and SHALL NOT be renamed without re-registering it. The repository SHALL record this constraint
where someone renaming the file would encounter it.

A trusted publisher is registered on npmjs.com against a specific repository *and workflow
filename*, matched exactly. Renaming the file leaves a workflow that still runs, still resolves the
version difference, and fails only at the authentication step — with no indication that a rename
caused it.

#### Scenario: Constraint is discoverable at the file

- **WHEN** a maintainer opens the publishing workflow
- **THEN** the file states that its name is registered with the npm registry and must not be changed
  without re-registering

### Requirement: A successful publish creates a release tag

On a successful publish, the workflow SHALL create and push an annotated tag naming the package and
the published version, distinct from the product `v*` tag namespace — `core-vX.Y.Z` for
`@spekjs/core` and `ui-vX.Y.Z` for `@spekjs/ui`.

Neither package line has any tag today, so "what changed between core 1.3.0 and 1.4.0" cannot be
answered from the repository; the only available anchor is a `chore(npm): publish …` commit-message
convention, which nothing enforces.

The repository SHALL also carry tags for the versions published before this workflow existed, so the
tags describe the entire published history rather than starting mid-stream.

#### Scenario: Tag created on publish

- **WHEN** `@spekjs/core` is published at 1.4.1 by the workflow
- **THEN** an annotated tag `core-v1.4.1` is created on the published commit and pushed to origin

#### Scenario: No tag when nothing is published

- **WHEN** the workflow skips a package because its version is already on the registry
- **THEN** no tag is created for that package

#### Scenario: Historical versions are tagged

- **WHEN** the tags are listed after this change is implemented
- **THEN** every previously published version of both packages has a corresponding tag on the commit
  that published it

#### Scenario: Product tags are unaffected

- **WHEN** package tags are created
- **THEN** the product `v*` tag namespace is untouched, and no existing tag is moved or deleted

### Requirement: The version bump is decided by the release flow, not derived from commit messages

The choice of version increment SHALL be made by the release flow — which reads the archived
changes' stated impact — and SHALL NOT be inferred from commit message prefixes.

This repository's own history shows the inference is unreliable. `@spekjs/core` 1.3.0 came from a
single `fix(core,ui):` commit that added the `./graph-node-id` export subpath, and 1.4.0 from three
`fix:` / `test:` commits that changed `TaskItem.text`'s semantics for consumers. A
conventional-commit rule would have published 1.2.1 and 1.3.1 — under-bumping two of the last four
core releases. A published version cannot be withdrawn, so an under-bump is corrected only by
publishing again.

This is why the project convention requires a change that affects registry consumers — a new public
export, a behavior change, additive-so-minor-not-patch — to record that in its proposal or design
for whoever cuts the release.

#### Scenario: Release flow covers the package line

- **WHEN** the release flow runs
- **THEN** it checks, for each publishable package, whether that package's sources changed since its
  last release tag
- **AND** for each package that changed, it decides the version increment, updates that package's
  CHANGELOG, and bumps the version

#### Scenario: Additive change is not published as a patch

- **WHEN** a change adds a new public export or alters behavior observable by a registry consumer,
  under a commit whose prefix is `fix:`
- **THEN** the release flow selects a minor increment, on the evidence in the change's artifacts
  rather than the commit prefix

#### Scenario: No package changes since the last release

- **WHEN** neither package's sources changed since its last release tag
- **THEN** the release flow bumps neither package and the publish workflow has nothing to do
