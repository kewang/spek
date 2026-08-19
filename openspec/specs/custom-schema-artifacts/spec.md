## Purpose

以檔案系統為準探索 change 的 artifacts，讓任何 OpenSpec schema（含自訂 schema）的 artifact 都能各自呈現為分頁；分頁預設依最後修改時間排序，並提供使用者可選的排序（最後修改 / schema 權威順序 / A–Z）。
## Requirements
### Requirement: Filesystem-driven artifact discovery
The system SHALL determine a change's artifacts from the files present in its directory, independent of which OpenSpec schema the change declares. Every regular `*.md` file directly inside the change directory SHALL be discovered as a markdown artifact, and a `specs/` subdirectory containing one or more `*.md` delta files SHALL be discovered as a single specs artifact. Files beginning with `.` (such as `.openspec.yaml`) and non-`.md` files SHALL be ignored. Discovery SHALL be the source of truth: an artifact that is present on disk SHALL always be surfaced even when no schema is available, and a schema entry referencing an absent file SHALL never cause a missing file to be reported as present.

#### Scenario: Discover spec-driven change
- **WHEN** a change directory contains `proposal.md`, `design.md`, `tasks.md`, and `specs/<topic>/spec.md`
- **THEN** discovery returns artifacts for `proposal`, `design`, `tasks`, and a single `specs` artifact

#### Scenario: Discover unknown-schema change with extra artifacts
- **WHEN** a change directory contains `brainstorm.md`, `proposal.md`, `plan.md`, `verify.md`, and `retrospective.md`
- **THEN** discovery returns a markdown artifact for each of those files, even though they are not part of the `spec-driven` schema

#### Scenario: Ignore dotfiles and non-markdown files
- **WHEN** a change directory contains `.openspec.yaml` and a stray `notes.txt` alongside `proposal.md`
- **THEN** only `proposal.md` is discovered as an artifact and `.openspec.yaml` / `notes.txt` are ignored

#### Scenario: Empty specs directory
- **WHEN** a change directory contains a `specs/` directory with no `*.md` files
- **THEN** no specs artifact is reported

### Requirement: Artifact kind classification
Each discovered artifact SHALL be assigned a `kind` that governs how it is parsed and rendered. A `tasks.md` file SHALL be classified as kind `tasks` and parsed into structured task data (sections + checkboxes) as today. The `specs/` delta tree SHALL be classified as kind `specs` and carry the list of `{ topic, content }` delta files. All other `*.md` files SHALL be classified as kind `markdown` and carry raw Markdown content.

#### Scenario: tasks.md classified as tasks kind
- **WHEN** a change contains `tasks.md`
- **THEN** its artifact has `kind: "tasks"` and exposes parsed `{ total, completed, sections }` task data

#### Scenario: specs tree classified as specs kind
- **WHEN** a change contains `specs/<topic>/spec.md` delta files
- **THEN** a single artifact with `kind: "specs"` exposes the list of `{ topic, content }` entries

#### Scenario: Other markdown classified as markdown kind
- **WHEN** a change contains `brainstorm.md`
- **THEN** its artifact has `kind: "markdown"` and exposes the raw file content

### Requirement: Recency-based artifact ordering
The system SHALL order a change's discovered artifacts by filesystem modification time, most recently modified first, independent of which OpenSpec schema the change declares. Each root `*.md` artifact SHALL take its own file modification time; the `specs` artifact SHALL take the most recent modification time among its discovered `specs/**/spec.md` delta files. When two or more artifacts share the same modification time, the system SHALL break the tie with a stable default order — `proposal`, `design`, `specs`, `tasks` first, then the remainder alphabetically. Computing this default recency order of `ChangeDetail.artifacts` — and all directory scanning (change lists, overview, aggregation) — SHALL NOT invoke the OpenSpec CLI, spawn any subprocess, or parse any schema definition. (A user MAY opt into a schema-order view that consults the OpenSpec authority for its ordering, per "User-selectable artifact tab ordering"; that view never changes this default recency order.) Artifact display titles SHALL always be humanized from filenames.

#### Scenario: Most recently modified artifact leads
- **WHEN** a change contains `proposal.md`, `design.md`, and `tasks.md`, and `tasks.md` has the newest modification time
- **THEN** the discovered artifacts are ordered with `tasks` first

