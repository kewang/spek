## Purpose

提供無框架依賴的共用邏輯套件 @spekjs/core（掃描、讀取、tasks 解析、型別），供 web server 與各 extension host 共用。
## Requirements
### Requirement: Standalone core package
The core module SHALL be an independent npm package (`@spekjs/core`) with no framework dependencies, usable by both the web server and the VS Code extension host.

#### Scenario: Import from web server
- **WHEN** the Express server imports `@spekjs/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

#### Scenario: Import from extension host
- **WHEN** the VS Code extension host imports `@spekjs/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

### Requirement: Scanner functions
The core module SHALL export scanner functions that accept a base path and return structured OpenSpec data. The `build-demo.ts` script SHALL separate the concept of "data source path" (where openspec/ lives) from "build tooling path" (where spek's packages/web lives), allowing the script to scan an external repository while using spek's own build tooling.

#### Scenario: Scan overview
- **WHEN** `scanOverview(basePath)` is called with a valid repo path
- **THEN** it returns `{ specsCount, changesCount: { active, archived }, taskStats: { total, completed } }`

#### Scenario: List specs
- **WHEN** `listSpecs(basePath)` is called
- **THEN** it returns an array of `{ topic, path }` for each spec directory

#### Scenario: Read single spec
- **WHEN** `readSpec(basePath, topic)` is called with an existing topic
- **THEN** it returns `{ topic, content, relatedChanges, history }`

#### Scenario: Build demo from external repo
- **WHEN** `build-demo.ts` is called with `--repo-dir` pointing to a different repository
- **THEN** all `@spekjs/core` functions receive the external repo path as `basePath`
- **AND** Vite build still runs from spek's own `packages/web` directory

#### Scenario: List changes
- **WHEN** `listChanges(basePath)` is called
- **THEN** it returns `{ active: ChangeInfo[], archived: ChangeInfo[] }`

#### Scenario: Read single change
- **WHEN** `readChange(basePath, slug)` is called with an existing change slug
- **THEN** it returns `{ slug, proposal, design, tasks, specs, metadata }`

#### Scenario: Search content
- **WHEN** `searchContent(basePath, query)` is called
- **THEN** it returns matching results across specs and changes with context snippets

### Requirement: Task parser functions
The core module SHALL export task parsing functions that operate on raw Markdown content strings.

#### Scenario: Parse tasks from content
- **WHEN** `parseTasks(content)` is called with Markdown containing `- [x]` and `- [ ]` checkboxes
- **THEN** it returns `{ total, completed, sections }` with tasks grouped by `##` headings

### Requirement: Shared type definitions
The core module SHALL export all TypeScript type definitions used by both the web app and the extension.

#### Scenario: Type imports
- **WHEN** the web app or extension imports types from `@spekjs/core`
- **THEN** types such as `OverviewData`, `SpecInfo`, `SpecDetail`, `ChangeInfo`, `ChangeDetail`, `ParsedTasks`, `SearchResult` are available

### Requirement: Heading extraction utility
The core module SHALL export `extractHeadings(content: string)` and `slugifyHeading(text: string)` utilities that parse markdown content and produce deterministic, ordered heading metadata for use by both the webview and the VS Code extension host. `extractHeadings` SHALL return only `h2` and `h3` headings, in document order, each with `{ level: 2 | 3, text: string, slug: string }`. Headings inside fenced code blocks SHALL be ignored.

#### Scenario: Extract h2 and h3
- **WHEN** `extractHeadings(content)` is called with content containing `## Section A`, `### Sub A1`, and `## Section B`
- **THEN** it returns `[{ level: 2, text: "Section A", slug: "section-a" }, { level: 3, text: "Sub A1", slug: "sub-a1" }, { level: 2, text: "Section B", slug: "section-b" }]`

#### Scenario: Ignore h1 and h4+
- **WHEN** `extractHeadings(content)` is called with content containing `# Title`, `## Section`, and `#### Detail`
- **THEN** the returned array contains only the `h2` `Section` entry

#### Scenario: Ignore headings inside code blocks
- **WHEN** the content contains a fenced code block whose body includes lines beginning with `## ` or `### `
- **THEN** those lines are NOT returned as headings

#### Scenario: Slug duplicates suffixed
- **WHEN** the content contains two headings with identical text
- **THEN** the first heading's slug is the base slug and the second heading's slug ends with `-2`

#### Scenario: Slugify lowercase and dash
- **WHEN** `slugifyHeading("Requirement: Spec list with filtering")` is called
- **THEN** it returns `"requirement-spec-list-with-filtering"`

#### Scenario: Slugify collapses non-alphanumeric runs
- **WHEN** `slugifyHeading("Hello,  World!! How?")` is called
- **THEN** it returns `"hello-world-how"`

#### Scenario: Slugify preserves Unicode word characters
- **WHEN** `slugifyHeading("章節 Foo")` is called
- **THEN** it returns `"章節-foo"` (Unicode letters preserved, spaces collapsed to dash)

#### Scenario: Empty content
- **WHEN** `extractHeadings("")` is called
- **THEN** it returns an empty array

### Requirement: Published to the public npm registry
The core package SHALL be published to the public npm registry under the name `@spekjs/core`, so that repositories outside this monorepo can install and import it. The published tarball SHALL contain the compiled `dist/` output together with its type declarations, and SHALL NOT contain source files.

#### Scenario: Install from a repository outside this monorepo
- **WHEN** a repository that is not a workspace member of this monorepo runs `npm install @spekjs/core`
- **THEN** the package resolves from the npm registry, and `import { scanOpenSpec } from '@spekjs/core'` succeeds without referencing any local path

#### Scenario: Published tarball contents
- **WHEN** the package tarball is inspected before publishing
- **THEN** it contains `dist/` with both `.js` and `.d.ts` files, plus `package.json`, `README.md`, `LICENSE` and `CHANGELOG.md`, and it does not contain `src/`

#### Scenario: Runtime dependencies limited to what core actually imports
- **WHEN** the published package's `dependencies` are inspected
- **THEN** they list only the packages that core actually imports, so that consumers are never forced to install dependencies core does not use

#### Scenario: Subpath exports resolve for external consumers
- **WHEN** an external consumer imports `@spekjs/core/headings`, `@spekjs/core/artifact-order`, `@spekjs/core/graph-node-id`, `@spekjs/core/schema-flow` or `@spekjs/core/cli-budget`
- **THEN** each subpath resolves to its compiled module and type declarations

#### Scenario: Node-free subpaths carry no Node dependency
- **WHEN** a consumer imports one of those subpaths from a browser bundle or from a process that must not load `node:fs`
- **THEN** the import succeeds, because each of those modules is pure logic with no runtime import of a Node built-in or of the package's server-side modules

### Requirement: The CLI's timing budget is stated once

The core module SHALL expose the `openspec` CLI's invocation timeout and the lifetime of its cached
answers from a single browser-safe module, on the `@spekjs/core/cli-budget` subpath.

Both numbers constrain callers on either side of a process boundary: the host that spawns the CLI,
and a client waiting on that host with a timeout of its own. The client is often a browser bundle
and so cannot import the module that spawns the CLI without acquiring a Node dependency. Stating the
budget separately is what lets such a client **derive** its own ceiling rather than restate the
number — two constants that merely happen to be equal look identical to two that are equal for a
reason, and only one of them stays correct when the CLI's timeout changes.

#### Scenario: A browser bundle reads the budget
- **WHEN** a browser bundle imports `@spekjs/core/cli-budget`
- **THEN** the import succeeds and pulls in no Node built-in and no CLI-spawning module

#### Scenario: Raising the CLI timeout moves every derived deadline
- **WHEN** the CLI invocation timeout is changed
- **THEN** every deadline derived from it changes with it, with no other value needing to be edited

### Requirement: Artifact sort utility

The core module SHALL export `sortArtifacts(artifacts, mode, schemaOrder?)`, the `ArtifactSortMode` type
it takes, and `ARTIFACT_SORT_MODES` — the runtime list of every valid mode — from the
`@spekjs/core/artifact-order` subpath, beside the `DEFAULT_ORDER` narrative order the function is built
on. Every surface that renders change detail offers the same three ordering modes (see
`custom-schema-artifacts`), so the rule deciding them SHALL live in one place rather than once per
surface.

`ArtifactSortMode` SHALL be **derived from** `ARTIFACT_SORT_MODES` rather than declared separately.
Consumers that persist a user's choice must validate what they read back, which needs the modes at
runtime; a hand-maintained second list satisfies the type even when it is missing an entry, so the
mode it omits becomes silently unrestorable.

The three modes SHALL behave as follows:

- **`modified`** — the input order, unchanged.
- **`alpha`** — by display title, compared with `String.prototype.localeCompare` under the host's
  default collation, with the artifact id as a tiebreak so that two artifacts humanizing to the same
  title still order deterministically. The comparison is **named rather than described as "A–Z"**
  because it is locale- and ICU-dependent: the same two titles may order differently on two hosts, and
  a consumer needing a host-independent order must impose one itself.
- **`schema`** — by the authoritative sequence in `schemaOrder`. Artifacts absent from that sequence
  SHALL follow the ones present, ordered among themselves by the narrative order. When `schemaOrder` is
  absent or empty, the whole list SHALL take the narrative order — **not** the input order, whose
  recency basis puts the artifact written last at the front.

The narrative order is `DEFAULT_ORDER` with ids outside it ordered after it, among themselves by id.

Sorting SHALL change only the order, never the set: the returned list SHALL contain exactly the
artifacts it was given.

The sort SHALL also preserve the caller's **element type**: it is generic in the element, and the list
it returns SHALL have the element type it was given. A consumer holding its own artifact DTO — a
superset of `ChangeArtifact`, such as one carrying the path it opens the artifact's file by — therefore
gets its own type back and needs no cast. The rule reorders the objects it is handed without rebuilding
them, so a signature that returns `ChangeArtifact[]` regardless of the input would drop, at the type
level only, fields the result still carries at runtime; the cast standing in for that is precisely what
the caller cannot check.

The element SHALL be constrained to the fields the rule reads — the artifact `id` and `title` — rather
than to `ChangeArtifact` as a whole. `id` carries the narrative rank, the `schemaOrder` lookup and both
tiebreaks; `title` carries `alpha`. Any element type providing those two SHALL be accepted, whatever
else it holds, and one missing either SHALL be rejected: constraining to more than is read excludes
consumers for no reason, and constraining to less cannot be implemented.

`alpha` and `schema` SHALL return a new array and SHALL NOT mutate the input. `modified` **MAY** return
the input array itself rather than a copy. Callers **SHALL NOT** mutate a returned list — under
`modified` it may alias the caller's own array, so sorting it in place would reorder the data the
caller passed in.

It SHALL be reachable without loading any Node-only module, so that a browser bundle or a host's main
process can import it — see the subpath scenarios under "Published to the public npm registry".

#### Scenario: Schema order applied

- **WHEN** `sortArtifacts` is called in `schema` mode with `schemaOrder` listing every artifact
- **THEN** the artifacts follow that sequence, whatever order they arrived in

#### Scenario: Schema order covering only some artifacts

- **WHEN** `sortArtifacts` is called in `schema` mode with a `schemaOrder` that names only some of the
  artifacts
- **THEN** the named ones lead in that sequence, and the rest follow in narrative order

#### Scenario: Schema order unavailable falls back to narrative order

- **WHEN** `sortArtifacts` is called in `schema` mode with no `schemaOrder`, and the artifacts arrive in
  recency order with `tasks` first and `proposal` last
- **THEN** the result is ordered `proposal`, `design`, `specs`, `tasks` — the delivered order is not
  preserved

#### Scenario: Artifacts outside the narrative order

- **WHEN** the artifacts include ids that are not part of `DEFAULT_ORDER`
- **THEN** those ids follow the ones that are, ordered alphabetically among themselves

#### Scenario: Last-modified mode preserves the input order

- **WHEN** `sortArtifacts` is called in `modified` mode
- **THEN** the artifacts come back in the order they were given, and the input array is unmodified

#### Scenario: Alphabetical mode orders by title

- **WHEN** `sortArtifacts` is called in `alpha` mode
- **THEN** the artifacts are ordered by display title under the host's collation

#### Scenario: Two artifacts sharing a display title

- **WHEN** two artifacts humanize to the same display title
- **THEN** they are ordered by artifact id, so that the result does not depend on the order they arrived in

#### Scenario: The mode list matches the type

- **WHEN** a consumer validates a persisted preference against `ARTIFACT_SORT_MODES`
- **THEN** the list contains every value `ArtifactSortMode` admits, because the type is derived from it

#### Scenario: The set of artifacts is never changed

- **WHEN** the same artifacts are sorted in each of the three modes
- **THEN** every result contains exactly the artifacts given, and the input array is unmodified except
  where it is returned as-is

#### Scenario: A consumer's own artifact type survives the sort

- **WHEN** a consumer sorts an array of its own artifact type — `ChangeArtifact` plus fields of its own —
  in any of the three modes
- **THEN** the result is typed as that same element type, so the consumer's own fields are reachable on
  it and assigning the result back to its own array type needs no cast

#### Scenario: An element type missing a field the rule reads is rejected

- **WHEN** a consumer passes elements that carry an `id` but no `title`
- **THEN** the call does not type-check, because `title` is one of the two fields the rule reads

### Requirement: Graph node id parsing

The core module SHALL export the function that resolves a graph change node back to its change slug,
beside the code that produces the id format. `buildGraphData` emits `change:<slug>` and
`buildGraphDataAggregated` emits `change:<worktreeKey>:<slug>`; the same package SHALL own reversing both.

The function SHALL derive the slug from the node's `source` — populated only on aggregated graphs — rather
than by splitting the id on its separator, because the id alone does not distinguish a worktree key from
the leading segment of a slug. Where a key is present, it SHALL be removed only when the remainder
actually begins with it, so that an id a caller has already normalised is left unchanged.

It SHALL be reachable without loading any Node-only module, so that a browser bundle or a host's main
process can import it — see the subpath scenarios under "Published to the public npm registry".

#### Scenario: Non-aggregated node

- **WHEN** the function is given a change node whose id is `change:<slug>` and which carries no `source`
- **THEN** it returns `<slug>`

#### Scenario: Aggregated node

- **WHEN** the function is given a change node whose id is `change:<worktreeKey>:<slug>` and whose
  `source` identifies that worktree
- **THEN** it returns `<slug>`, without the worktree key

#### Scenario: Already-normalised id

- **WHEN** the function is given a node whose id is `change:<slug>` but which still carries a `source`
- **THEN** it returns `<slug>` unchanged, rather than removing a prefix that is not there

### Requirement: Spec heading display label utility

The core module SHALL export `specHeadingLabel(text: string): string` from the same browser-safe entry
point as `extractHeadings` and `slugifyHeading`. Given a heading's authored text it SHALL return the
text a host displays for that heading: the leading OpenSpec format keyword (`Requirement:` or
`Scenario:`) removed, and in every other case the input returned unchanged.

The argument SHALL be a heading's text **in full**. Every caller has the whole heading available, and
the rule's decisions — whether a keyword is present, and whether anything remains after it — are only
correct when made over the whole of it. A caller holding the heading as a sequence of pieces SHALL
assemble the text before asking.

What is removed SHALL be exactly the keyword, its colon, and the run of spaces and tabs immediately
following it — nothing else. In particular the result SHALL NOT be trimmed at its end: a heading
continues into markup the label does not carry (`Requirement: The \`foo\` flag …` leaves a text run
ending in a space, and dropping that space closes up the gap before the code span).

Matching SHALL be exact — the keyword spelled and capitalised as OpenSpec's format writes it,
immediately followed by a colon, at the start of the text. A variant OpenSpec's own parser would not
accept SHALL NOT be elided: spek renders what a file contains, and quietly normalising a heading the
tooling rejects would present a malformed document as a well-formed one. For the same reason the text
SHALL be returned unchanged when what follows the colon is empty after trimming — a heading whose entire
content is the keyword has no other name to show.

The utility SHALL NOT be applied by `extractHeadings`, and no value SHALL be derived from its result.
`Heading.text` is what the file says, `Heading.slug` is derived from `Heading.text`, and the display
label is a third value that nothing else depends on. Deriving a slug from the label would change every
requirement anchor while the rendered content's ids continued to be built from the authored text.

The rule SHALL be stated in this one place. Four surfaces across two packages display heading text, and
a copy per surface is how the sidebar and the content come to disagree about what a heading is called.

#### Scenario: A requirement heading's keyword is elided

- **WHEN** `specHeadingLabel("Requirement: Single YAML manifest as source of truth")` is called
- **THEN** it returns `"Single YAML manifest as source of truth"`

#### Scenario: A scenario heading's keyword is elided

- **WHEN** `specHeadingLabel("Scenario: manifest declares both channels")` is called
- **THEN** it returns `"manifest declares both channels"`

#### Scenario: Text carrying no format keyword is returned unchanged

- **WHEN** `specHeadingLabel("ADDED Requirements")` is called
- **THEN** it returns `"ADDED Requirements"`

#### Scenario: A heading whose name begins with inline markup is elided

- **WHEN** `specHeadingLabel("Requirement: \`@spekjs/ui\` package exports reusable components")` is called
- **THEN** it returns `"\`@spekjs/ui\` package exports reusable components"`

#### Scenario: Trailing whitespace is preserved

- **WHEN** `specHeadingLabel("Requirement: The ")` is called
- **THEN** it returns `"The "`, the trailing space intact

#### Scenario: A keyword-only heading is returned unchanged

- **WHEN** `specHeadingLabel("Requirement:")` is called
- **THEN** it returns `"Requirement:"`

#### Scenario: A keyword followed only by whitespace is returned unchanged

- **WHEN** `specHeadingLabel("Requirement:   ")` is called
- **THEN** it returns `"Requirement:   "`

#### Scenario: A case variant is returned unchanged

- **WHEN** `specHeadingLabel("requirement: lowercase keyword")` is called
- **THEN** it returns `"requirement: lowercase keyword"`

#### Scenario: A keyword that is not at the start is returned unchanged

- **WHEN** `specHeadingLabel("Optional Requirement: something")` is called
- **THEN** it returns `"Optional Requirement: something"`

#### Scenario: Heading extraction is unaffected

- **WHEN** `extractHeadings(content)` is called on content containing `### Requirement: Foo`
- **THEN** the returned entry's `text` is `"Requirement: Foo"` and its `slug` is `"requirement-foo"`
