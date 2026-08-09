## Context

See proposal.md — Why. What shapes the approach here is where schema data actually lives and what
the `openspec` CLI will and won't hand over.

Verified against `openspec` 1.8.0 on this machine:

- `openspec schemas --json` lists every schema available to the repo — package **and** project-local
  — each with `name`, `description`, `artifacts` (ids only), `source`. It already resolves
  shadowing: a project-local `spec-driven` and the package `spec-driven` come back as **one** entry
  with `source: "project"`.
- `openspec schema which <name> --json` gives `path` and a `shadows` list. The experimental-command
  notice goes to **stderr**, so stdout stays parseable JSON.
- Nothing in the CLI exposes an artifact's `description`, `generates`, `requires`, or `instruction`
  for a schema in the abstract. `openspec instructions <artifact>` gives them, but only for a
  **change** — it needs `--change <name>`. The instruction text is the substance of this feature, so
  the definitions have to be read from `schema.yaml` directly.
- `openspec templates --schema <name> --json` gives template file paths per artifact. Available, not
  needed for this change.

Constraints already established in the repo that this design has to sit inside:

- **Scanning never calls the CLI.** The one existing CLI caller (`schema-order.ts`) is reached only
  on change-detail read, is cached per `(repo, schema)` with a TTL ≥ its own timeout, and resolves
  to `null` on any failure. That is the template to follow, including its recorded mistake:
  caching `null` permanently meant installing the CLI later never took effect.
- **IntelliJ re-implements core in Kotlin** rather than sharing it, and every construct that "reads
  the same" in two languages has historically been where the two drifted.
- **"Express only reads `.md` / `.yaml` files under `openspec/`; no arbitrary file access."** The
  operative half is the second clause — the API must never become a client-steerable file-read
  primitive. The first clause described the mechanism at a time when everything spek read lived in
  the repo. Package schemas do not: they live in the global npm install directory, so containment
  under `<repo>/openspec/` cannot be the guard for reading one — see Decisions.

## Goals / Non-Goals

**Goals:**

- One core module that enumerates schemas and reads one schema's full definition, usable unchanged
  by the web server and the VS Code extension host, and mirrored in Kotlin for IntelliJ.
- A read path that never runs while scanning, and degrades to something useful — not an error and
  not a blank page — when the `openspec` CLI is missing.
- A schema detail view that reads as a workflow: ordered steps, dependencies, and the schema's own
  instruction text rendered the way the rest of spek renders Markdown.
- Change-usage counts that agree with what the Changes page shows for the same repo.

**Non-Goals:**

- Per-change progress through a schema's steps. Deferred by the proposal.
- Editing, forking, validating, or creating schemas. spek stays read-only.
- Rendering artifact **templates** (as opposed to instructions). Reachable via
  `openspec templates`, deliberately left for later.
- Promoting the schema-flow visual into `@spekjs/ui` in this change — see Decisions.
- Resolving schemas per worktree. Schema resolution is against the selected repo only.

## Decisions

### Split the read: CLI for *which schemas and where*, disk for *what they contain*

Enumeration and path resolution go through the CLI; content comes from reading `schema.yaml` at the
resolved path.

- **List view — one spawn.** `openspec schemas --json` gives everything the list needs (name,
  description, source, artifact count). No per-schema spawn.
- **Detail view — at most one more spawn.** `openspec schema which <name> --json` locates the
  schema and is also the only source of the `shadows` list — a project-local schema taking
  precedence over a same-named package one is recorded nowhere on disk. When the CLI is unusable,
  `<repo>/openspec/schemas/<name>/schema.yaml` still resolves a project-local schema from disk,
  with shadowing unknown; only a package schema is genuinely unreachable then, and that reports the
  CLI reason rather than "not found".

  *(Revised during implementation. The original plan short-circuited project-local schemas to disk
  with no spawn at all, which cannot report what they shadow. The spawn budget is unchanged.)*

*Alternatives considered.* Disk-only: cannot see package schemas at all — they live under the global
npm prefix, which the repo has no way to locate. CLI-only: no command returns instruction text for a
schema without a change to hang it on.

### Add a real YAML parser to `@spekjs/core`, rather than hand-rolling one

