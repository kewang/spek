## 1. Core: schema catalog module

- [x] 1.1 Add the `yaml` runtime dependency to `packages/core/package.json` and sync `package-lock.json`
- [x] 1.2 Add schema types to `packages/core/src/types.ts`: `SchemaSummary` (`name`, `description`, `source`, `artifactCount`, `isActive`), `SchemaArtifactDef` (`id`, `generates`, `description`, `requires`, `instruction`), `SchemaApplyDef` (`requires`, `tracks`, `instruction`), `SchemaDefinition` (metadata + `path` + `shadows` + ordered `artifacts` + `apply`), and `SchemaCatalog` (`activeSchema`, `schemas`, `degradedReason`)
- [x] 1.3 Add `isSafeSchemaName(name)` to `packages/core/src/schemas.ts` using the explicit allowlist from design.md, with a unit-test table covering separators, `.`/`..`, null byte, leading `-`, empty string, single character, and a trailing newline
- [x] 1.4 Implement `readActiveSchema(repoRoot)` — parse `schema:` from `openspec/config.yaml` on disk with no CLI call, reusing the scanner's existing behavior rather than adding a second rule
- [x] 1.5 Implement `listProjectSchemas(repoRoot)` — scan `openspec/schemas/*/schema.yaml` from disk, returning summaries with `source: "project"`
- [x] 1.6 Implement the CLI enumeration `openspec schemas --json` (argv array via `cross-spawn`, stdout only, 10s timeout, `windowsHide`), returning a discriminated result that distinguishes success from `cli-unavailable` / `cli-failed` / `cli-timeout` / `cli-unparsable`
- [x] 1.7 Implement `listSchemas(repoRoot)` — merge CLI enumeration with the project-local disk scan, dedupe by name (project wins), mark the active schema, sort active-first then A–Z, and carry `degradedReason` when the CLI enumeration failed
- [x] 1.8 Implement `resolveSchemaPath(repoRoot, name)` — resolve via `openspec schema which <name> --json`, falling back to `openspec/schemas/<name>` on disk when the CLI is unusable, returning the same degradation codes plus a distinct not-found result
  - **Deviation from design.md:** the plan had project-local schemas short-circuit to disk with *no* spawn. That cannot satisfy the spec's "Shadowing reported on the definition" requirement — `shadows` exists only in `schema which` output and is recorded nowhere on disk. So `schema which` is consulted first for every name, and the disk path became the *fallback* when the CLI is unusable. Same spawn budget as designed (at most one on the detail view); design.md updated to match.
- [x] 1.9 Implement `readSchema(repoRoot, name)` — validate the name, resolve the path, parse `schema.yaml` with `yaml`, map to `SchemaDefinition` preserving declared artifact order, with absent fields as `null` / `[]` and never a substituted default
- [x] 1.10 Add the enumeration and definition caches: Promise-valued, keyed `repoRoot` and `${repoRoot}::${name}`, 30s TTL, 256-entry cap evicting oldest-first — mirroring `schema-order.ts` including its TTL rationale in a comment
- [x] 1.11 Add `test-fixtures/schemas/sample-schema.yaml` covering block-scalar instructions, an artifact with no description, an artifact with multiple `requires`, and an apply block
- [x] 1.12 Write `packages/core/src/schemas.test.ts` parsing that fixture and asserting the full `SchemaDefinition` shape, plus enumeration tests against a stubbed CLI (success, unavailable, non-zero exit, timeout, unparsable output, project-shadows-package)
- [x] 1.13 Export the new functions and types from `packages/core/src/index.ts`
- [x] 1.14 Run `npm run build:core` and `npm test -w @spekjs/core`

## 2. Web server API

- [x] 2.1 Add `GET /api/openspec/schemas` to `packages/web/server/routes/openspec.ts` — require `dir`, accept `aggregate` (default true) and `jj` (default false), call `listSchemas`, join active-change usage on `ChangeInfo.schema`, and return the unresolved-schema grouping for changes whose schema matches nothing
  - **Refinement:** the route still owns the join (it does the scan and calls `listSchemas`), but the *pure grouping* was factored into `core.groupSchemaUsage(catalog, changes)` so the web route, the VS Code handler, and the Kotlin mirror don't carry three copies. It takes an already-scanned change list, so design.md's rationale — reading schemas must never imply scanning changes — still holds.