#### Scenario: specs tree ordered by its newest delta file
- **WHEN** a change contains `specs/<topic>/spec.md` delta files and one of them is the most recently modified file in the change
- **THEN** the `specs` artifact leads the ordered list

#### Scenario: Equal modification times fall back to the stable default order
- **WHEN** every artifact file in a change shares the same modification time (for example, immediately after a fresh `git clone` or `checkout`)
- **THEN** the artifacts are ordered `proposal`, `design`, `specs`, `tasks` first, then any remaining artifacts alphabetically

#### Scenario: Custom-schema artifacts ordered without a schema
- **WHEN** a change declares a custom schema and contains `brainstorm.md`, `proposal.md`, `plan.md`, and `tasks.md`
- **THEN** the artifacts are ordered by modification time (newest first) with the stable tiebreak, and no OpenSpec CLI call is made

#### Scenario: Humanized title
- **WHEN** an artifact is sourced from a file named `retrospective.md`
- **THEN** its display title is `Retrospective`

### Requirement: User-selectable artifact tab ordering
The change-detail view SHALL provide a control letting the user choose how change artifacts are ordered, with three modes: **last-modified** (the default, labeled "Last modified" — the mtime order per "Recency-based artifact ordering"), **schema order** (the schema's authoritative artifact sequence), and **alphabetical** (by artifact title). The selected mode SHALL be persisted so it applies to every change the user opens (global persistence), and SHALL default to last-modified when no preference is stored or when persistence is unavailable. Reordering SHALL affect only tab order, not which artifacts are present. This control SHALL be available on every surface that renders the change-detail view (web, VS Code, IntelliJ).

#### Scenario: Last-modified is the default
- **WHEN** a user opens a change detail with no stored ordering preference
- **THEN** the artifacts are ordered by last-modified time (newest first) and the control indicates the last-modified mode is active

#### Scenario: Alphabetical ordering
- **WHEN** the user selects alphabetical ordering
- **THEN** the artifact tabs are ordered by their display title, A–Z

#### Scenario: Preference persists across changes
- **WHEN** the user selects an ordering mode and then opens a different change
- **THEN** the newly opened change uses the same ordering mode

#### Scenario: Ordering never changes the set of artifacts
- **WHEN** the user switches between ordering modes
- **THEN** the same set of artifacts is shown in every mode, only their order differs

### Requirement: Schema order sourced from the OpenSpec authority
When ordering by schema order, the system SHALL order artifacts by the schema's authoritative sequence obtained from the OpenSpec authority — the `openspec` CLI's `actionContext.planningArtifacts` (order) mapped to discovered artifacts via `artifactPaths[id].outputPath` — so that the order is correct for any schema, including custom schemas, and not only `spec-driven`. This authoritative sequence SHALL be exposed to the view as `ChangeDetail.schemaOrder` (an ordered list of artifact ids, or null when unavailable). Computing it SHALL NOT change the default recency order of `ChangeDetail.artifacts`, and directory scanning (change lists / overview / aggregation) SHALL NOT invoke the CLI.

#### Scenario: Schema order follows a custom schema
- **WHEN** a change is authored under a custom schema whose `planningArtifacts` is `[brainstorm, proposal, plan, verify, retrospective]` and the `openspec` CLI is available
- **THEN** in schema-order mode the artifact tabs follow that sequence, not a spec-driven or alphabetical order

#### Scenario: Default order and scanning are unaffected
- **WHEN** `schemaOrder` is computed for a change detail
- **THEN** the `artifacts` array remains in recency order and no CLI call is made while scanning changes

### Requirement: Transparent fallback when schema order is unavailable
When schema-order mode is active but the authoritative order is unavailable — the `openspec` CLI is not installed, or the change is archived (no `planningArtifacts`) — the system SHALL fall back to the default `proposal, design, specs, tasks` then alphabetical order AND SHALL clearly indicate to the user that a fallback is in effect, with a reason-specific message. The indication SHALL distinguish the missing-CLI case (which installing the CLI would resolve) from the archived-change case (which it would not).

#### Scenario: CLI missing on an active change
- **WHEN** schema-order mode is active for an active change and the `openspec` CLI is not available (`schemaOrder` is null)
- **THEN** the tabs use the default spec-driven order and the view shows a message stating the OpenSpec CLI is not available

#### Scenario: Archived change
- **WHEN** schema-order mode is active for an archived change (`schemaOrder` is null)
- **THEN** the tabs use the default order and the view shows a message stating schema order is not tracked for archived changes

#### Scenario: No fallback indicator when schema order is available
- **WHEN** schema-order mode is active and `schemaOrder` is present
- **THEN** the tabs follow the schema order and no fallback message is shown

### Requirement: Surface the schema name per change
Because different changes in the same repo can declare different schemas, the system SHALL expose the schema name a change was authored under (from its `.openspec.yaml` `schema:` field, falling back to the repo's `openspec/config.yaml` `schema:`) on both `ChangeInfo` and `ChangeDetail`. The system SHALL also expose, per change, the **default** schema resolved against that change's own worktree (the `openspec/config.yaml` `schema:` value of the worktree the change was scanned from, read directly without invoking the OpenSpec CLI) as a `defaultSchema` field on `ChangeInfo` and on `ChangeDetail`; when a change's worktree has no determinable default, its `defaultSchema` SHALL be null. So that a single per-scan value stays available for repo-level headers, the system SHALL additionally expose the main worktree's default schema as `defaultSchema` on the changes response (`ChangesData`); when the main worktree has no determinable default, `ChangesData.defaultSchema` SHALL be null. Within a single scan the repo default SHALL be read at most once per worktree and reused for every change in that worktree rather than re-read per change.

The UI SHALL display a change's schema as a badge on every surface that represents a change — the Change Detail header, the Changes list rows, and the Dashboard change rows. To avoid noise in single-schema repos, the badge SHALL be hidden whenever the change's schema is null OR equals **that change's own** `defaultSchema` (from `ChangeInfo`/`ChangeDetail`); it SHALL be shown only when the change's schema is known and differs from its own default. This per-change hide rule SHALL be applied uniformly across all three surfaces, so that a change shows the same badge state in the list, on the Dashboard, and on its detail page regardless of which worktree it was aggregated from. So that the repo's baseline schema stays legible right where the divergent-schema badges appear, the Changes page SHALL display a `Default schema: <name>` indicator as a subheading beneath the page heading when `ChangesData.defaultSchema` is non-null, and SHALL omit it entirely when it is null. To keep the badge an unambiguous signal of divergence, the default-schema indicator SHALL be rendered as plain text rather than the pill/badge token used for divergent-schema change badges.

#### Scenario: Change detail shows a non-default schema
- **WHEN** a change's `.openspec.yaml` declares `schema: superpowers-bridge` and the repo default is `spec-driven`
- **THEN** `ChangeDetail.schema` equals `"superpowers-bridge"` and the change detail page displays that schema as a badge

#### Scenario: Different changes show different schemas
- **WHEN** one change declares `schema: spec-driven` and another declares `schema: superpowers-bridge`
- **THEN** each change reports its own schema name independently

#### Scenario: Schema falls back to repo config
- **WHEN** a change has no `schema:` in its `.openspec.yaml` but the repo `openspec/config.yaml` declares `schema: spec-driven`
- **THEN** the change's reported schema is `"spec-driven"` and its `defaultSchema` is `"spec-driven"`

#### Scenario: Badge appears in list views for a differing schema
- **WHEN** the Changes list or the Dashboard renders a change whose schema differs from its own `defaultSchema`
- **THEN** that change's row displays the schema badge alongside its other row metadata

#### Scenario: Badge hidden when schema equals the change's own default
- **WHEN** any surface (Change Detail, Changes list, or Dashboard) renders a change whose schema equals that change's own `defaultSchema`
- **THEN** no schema badge is shown for that change

#### Scenario: Non-default badge survives in a non-spec-driven repo
- **WHEN** a change's own `defaultSchema` is `agent-driven` and another change declares `schema: spec-driven`
- **THEN** the badge is hidden for the change whose schema is `agent-driven` and shown for the `spec-driven` change

#### Scenario: Aggregated change compares against its own worktree default
- **WHEN** worktree B's `openspec/config.yaml` declares `schema: agent-driven`, a change in worktree B declares no schema of its own (so its `schema` and `defaultSchema` both resolve to `"agent-driven"`), and the aggregated Changes list is rendered alongside the main worktree whose default is `spec-driven`
- **THEN** no schema badge is shown for that change, because its `schema` equals its own `defaultSchema` — even though it differs from the main worktree's `spec-driven` default

#### Scenario: List and detail agree for an aggregated change
- **WHEN** a change is rendered both in the aggregated Changes list and on its own detail page
- **THEN** the badge is shown in both places or hidden in both places, because both surfaces compare the change's `schema` against the same per-change `defaultSchema`

#### Scenario: Changes page shows the repo default schema
- **WHEN** the Changes page renders and `ChangesData.defaultSchema` is `"spec-driven"`
- **THEN** the Changes page displays a `Default schema: spec-driven` subheading with the schema name as plain text (not the pill badge)

#### Scenario: Changes page omits the label when no default is known
- **WHEN** the Changes page renders and `ChangesData.defaultSchema` is null
- **THEN** no default-schema subheading is shown

### Requirement: Generic ChangeDetail artifacts contract
`ChangeDetail` SHALL expose an ordered `artifacts` array, where each entry carries at minimum an `id`, `title`, `kind`, and the data appropriate to its kind (`content` for markdown, `tasks` for tasks, `specs` for the delta list). The API responses and every `ApiAdapter` implementation (`FetchAdapter`, `MessageAdapter`, `StaticAdapter`) SHALL carry this artifacts array so the frontend renders changes without referring to fixed artifact field names.

#### Scenario: ChangeDetail exposes ordered artifacts
- **WHEN** a change detail is requested
- **THEN** the response includes an ordered `artifacts` array with `id`, `title`, `kind`, and kind-appropriate data for each artifact

#### Scenario: Adapters preserve the artifacts array
- **WHEN** a change detail is delivered through any `ApiAdapter` (fetch, message, or static)
- **THEN** the consumer receives the same ordered `artifacts` array

### Requirement: Surface parity for custom-schema artifacts
The web app, the VS Code extension, and the IntelliJ plugin SHALL all render the full set of discovered artifacts for a change using the shared discovery and enrichment rules, and full-text search SHALL index every discovered markdown artifact rather than only `proposal.md`, `design.md`, and `tasks.md`.

#### Scenario: VS Code renders all artifacts
- **WHEN** a change with custom-schema artifacts is opened in the VS Code webview
- **THEN** all discovered artifacts are shown, matching what the web app shows for the same change

#### Scenario: IntelliJ renders all artifacts
- **WHEN** a change with custom-schema artifacts is opened in the IntelliJ tool window
- **THEN** all discovered artifacts are shown, matching what the web app shows for the same change

#### Scenario: Search indexes all markdown artifacts
- **WHEN** full-text search runs over a change that includes `brainstorm.md` and `plan.md`
- **THEN** content from `brainstorm.md` and `plan.md` is searchable, not only `proposal.md`/`design.md`/`tasks.md`

### Requirement: Schema-order authority is cached per schema

Because the authoritative artifact sequence returned by the OpenSpec authority (`actionContext.planningArtifacts` + `artifactPaths`) is a property of the change's **schema**, not of the individual change, the system SHALL cache that authoritative result keyed by schema within a repo, so that — for as long as the authority answers — opening multiple changes that share a schema consults the OpenSpec authority (spawning the `openspec` CLI) at most once per distinct schema within the cache window, rather than once per change. When spek cannot resolve a schema **name** for a change locally (neither the change nor the repo declares one), this does NOT mean no authoritative order exists — the OpenSpec authority resolves its own built-in default and still returns an order — so the system SHALL still consult the authority for such changes and SHALL cache them under a single repo-level default bucket (they all resolve to the same default, so one shared bucket is a correct share, not a collision). This caching SHALL NOT change the `schemaOrder` value delivered for any change: the per-change mapping onto that change's discovered artifact ids is applied after the cached authoritative result, so each change still reports the order correct for its own artifacts.

What the per-schema bucket holds is the authority's **answer**. No consultation that fails to produce
one SHALL be held there, whatever its cause: the bucket's key names a **schema** while the query names
a **change**, so an outcome that may be about the change is not the bucket's to keep, and holding it
would deny the order to every other change sharing that schema.

Not the bucket's to keep is not the same as not worth keeping, and the two SHALL be told apart by the
same rule that decides whether any CLI failure is worth remembering. A failure the running host may
repair by itself — the CLI absent, or cut short by its own timeout — SHALL be remembered **nowhere**,
so the next read consults the authority again and a repaired environment is served the order it can now
obtain. A failure the **installed** authority produced — exiting non-zero, or emitting output that
cannot be read — SHALL be remembered **against the change the query named**, for the same bounded
lifetime as an answer. It settles nothing about the schema and is not offered to any other change, but
it SHALL spare that change a fresh consultation for the rest of the window: an installation that cannot
answer at all otherwise costs a full process start on every read of every change detail, and on every
refetch a file watcher triggers.

A remembered settlement SHALL replace a **consultation**, never an answer. Where the per-schema bucket
holds a current answer, that answer SHALL be delivered to the change whatever is remembered about it:
the authoritative sequence is a property of the schema, as this requirement opens by stating, so a
change that was once refused is still owed its schema's order once the bucket holds one — and is owed it
without a further consultation. The settlement SHALL be applied only when no such answer exists, and
SHALL NOT install, join, or disturb an entry in the bucket. Replaying it consults nothing, so there is
no run for another reader to share; reached from inside the bucket's computation, a concurrent read of a
**different** change would join it and be served a settlement that was never about it. This is the rule
already stated for an outcome decided without consulting the authority at all, and a replayed settlement
is such an outcome.

A settlement SHALL be recorded by the consultation it came from, which is the only point holding both
the outcome's cause and the change the query actually named. A reader that joined a consultation about a
**different** change SHALL NOT record one for itself: joining is required behaviour, so a settlement
attributed by the joiner would be attributed to a change the authority was never asked about.

Where a host invalidates its cached authoritative results, it SHALL invalidate remembered settlements
with them. A settlement that survives an invalidation makes a manual refresh weaker than the automatic
one beside it, for the one change it is remembered against.

An authority that runs and reports no order for a change is an answer, not a failure, and SHALL be
cached like any other; the two are indistinguishable in the delivered `schemaOrder`, so the distinction
SHALL be made where the authority was consulted rather than inferred from the result.

Not caching an unsuccessful consultation in the bucket SHALL NOT cost a change its share of a spawn:
reads arriving while a consultation is in flight still join it, whether it is about to answer or fail.
An outcome decided **without** consulting the authority at all — a change whose slug the system itself
refuses to pass to it — SHALL be settled before the cache is reached, since there is no run to share and
its answer is not the bucket's either.

#### Scenario: Second change sharing a schema reuses the cached authority

- **WHEN** an active change is opened, its schema's authoritative order is fetched from the OpenSpec authority, and then a different active change declaring the **same** schema in the same repo is opened within the cache window
- **THEN** the second change's `schemaOrder` is served from the cached authoritative result without consulting the OpenSpec authority again

#### Scenario: schemaOrder is unchanged by per-schema caching

- **WHEN** two changes share a schema but have different sets of discovered artifacts, and both are ordered by schema order
- **THEN** each change's `schemaOrder` reflects only its own discovered artifact ids, identical to what per-change computation would have produced

#### Scenario: A change with no locally-resolvable schema still gets the default order

- **WHEN** an active change whose schema spek cannot resolve locally (no repo `config.yaml` and no change `.openspec.yaml` schema) is opened while the `openspec` CLI is available
- **THEN** the authority is still consulted and the change's `schemaOrder` is the authority's default-schema order (not null)

#### Scenario: Schema-less changes in a repo share one spawn

- **WHEN** two active changes in the same repo both have no locally-resolvable schema and are opened within the cache window
- **THEN** they share a single repo-level default cache bucket, so the authority is spawned only once for both

#### Scenario: A failed consultation is retried on the next read

- **WHEN** a change is opened while the `openspec` CLI cannot be reached, the CLI becomes reachable, and the same change is opened again within the cache window
- **THEN** the authority is consulted again and the change's `schemaOrder` is the authoritative order, rather than the unavailability being reported for the rest of the window

#### Scenario: A settlement by the installed authority is not repeated on every read

- **WHEN** the authority is consulted for a change and the installed CLI settles against it — exiting non-zero, or emitting output that cannot be read — and the same change is opened again within the cache window
- **THEN** the authority is not consulted again for that change and its `schemaOrder` is null, rather than a fresh consultation being spawned on every read

#### Scenario: One change's refusal does not deny the order to the rest of its schema

- **WHEN** the authority refuses one change — or the system declines to consult it for that change at all — and a different change sharing the same schema is opened within the cache window
- **THEN** the second change's authoritative order is obtained on its own terms, rather than being served the first change's refusal

#### Scenario: A remembered settlement is not shared with a concurrent read of another change

- **WHEN** a change whose settlement is remembered is read at the same moment as a different change sharing its schema, with no cached answer for that schema
- **THEN** the second change's consultation happens on its own terms, rather than joining and inheriting the first change's settlement

#### Scenario: A settled change is still served its schema's cached answer

- **WHEN** the authority settles against one change, another change sharing its schema is then consulted successfully, and the first change is opened again within the cache window
- **THEN** it is served the schema's cached authoritative order mapped onto its own artifacts, without a further consultation and without its settlement being replayed

#### Scenario: A settlement is not recorded by a reader that joined another change's consultation

- **WHEN** a read for one change joins an in-flight consultation the authority was given a different change's name for, and that consultation settles
- **THEN** no settlement is remembered for the joining change, so its next read consults the authority on its own terms

#### Scenario: Invalidating cached results invalidates remembered settlements

- **WHEN** a host that invalidates its cached authoritative results does so — through a resync, a watched-file event, or any other seam it invalidates on — and a change with a remembered settlement is read afterwards
- **THEN** the authority is consulted again for that change, rather than the settlement standing for the rest of the window

#### Scenario: An authority reporting no order is cached like an answer

- **WHEN** the authority is consulted successfully for a schema and reports no artifact order, and another change sharing that schema is opened within the cache window
- **THEN** the second change is served from the cached result without consulting the authority again

### Requirement: An unreadable authority response is a failure, not an absent order

Every host that reads the authoritative order SHALL distinguish an authority that **ran and reported no
order** from one whose output **could not be read**, and SHALL do so where the two still differ — at the
point the response is turned into an order, before the result reaches any cache.

The distinction is invisible afterwards: both deliver a null `schemaOrder`, so a reader that decides
from the delivered value alone cannot recover it, and the cheapest wrong answer is to treat an
unreadable response as the schema's answer and hold it for the full window. A host that reads the CLI's
raw output SHALL therefore separate parsing that output from extracting the order out of it, rather than
letting one step report both failures as the same absent value.

**Readable means the response parsed, not that it was shaped as expected.** A response that parses to
something the extractor can find no order in — a value that is not an object, an object without the
fields the order is read from — is a readable response reporting no order, and SHALL be classified as an
answer. Drawing the line anywhere later makes a host's own expectations part of the boundary, and two
hosts' expectations are exactly what this requirement exists to keep from diverging.

This applies to every host that consults the authority — the shared TypeScript core and the Kotlin
implementation alike — since each maintains its own reader and its own cache.

#### Scenario: Output that cannot be read is not cached as the schema's answer

- **WHEN** the authority exits successfully but emits output the host cannot parse, and a change sharing that schema is opened within the cache window
- **THEN** the response is treated as a failure of the installed authority rather than as "this schema has no order", so the schema's bucket holds no answer

#### Scenario: A readable response with no order is an answer

- **WHEN** the authority exits successfully and its output is readable but names no artifact order
- **THEN** that is cached as the schema's answer, and another change sharing the schema is served it without a further consultation

#### Scenario: A response that parses but names no order is an answer, not an unreadable one

- **WHEN** the authority exits successfully and its output parses to a value the extractor can find no artifact order in
- **THEN** it is classified as an answer reporting no order, rather than as an unreadable response

#### Scenario: Each host asserts the classification for the same documented responses

- **WHEN** each host's own suite is run
- **THEN** it asserts, for the same documented set of authority responses, the same classification into answer or failure as the other host's suite asserts for them