`@spekjs/core` currently reads `openspec/config.yaml` by pulling one `schema:` line out with a
regex. A `schema.yaml` is a nested artifact list whose `instruction` fields are multi-line block
scalars, and the whole value of this feature is reproducing those instructions faithfully. Add the
`yaml` package as a runtime dependency of core (it is pure JS with no dependencies of its own), and
`org.yaml:snakeyaml` as an explicit `implementation` dependency on the IntelliJ side.

*Alternatives considered.* A purpose-built minimal parser: rejected. This repo already carries the
scar — the task parser is one rule written in two languages, and the recurring failure was each
runtime quietly deciding a boundary differently. Block scalars, indentation, and quoting are exactly
that class of problem, and unlike the task parser there is no reason to own the rule here. Relying
on the IntelliJ platform to have SnakeYAML on the classpath: rejected on the JCEF precedent — a
platform class that was present became invisible across IDE versions and took the plugin down. An
explicit dependency keeps the plugin self-sufficient.

The cost is real and worth stating: core's runtime dependencies go from one (`cross-spawn`) to two,
and every registry consumer inherits that.

### Validate the schema name before it reaches the filesystem or a process

A schema name arrives from the client and is used both as a CLI argument and as a path segment under
`<repo>/openspec/schemas/`. It is validated against an explicit allowlist first —
`^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$`, with a single character also permitted — which
excludes separators, `.`/`..`, null bytes, and leading dashes by construction. Failing that check
is a 404, before any spawn or `stat`.

Following the parser lesson recorded in CLAUDE.md, the rule is **stated on both sides rather than
inherited**: the Kotlin pattern anchors with `\A`/`\z`, not `^`/`$`, because Java's `$` also matches
before a trailing line terminator and its terminator set is wider than JavaScript's. Both sides get
the same unit-test table, including a trailing-newline case that would pass a `$`-anchored Kotlin
pattern and fail the JS one.

### For a package schema, name validation is the guard — not path containment

The security property to preserve is "no arbitrary file access": the API must not become a
client-steerable file-read primitive. Everywhere else in spek that property is enforced by
containment — a path is built from the validated `dir` plus fixed subpaths under `openspec/`, so a
client cannot steer a read outward. A package schema breaks the containment mechanism, not the
property: its `schema.yaml` lives under the global npm prefix, which is nowhere near `<repo>/`.

So for that one read the guard is different, and it is worth being explicit about because the
absence of a containment check is otherwise indistinguishable from an oversight:

- the client supplies a **name**, never a path, and that name must pass the allowlist above;
- the path is produced by `openspec schema which`, i.e. by the CLI's own resolution, not by string
  concatenation with client input;
- exactly one file — `schema.yaml` at that path — is opened. No directory walk, no glob, no
  following a path out of the response into further reads.

This is not a widening of trust. spek already **executes** the global `openspec` binary in
`schema-order.ts`; reading a data file that same installation points at is strictly less than
running its code. A future reader should not add a `<repo>/openspec/` containment assertion here
expecting it to hold, nor assume one is already in force.

### Join change usage in the route, not in core

`listSchemas` / `readSchema` in core know nothing about changes. Each host's schemas route scans
changes the way it already does and joins on `ChangeInfo.schema`, which is already populated.

The route accepts `aggregate` (default true) and `jj` (default false) exactly like `/changes`, so
the counts on the Schemas page match the Changes page rather than quietly disagreeing in a
multi-worktree repo. Schema **resolution** stays deliberately un-aggregated — schemas are resolved
against the selected repo's own `openspec/config.yaml` and `openspec/schemas/`. That asymmetry is
intentional: a schema is a property of the repo you pointed spek at; a change is not.

*Alternative considered.* Doing the join inside core, so every host gets it free — rejected because
it would make "read the schemas" imply "scan every change", which is the coupling the hot-path rule
exists to prevent. Letting the frontend join client-side against a second fetch was also rejected:
one page should not need two round trips to render one number.

### Degradation is a code, not a sentence