- [x] 2.2 Add `GET /api/openspec/schemas/:name` — require `dir`, 404 on a name failing validation or resolving to nothing, and distinguish `cli-unavailable` from not-found in the response body
- [x] 2.3 Assert a CLI failure returns HTTP 200 with `degradedReason`, never a 5xx
- [x] 2.4 Write route tests for both endpoints: success, missing `dir` → 400, unknown name → 404, traversal name → 404 with no filesystem access outside the schema directory, degraded enumeration → 200
  - **Deviation:** the repo had **no server tests at all** — `@spekjs/web`'s `test` script only globbed `src/**`. Added `server/**/*.test.ts` to that glob and mounted `openspecRouter` on a throwaway Express app (`server/index.ts` calls `listen()` at import time, so it can't be imported). Also exported `setOpenspecRunner` / `OpenspecRunner` / `CliResult` from `@spekjs/core` as a documented test seam, so these tests stub the CLI instead of requiring the real binary in CI.

## 3. Web frontend

- [x] 3.1 Add `getSchemas()` / `getSchema(name)` to the `ApiAdapter` interface and its types in `packages/web/src/api/types.ts`
- [x] 3.2 Implement both in `FetchAdapter`, threading `dir` and the aggregation params the other calls already thread
- [x] 3.3 Implement both in `MessageAdapter` as `postMessage` types `"getSchemas"` / `"getSchema"`
- [x] 3.4 Implement both in `StaticAdapter`, reading the embedded demo schema data
- [x] 3.5 Add `useSchemas()` / `useSchema(name)` hooks alongside the existing hooks in `useOpenSpec.ts`, returning `{ data, loading, error }`
- [x] 3.6 Build `packages/web/src/components/SchemaFlow.tsx` — ordered steps with connectors, each showing artifact id, `generates`, description, and `requires`; instruction behind a per-step disclosure rendered with `MarkdownRenderer`; apply rendered as the terminal step
- [x] 3.7 Build `packages/web/src/pages/SchemaList.tsx` — entries with name, description, source, artifact count, change-usage count; active schema marked and first; empty state; degraded-reason notice
  - Deviation: rows report a **stage** count, not an artifact count (see 3.13). The artifact count is exact but reads as a number of files, which it is not — the same reason the detail view had already stopped leading with it.
- [x] 3.8 Build `packages/web/src/pages/SchemaDetail.tsx` — header (name, description, source, active marker, shadowed-schema note), `SchemaFlow`, usage link to the changes using it, and a not-found state naming the schema
- [x] 3.9 Add the `/schemas` and `/schemas/:name` routes to `App.tsx`, `WebviewApp.tsx`, `DemoApp.tsx`, and `IntellijApp.tsx`
- [x] 3.10 Add the `Schemas` sidebar entry to `components/Sidebar.tsx`, including active-route highlighting
  - **Deviation:** the plan named lucide's `Workflow` icon, but `lucide-react` is **not** a dependency of `@spekjs/web` — every icon in this app is a hand-written inline SVG. Added a workflow glyph in that same style rather than taking on a dependency for icons. (`SchemaFlow` / `SchemaList` were written against lucide first and converted for the same reason.) Highlighting needs no extra work: `NavLink` with the default `end={false}` marks `/schemas` active on `/schemas/:name` too.
- [x] 3.11 Link `SchemaBadge` to `/schemas/:name`, keeping it non-interactive when the schema does not resolve
  - **Deviation:** the badge links **unconditionally**, and from every view that shows one — change detail, changes list, dashboard (see 3.14). The inert-when-unresolvable rule was dropped: the detail view answers an unresolvable name with "no schema named X was found for this repo", which is what a reader seeing an unfamiliar badge wants, and the gate cost every such view an extra schema enumeration purely to decide whether linking was safe.
  - **Superseded (was true until 3.14):** scoped during implementation so that the link is opt-in via a new `to` prop and only the **change-detail** badge passes it. On the Changes list and the Dashboard the badge sits inside a row-wide `<Link>`, where a nested `<a>` is invalid HTML — so those stay inert, as they already were. ChangeDetail calls `useSchemas()` purely to decide whether the name resolves; when it does not, `to` is null and the badge stays a plain span.
