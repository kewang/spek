## Why

A schema is the thing that decides what a change *is* in OpenSpec — which artifacts exist, what
order they come in, what each one is supposed to contain, and when a change is ready to implement.
spek already renders the *output* of that process (changes, artifacts, tabs, specs) but never the
process itself. The schema is only ever visible as a small badge on a change whose schema differs
from the repo default, and even that badge is just a name with nothing behind it.

That leaves two gaps. Someone new to the repo's workflow has no way to answer "what steps am I
supposed to go through, and what goes in each one?" without leaving spek and reading
`schema.yaml` out of a global npm install directory. And someone deciding whether to fork or author
a custom schema has no way to see what schemas are even available here, or which of them the repo
is actually using.

Both answers already exist on disk and in the `openspec` CLI. spek just doesn't show them.

## What Changes

- **New Schemas page** (`/schemas`, plus a `Schemas` entry in the shared sidebar navigation) listing
  every workflow schema available to the selected repo — built-in schemas shipped with the
  `openspec` package, and project-local schemas under `openspec/schemas/`. Each entry shows the
  schema name, its description, its source (package / project), and how many artifacts it defines.
- **New schema detail view** (`/schemas/:name`) rendering one schema as a readable workflow: its
  artifacts in authoritative order as a visual flow, each artifact showing what file it generates,
  its description, what it requires before it can be written, and its full instruction text rendered
  as Markdown in spek's existing styling. The apply step (`apply.requires` / `apply.tracks` and its
  instruction) is rendered as the terminal step of that flow, because "when is this change ready to
  implement" is part of the workflow a reader is trying to understand.
- **The repo's active schema is marked.** The schema named by `openspec/config.yaml`'s `schema:`
  field is flagged as the repo default on both the list and the detail view.
- **Per-schema change usage.** Each schema shows the count of active changes declaring it, with a
  link through to those changes. This reuses the `schema` field already carried on `ChangeInfo` — no
  new per-change work. Explicitly *not* included: how far an individual change has progressed
  through its schema's steps.
- **New core module** (`@spekjs/core`) that enumerates and reads schemas, plus a **new API endpoint**
  and adapter method so every surface can reach it.
- **Available on all four surfaces** — web, VS Code webview, IntelliJ tool window, and the static
  demo — per the repo's surface-parity convention. IntelliJ gets a Kotlin-side implementation
  aligned with the TypeScript rules, as it already has for scanning and schema order.
- **Degrades, never breaks.** The `openspec` CLI is required to enumerate *package* schemas; when it
  is absent, the page still lists project-local schemas read straight from disk and states plainly
  why the built-in ones are missing, in the same spirit as the existing schema-order fallback. A
  repo with no schemas at all gets an empty state, not an error.
- Schema reads stay **off the scan hot path**: they happen only when the Schemas page is opened, and
  are cached per repo. Change lists, overview, and aggregation are unaffected.

## Capabilities

### New Capabilities

- `schema-browsing`: Enumerating the workflow schemas available to a repo, reading each schema's
  definition (metadata, ordered artifacts, instructions, apply step), marking the repo's active
  schema, attributing active changes to their schema, and rendering all of it as a browsable
  workflow view on every delivery surface — including the degraded behavior when the `openspec`
  CLI is unavailable.

### Modified Capabilities

- `openspec-api`: adds the schemas endpoint (`GET /api/openspec/schemas`) and the corresponding
  `ApiAdapter` method, following the precedent set by the worktrees endpoint.
- `shared-layout`: the sidebar navigation requirement enumerates its links, so `Schemas` must be
  added to that enumeration and to its icon list.
- `spa-routing`: the client-side routing requirement enumerates the route table, so `/schemas` and
  `/schemas/:name` must be added to it.
- `intellij-embedded-server`: adds the Kotlin schemas endpoint to the embedded server's enumerated
  route set.

## Impact

**Code**

- `packages/core/` — new schema enumeration/reading module and its types; exported from the package
  index. Reads project-local `openspec/schemas/*/schema.yaml` from disk and consults the `openspec`
  CLI (`schemas --json`, `schema which --json`) for package schemas, cached per repo with a short
  TTL like `schema-order.ts`. Adds a YAML-parsing need to a package whose only current runtime
  dependency is `cross-spawn` — see design.
- `packages/web/server/routes/openspec.ts` — new `GET /api/openspec/schemas` route.
- `packages/web/src/` — new `SchemaList` / `SchemaDetail` pages, a schema-flow component, routes,
  sidebar entry, and adapter plumbing across `FetchAdapter` / `MessageAdapter` / `StaticAdapter`.
- `packages/vscode/src/handler.ts` — new message method calling core directly.
- `packages/intellij/` — Kotlin schema reader under `core/` with tests, plus a route in
  `SpekHttpRequestHandler.kt`.
- `scripts/build-demo.ts` — bake schema data into the demo payload.

**Dependencies**

- A YAML parser becomes reachable from `@spekjs/core`'s runtime path. Today core parses
  `openspec/config.yaml`'s single `schema:` line without one; a full `schema.yaml` (nested artifact
  list, multi-line instruction blocks) cannot be handled that way. This is a published-package
  dependency decision — design records the choice and its alternative.

**Registry consumers of `@spekjs/core`**

- Additive only: new exported functions and types, no change to existing signatures. This is a minor
  bump, not a patch — whoever cuts the release should treat it as such.
- What landed, for whoever writes the release note:
  - New runtime dependency **`yaml`** (core previously depended only on `cross-spawn`).
  - New exports from the package index: `listSchemas`, `readSchema`, `groupSchemaUsage`,
    `parseSchemaYaml`, `isSafeSchemaName`, `shortenSchemaPath`, `clearSchemaCache`, the schema
    types, and the CLI test seam (`setOpenspecRunner`, `OpenspecRunner`, `CliResult`).
  - A **new subpath export `@spekjs/core/schema-flow`** — `computeArtifactLevels`, `applyStepLevel`,
    `schemaStageCount`, `drawableRequires`. Separate from the index because the browser bundle
    imports it and the index reaches for `child_process`. A subpath is part of the package's public
    surface, so removing or renaming it later is a breaking change.
  - `openspec-cli.ts` is internal (the shared CLI runner and `ttlCached`), reached only through the
    re-exports above.

**Not affected**

- Scanning, change lists, overview, aggregation, and the existing per-change schema badge and
  schema-order behavior are untouched.