When the CLI can't be used, the response carries a machine-readable reason — `cli-unavailable`,
`cli-failed`, `cli-timeout`, `cli-unparsable` — and each surface writes its own copy. This follows
the existing schema-order fallback, which distinguishes "the CLI isn't installed" (installing it
fixes this) from "this change is archived" (it doesn't), and it keeps host-specific wording out of
core.

### Cache exactly like `schema-order.ts`, including its correction

Two caches, both storing Promises so concurrent requests dedupe onto one spawn: enumeration keyed by
`repoRoot`, definitions keyed by `${repoRoot}::${name}`. TTL 30s — deliberately ≥ the 10s CLI
timeout, so an in-flight spawn can never be judged stale and re-spawned — with a 256-entry cap
evicting oldest-first.

The TTL is the point, not an optimization. Its absence is the bug `schema-order.ts` already shipped:
a permanently cached `null` meant a user who installed the `openspec` CLI after first load never got
schema data until they restarted the server. Editing a project-local `schema.yaml` has the same
shape — it must show up without a restart.

### One checked-in fixture schema, read by both languages' tests

The TS and Kotlin readers are the same rule written twice, which is where this repo's two worst
divergences came from. Rather than mirror assertions by hand, a fixture `schema.yaml` lives under
`test-fixtures/schemas/` and both test suites parse **that same file** and assert the same parsed
shape. It is a much lighter version of what `test-fixtures/task-parser/` does, and it is what makes
a Kotlin/TS drift fail a test instead of shipping.

### Keep the schema-flow visual in `packages/web`, not `@spekjs/ui`

`@spekjs/ui` is published, has its own version line and CHANGELOG, and is for components with
external consumers. A schema flow has exactly one consumer today. Building it as
`packages/web/src/components/SchemaFlow.tsx` — plain props in, navigation callbacks out, so the
shape stays promotable — costs nothing now and avoids committing a public API to a shape that hasn't
been used yet. Promote it if a second consumer appears.

### Render instructions through the existing Markdown renderer, collapsed by default

Instruction text is long — `spec-driven`'s `specs` instruction alone runs past a screen. The flow is
the primary content and the instructions are the depth behind each step, so each step renders its
description and dependencies always, with the instruction behind a per-step disclosure that uses
`MarkdownRenderer`. This reuses the BDD highlighting and typography the rest of spek already has,
rather than introducing a second way to render Markdown.

## Risks / Trade-offs

**CLAUDE.md's security line describes a mechanism that no longer covers every read.** "Only
`.md`/`.yaml` under `openspec/`" stops being a complete description once a package schema's
`schema.yaml` is read from the npm prefix, even though the property it exists to protect — no
arbitrary file access — is unchanged. → A documentation-accuracy fix, not a posture change: restate
the line so the property leads and the containment mechanism is described as how it is achieved for
repo-local reads, with the CLI-resolved schema read named as the exception and its own guard. Left
unfixed, the next reader has to guess which half was load-bearing.

**A new runtime dependency on a published package.** Every `@spekjs/core` consumer now pulls `yaml`.
→ Chosen with eyes open above; `yaml` is dependency-free and pure JS. If this ever needs undoing,
the parse is confined to one module behind a single function.

**Schema commands are marked experimental by the CLI itself and may change shape.** → Parse
defensively: an unexpected shape is treated as `cli-unparsable` and degrades rather than throwing,
and the tests drive a stubbed CLI rather than the real binary, so a CLI upgrade can't turn CI red
without also being a real behavior change.

**Kotlin and TypeScript drifting.** The repeated failure mode in this repo. → The shared fixture
above, the explicitly-stated anchoring rule for name validation, and keeping the Kotlin surface
deliberately small (enumerate, read, validate, cache — no UI logic).

**The Schemas page now performs a change scan for its usage counts.** Cheap relative to the CLI
spawn it already does, and identical to what the Changes page costs, but it is a real cost on a page
that would otherwise be nearly free. → Accepted; the scan is the same cached path the Changes page
uses, and it is what makes the two pages agree.

**Four surfaces means four places to forget.** → Surface parity is a spec requirement with a
scenario each, and the demo's data is captured at build time so a missing capture breaks the demo
build rather than shipping an empty page.

## Open Questions

- Whether to also surface each artifact's **template** (via `openspec templates --schema`) alongside
  its instruction. Purely additive — a later change can add it without touching these specs, the
  data model, or the task breakdown.