- [x] 3.12 Write component tests: flow step order, apply as terminal step, degraded notice, not-found state, usage label, and the badge's linking rules (links unconditionally, escapes the name, hides on the repo default, and stays above a stretched row overlay)
  - **Deviation:** `SchemaList` / `SchemaDetail` / `SchemaFlow` use hooks, so they cannot be called as plain functions the way this repo's DOM-free tests do (see `SchemaBadge.test.ts`). Their decision logic was extracted into pure functions in `utils/schemaView.ts` (`buildFlowSteps`, `degradedMessage`, `schemaUnavailableMessage`, `usageLabel`) and tested there — 13 new tests. **Active-schema-first ordering is not retested here**: it is decided server-side and already covered by `listSchemas: CLI enumeration, active schema first then A–Z` in core, plus the route test. Empty state is a one-line render with no logic to assert without a DOM.
- [x] 3.13 Report an artifact count on the schemas list — move the dependency levelling out of `schemaView.ts` into `packages/core/src/schema-flow.ts` (exported at the `@spekjs/core/schema-flow` subpath so the browser bundle does not pull in `child_process`), add `schemaArtifactCount` and `SchemaSummary.artifactCount`, filled from the CLI enumeration so every host reports the same number from one rule
  - **Deviation:** this landed first as a *stage* count meaning distinct dependency levels, and was corrected during review. Two problems with that: the stated rationale ("an artifact count reads as a number of files") argues for naming the unit carefully and says nothing about collapsing steps that share a level, and the levels are not in the CLI's enumeration — so filling the count cost a `schema which` per schema, i.e. 1+N subprocesses for a list. Counting declared artifacts needs no `requires`, so the list is one CLI call. `artifact` is also OpenSpec's own noun (`artifacts:`, `planningArtifacts`); neither "stage" nor "step" appears in its schema vocabulary.
- [x] 3.14 Make every schema badge clickable: rebuild the changes-list and dashboard rows as a stretched title link over a `relative` card so the badge (`relative z-10`) escapes the row's click overlay, since an anchor cannot nest inside an anchor; link the Changes page's "Default schema:" name the same way
- [x] 3.15 Extract `packages/web/src/utils/plural.ts` and route the five hand-written count pluralisations through it — a helper function rather than a `String.prototype` extension, because `@spekjs/core` and `@spekjs/ui` are published and a prototype patch would leak into every consumer's globals

- [x] 3.16 Drop the Workflow column's sticky positioning, so the diagram renders at its natural
  height and the page's own scrollbar is the only one
  - Found in the VS Code webview, not the browser: the column was `xl:sticky` with
    `xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto`. A sticky box is pinned by its `top`, so
    anything below the fold stays there — hence the cap, and hence a scrollbar of its own to make
    the capped part reachable. It fires at any viewport shorter than the diagram plus ~120px of
    chrome: ~602px for a 5-level schema, ~786px for `event-driven`'s 7. A 1440x900 window has ~780px
    after browser chrome, so this was an ordinary window, not an edge case.
  - **Scale-to-fit was tried first and abandoned** — worth recording, because it looks obviously
    right. The svg is `max-w-full h-auto`, so its height derives from its *used width*; shortening
    the window is not an input at all. Giving it a definite height to resolve against failed twice,
    measured in Chromium against `event-driven` (natural 172x712):
    - wrapper as a flex row — the svg becomes a flex item, width comes from flex-basis and height
      from the flex algorithm, so the aspect ratio never enters. Rendered 172x530 at a 700px
      viewport: full width, 74% height, visibly squashed.
    - wrapper as a plain block with `max-h-full` — the percentage has no definite parent height to
      resolve against, so it was ignored and nothing shrank at all.
    - What remained was a flex chain spanning `SchemaDetail` → `SchemaFlow` → `SchemaGraph`, or a
      hand-computed `calc(100vh - Nrem)` that drifts the moment the legend wraps to a second row.
      Disproportionate for a scrollbar, so the four classes were deleted instead.
  - Trade accepted: the diagram now scrolls out of view while reading a long instruction beside it
    (`superpowers-bridge`'s `retrospective` is ~6k characters). Reverting is re-adding four classes.
- [x] 3.17 Reconcile the schema-browsing spec with what the diagram rework actually shipped — four
  claims described the superseded card layout and had never been round-tripped from 3.6–3.8
  - Detail region: spec said "positioned immediately after the level containing the selected step";
    it is a separate column beside the diagram, stacked below when narrow. Rewrote the requirement,
    its rationale paragraph, and three scenarios; added the natural-height/no-second-scrollbar rule
    from 3.16.
  - Detail header: spec said the region shows description and instruction "without restating its id,
    its output path, or its requirements" — the exact inverse of what ships, and `SchemaFlow`'s own
    comment explains why it must carry them (it no longer sits beneath the step it describes).
  - Level labels: spec required a label once per group; `SchemaGraph` draws none, deliberately.
  - Step contents: spec said each step shows its description and requires; the node shows id +
    `generates` only, with requires in a tooltip and both in the detail region.

- **Post-implementation rework of 3.6–3.8 (recorded, not re-opened).** The card-based flow these
  tasks describe was replaced with an SVG dependency diagram after review. What exists now:
  - `components/SchemaGraph.tsx` + `utils/schemaLayout.ts` (new) — deterministic layered layout
    with barycentre placement, measured bypass routing, spread edge anchors. Pure geometry,
    unit-tested.
  - `utils/schemaView.ts` gained `withArchiveStep` — archive rendered as the terminal stage, marked
    as not schema-declared.
  - `SchemaFlow` reduced to the framed panel; selection state and the two-column layout moved to
    `SchemaDetail`, so provenance/usage sit beside the diagram without nesting under Workflow.
  - Selection (not hover) drives connection highlighting.
- **Shared components touched, outside this change's stated scope — needs a line in 7.4.**
  - `components/StatCard.tsx` extracted from `Dashboard` and used by both.
  - `MarkdownRenderer` now sets `overflow-wrap` on `.markdown-body`. Long bare paths in instruction
    text widened the page on a phone, and mobile Safari zooms out to fit an overflowing page — which
    read as the layout jumping on every selection. Latent on ChangeDetail too; verified fixed there.

## 4. VS Code

- [x] 4.1 Add `getSchemas` / `getSchema` cases to `packages/vscode/src/handler.ts`, calling the core module directly
- [x] 4.2 Verify the Schemas views build into the webview via `npm run build:webview -w @spekjs/web && npm run build -w spek-vscode`, then package the extension
  - **Partially verified — interactive step not done.** Both builds succeed and `vsce package` produces a valid 508 KB VSIX containing the rebuilt `webview/assets/index.webview.js`. **Opening the extension in a VS Code window and clicking through the Schemas views was not performed** — this session has no interactive VS Code. The message-channel path (`getSchemas` / `getSchema` → `MessageHandler` → core) is type-checked end to end but has not been exercised at runtime. Worth a manual pass before release.

## 5. IntelliJ

- [x] 5.1 Add the `org.yaml:snakeyaml` `implementation` dependency to `packages/intellij/build.gradle.kts`
- [x] 5.2 Add Kotlin schema models to `core/Models.kt` mirroring the TypeScript types
  - `SchemaSource` / `SchemaDegradedReason` are enums with `@SerialName` giving the TypeScript's
    lowercase spelling, rather than raw strings: the same web SPA deserialises whichever backend
    served it, so the wire form has to match exactly while Kotlin keeps an exhaustive `when`.
  - `artifactCount` is the only size a summary reports, and it comes from the enumeration's
    `artifacts` array (see 3.13) — no definition read.
- [x] 5.3 Implement `core/SchemaCatalog.kt` — name validation anchored with `\A`/`\z`, project-local disk scan, CLI enumeration and path resolution with the same degradation codes, `schema.yaml` parsing via SnakeYAML, and the same TTL/size-capped caches
  - **Deviation:** the pure levelling was split into a `core/SchemaFlow.kt` mirroring
    `schema-flow.ts`, then removed during review. Once the count stopped needing dependency levels,
    nothing in Kotlin called it — no Kotlin host draws the diagram, since the tool window loads the
    same React SPA. `schemaArtifactCount` lives in `SchemaCatalog.kt` instead.
  - Two deliberate divergences from the TypeScript, both pre-existing repo rules: the CLI is invoked
    through `ProcessBuilder` with the Windows `openspec.cmd`/argv-injection allowlist (Node's
    cross-spawn removes that risk structurally, so only this side needs the guard), and SnakeYAML is
    driven with `SafeConstructor` rather than the bare `Yaml()` default.
  - Carries today's fix too: a non-zero CLI exit that still returns a JSON `{error: …}` body is
    `not-found`, not `cli-failed` — see 3.16.
- [x] 5.4 Write `src/test/kotlin` tests parsing the **same** `test-fixtures/schemas/sample-schema.yaml` and asserting the same shape as the TypeScript test, plus the name-validation table including the trailing-newline case
  - 22 tests. The fixture path is passed by the build (`spek.schemaFixtures`) and registered as a
    task input, the same wiring the task-parser corpus uses, so editing the fixture re-runs the suite
    rather than leaving it up to date.
  - The fixture now also pins the **artifact count** (4) on both sides, so it controls the counting
    rule and not just the parse.
- [x] 5.5 Add `GET /api/spek/openspec/schemas` and `GET /api/spek/openspec/schemas/{name}` to `server/SpekHttpRequestHandler.kt`, matching the web response shape and its 404 / degraded-200 behavior
  - **Deviation (widened):** `routeRequest` now returns an `ApiResult` (`Json` / `NotFound`) rather
    than `String?`. A schema 404 has to carry a **body** — the shared frontend reads `reason` off it
    to tell "we could not look" from "it does not exist" — and the old contract could only produce a
    bodiless 404, which would have reported a missing openspec CLI as a missing schema. The ten
    existing routes are wrapped unchanged; three existing route tests were updated to the new type.
  - Resync now clears the schema-catalog cache as well as schema-order, in both the route and the
    file watcher. Only this project's `openspec/` is watched, so a machine-level schema edit produces
    no event and Refresh is the only way to pick it up — which requires this cache to be dropped too.
- [x] 5.6 Run `cd packages/intellij && ./gradlew test` — 175 tests, 0 failures (was 150 before this group)
- [x] 5.7 Verify the Schemas views render in the tool window via `npm run build:intellij` and `./gradlew runIde`
  - Verified in the real sandbox IDE: the tool window opens, JCEF renders the SPA, and the Schemas
    view lists all 12 schemas served by the **Kotlin** routes — `spec-driven` marked `default` /
    `package` with "4 stages · 1 active change", the user-level ones badged `user`. That exercises
    `SchemaCatalog` + `groupSchemaUsage` + `/api/spek/openspec/schemas`, which no browser harness can.
  - **Runnable headlessly now**, which it was not: a fresh sandbox stops on the JetBrains agreement
    dialog and then on Trust Project, and this machine has no display. Solved with Xvfb for the X
    server, `java.awt.Robot` for screenshots and clicks (no extra packages — the JDK has both), a
    seeded `trusted-paths.xml`, and `./gradlew runIde -Pspek.headlessIde`, which sets JetBrains' own
    `jb.consents.confirmation.enabled` / `jb.privacy.policy.text` switches. The flag is opt-in
    because it suppresses a consent prompt.
  - **Caught a stale bundle.** The first run showed the pre-edit subtitle ("the *steps* a change goes
    through"): `src/main/resources/webview/` is a build artifact and had not been rebuilt since that
    wording changed. Rebuilt with `npm run build:intellij` and re-verified. Exactly the staleness
    CLAUDE.md warns about for webview bundles — the IntelliJ copy has no rebuild-on-publish safety
    net during local verification.

## 6. Demo

- [x] 6.1 Capture `listSchemas` plus a `readSchema` for every enumerated schema in `scripts/build-demo.ts` and embed them in `window.__DEMO_DATA__`
  - Joined with change usage through `groupSchemaUsage`, exactly as the two server routes do, so the
    demo's payload is the same shape the adapters already consume. A schema whose definition cannot
    be read is omitted rather than embedded half-formed; the view's not-found state covers it.
- [x] 6.2 Run `npm run build:demo` and confirm both Schemas views render in `docs/demo.html` with no network or CLI access
  - Verified from `file://` with no server running: the list renders, the detail page draws its
    6-node diagram, and selecting a step opens its instructions. No console errors.
  - **The build reads the *builder's machine*, which nearly shipped.** `docs/demo.html` is committed
    and published as-is (Pages does checkout -> upload; CI only builds it as a discarded smoke test),
    so the first build embedded the twelve schemas installed under this machine's
    `~/.local/share/openspec/schemas` — plus `superpowers-bridge`, which is local-only via
    `.git/info/exclude` and not in the repo at all. Rebuilt with both moved aside, so the payload
    carries the one schema a fresh checkout sees (`spec-driven`, package). Anyone rebuilding the demo
    must do the same, or the public page advertises schemas nobody else has.
  - Caveat on "no network": the page still requests Google Fonts. Pre-existing and unrelated to
    schemas — the openspec data itself is fully embedded — but the page is not strictly offline.

## 7. Verification and documentation

- [x] 7.1 Run `npm run type-check`, `npm run lint`, and `npm test` from the repo root, and fix what they report — 0 type errors, 0 lint errors, 396 tests passing (249 core / 24 ui / 123 web). `./gradlew test` in packages/intellij is green too at 177
- [x] 7.2 Manually verify degradation end to end: rename the `openspec` binary off `PATH`, load `/schemas`, and confirm project-local schemas still list with the CLI-unavailable notice and no error
  - Done with the binary genuinely renamed, not a stubbed runner. `/schemas` returned **200** with
    `degradedReason: "cli-unavailable"` and still listed the project-local schema from disk. A
    *package* schema's detail returned 404 with `reason: "cli-unavailable"`; the *project* schema's
    returned 200 and read fine with no CLI at all — the "we could not look" vs "it does not exist"
    distinction, demonstrated against the real failure.
- [x] 7.3 Manually verify the shadowing path: fork `spec-driven` into `openspec/schemas/` and confirm one entry appears, sourced `project`, with the shadowed package path shown on its detail view
  - Forked the real package `schema.yaml` in and back out again. The list showed **one** entry named
    `spec-driven`, sourced `project`, and the detail view rendered "Takes precedence over the package
    schema of the same name at /home/norms/.local/opt/node/.../schemas/spec-driven".
  - Note the fork is what proves it: `shadows` comes only from `openspec schema which`, never from
    disk, so this is also the check that 1.8's deviation (always consulting the CLI first) bought
    what it was meant to.
- [x] 7.4 Update CLAUDE.md — restate the security line so "no arbitrary file access" leads and containment under `openspec/` is described as how that is achieved for repo-local reads, naming the CLI-resolved `schema.yaml` read and its name-validation guard as the exception; plus the new core module and its `yaml` dependency, the schemas endpoints, and the new routes and sidebar entry
  - Also recorded what the session learned the hard way, since none of it is derivable from the code:
    the stages-not-artifacts rule and the transitive reduction; `openspec-cli.ts` existing because both
    the CLI runner and the TTL cache had been written twice; the non-zero-exit-with-JSON case;
    `@spekjs/core/schema-flow` being a browser-safe subpath; `build:demo` embedding the *builder's*
    machine-local schemas into a file that ships as committed; and `runIde -Pspek.headlessIde` for
    verifying the tool window with no display. Plus the shared `StretchedLink` pattern.
- [x] 7.5 Record in `proposal.md`'s Impact (already noted) that `@spekjs/core` gains public exports and a new runtime dependency, so whoever cuts the release treats it as a minor bump rather than a patch
  - Extended with what actually landed: the `yaml` dependency, the named index exports, and — the one
    worth calling out — the **new subpath export `@spekjs/core/schema-flow`**. A subpath is public
    surface, so renaming it later breaks consumers; that was not in the original Impact.
