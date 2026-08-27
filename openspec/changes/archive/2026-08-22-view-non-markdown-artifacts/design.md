# Design — View non-markdown artifacts in a change

## Context

spek discovers a change's artifacts from disk. `discoverArtifacts` collects every root `*.md` file through
`listChangeMarkdownFiles`. It classifies `tasks.md` as `tasks` and the rest as `markdown`, both inside one
loop. It then adds a single `specs` artifact for a non-empty `specs/` delta tree. `countArtifacts` and the
server's full-text search index read the same `listChangeMarkdownFiles` predicate. This is deliberate: what
appears as a tab is also counted and searchable.

Three facts drive this change:

- An OpenSpec schema sets each artifact's filename, and its extension, through `generates:`. Not all artifacts
  are Markdown. The `event-driven` schema declares `generates: asyncapi.yaml` as a required artifact. No code
  discovers such a file, so no view renders it.
- The "one predicate" guard holds for Markdown only. Each new file class needs a second predicate, wired into
  every consumer by hand. spek has five such consumers: `discoverArtifacts`, `countArtifacts`, the web search
  route, the VS Code search handler, and the Kotlin `SearchService`. A second predicate that misses one
  consumer shows a tab that does not count or search.
- The renderer is `MarkdownRenderer` (react-markdown with remark-gfm). It has no syntax highlighting today. Its
  `code` handler emits a plain `<code class="language-… block">`.

## Goals / Non-Goals

**Goals**

- Show root-level `.yaml`, `.yml`, and `.json` artifacts that already exist in a change.
- Render them legibly, as a syntax-highlighted code block.
- Keep tabs, count, and search in agreement on every host, so nothing is shown but not searchable.
- Make a future artifact type cheap and safe to add.
- Keep parity across web, VS Code, and IntelliJ.

**Non-Goals**

- Structured viewers for API specs, such as an OpenAPI or AsyncAPI form or a JSON-Schema tree. v1 shows text.
  This is the future artifact type that D1 and D4 prepare for.
- Discovery of non-Markdown files in subdirectories. Also file types beyond the three extensions with real
  artifact examples. (`.txt` and `.toml` were checked and have none, so they are excluded.)
- A discriminated-union `ChangeArtifact`. It gives per-kind payload typing, but it breaks the published type.
  See D4.
- Editing. spek is read-only.

## Decisions

### D1 — Two layers: an artifact-files listing and an artifact-discovery builder

Split artifact discovery by what the callers need. Three callers want cheap metadata and must not read
content: the change-list scan (`countArtifacts`), the worktree election (`changeDirMtime`), and search
(`listChangeArtifactFiles`). One caller wants the full objects: the change-detail read (`discoverArtifacts`),
which reads every file. So the code splits along that line:

- `artifact-files.ts` — the filesystem view of a change directory. It lists which files are artifacts, their
  kinds, their names, and their mtimes. It reads directory entries and stats only, never content. It owns
  `countArtifacts`, `changeDirMtime`, `listChangeArtifactFiles`, and `listChangeMarkdownFiles`.
- `artifact-discovery.ts` — the builder. `discoverArtifacts` reads each file's content and builds a
  `ChangeArtifact`. It is the only place that reads artifact content.

Two small pieces carry the classification, in `artifact-files.ts`:

- `rootKind(name)` — the one classifier. It returns the kind of a root file (`tasks`, `markdown`, or `data`),
  or null if the file is not an artifact. count, search, and discover all go through it, so a new root kind
  cannot slip past one of them. This is the single source of truth that closes the original gap.
- `rootArtifacts(changePath)` — the root files with their kinds, in id-dedup precedence: markdown and tasks
  first, then data. It does one directory read and partitions the entries by kind.

`specs` is an explicit case, not a producer. It is a tree (`specs/<topic>/spec.md`), not a root file, so
`listSpecFiles` walks it and `discoverArtifacts` builds the one `specs` artifact directly.

`discoverArtifacts` assigns ids with the existing `uniqueId` and sorts by mtime. The id-dedup order is
`specs, tasks, markdown, data`: `specs` reserves `specs` first, so a root `specs.md` becomes `specs-2`, and
markdown precedes data, so `spec.md` keeps `spec` and `spec.json` becomes `spec-2`. That order affects id-dedup
only. The display order is the mtime sort. `buildArtifact` is one exhaustive switch over the root kinds, so a
new kind is a compile error until it gets a case.

Rejected alternative: a second flat predicate `listChangeDataFiles` beside `listChangeMarkdownFiles`. It is
smaller today. But it repeats the fanout that already caused a gap: each new file class must be wired into five
consumers by hand. The one `rootKind` classifier makes a shown-but-not-searchable artifact unrepresentable,
because count and search both derive from it.

Rejected alternative: a registry of self-describing producers, one per kind, each returning lazy artifact
sources that count, search, and discover all iterate. It unifies the cheap and the rich paths behind one list.
But that unification is the only thing it buys, and once the cheap metadata layer and the rich builder live in
separate files (the split above), there is nothing left to unify: the lazy source container exists only to let
one file serve both needs. The layers plus one classifier reach the same "nothing forgotten" guarantee with
fewer moving parts.

Rejected alternative: schema-aware discovery, which shows only files a schema's `generates:` names. That is
more precise. But it would make discovery consult the schema or the CLI. That breaks spek's rule that scanning
is disk-driven and never calls the CLI. It would also hide a file an author dropped in by hand.

### D2 — The `data` files, and the two guards that bound them

`rootKind` classifies root-level `.yaml`, `.yml`, and `.json` files as `data`. Matching is root-only and
non-dotfile. `buildArtifact` reads each file's raw text into `content`. The frontend derives the fence language
from the title extension: `.json` maps to `json`, and `.yaml` / `.yml` map to `yaml`.

Two existing guards bound "unexpected files". First, dotfile exclusion: the change's `.openspec.yaml` and any
tool droppings never appear. Second, root-only scope: nothing under a subdirectory sweeps in. One residual case
remains: a stray root-level `.yaml` or `.json` that an author did not intend. spek already has this behavior for
a stray root `.md`, because every root `*.md` is already a tab. So it is a wider net, not a new class of
surprise. This change adds no denylist. A change directory holds spec content, not a package, so a
`package.json` at a change root would be unusual. A denylist is speculative and could drift.

### D3 — A `data` title keeps its extension

A `data` artifact's title is its filename with the extension, such as `asyncapi.yaml`. It is not
`humanize(stem)`. This keeps the tab clear. It also stops a `data` tab from repeating a same-stem markdown
tab's label.

### D4 — An exhaustive render switch, and the loose DTO stays for now

Add `"data"` to `ArtifactKind`. Keep `ChangeArtifact` in its current shape: `content`, `tasks`, and `specs`
stay optional. `data` reuses the optional `content` field for raw text, so `ChangeArtifact` gains no new field.

Make the change-detail render switch on `kind` exhaustive. A `default` branch calls an `assertNever(kind)`
guard. Today the switch ends in a `tasks` fallthrough with no default, so a new kind renders as tasks and
raises no error. The guard turns a missed kind into a compile error. So a future artifact type is safe to add:
`rootKind` classifies it, `buildArtifact` builds it, and the render guard forces a branch for it.

Rejected alternative: a discriminated-union `ChangeArtifact`, one member per kind, each with only its own
payload. It is the cleaner type, and it gives per-kind payload safety. But `ChangeArtifact` is published from
`@spekjs/core` and read across the wire. A consumer that reads `artifact.content` without first narrowing on
`kind` compiles today, and it would not compile against a union. So the union is a breaking type change and a
**major** bump. The exhaustive switch gets most of the safety at a minor bump. Take the union later, with the
major bump, when per-kind payload typing earns it. When it lands, `buildArtifact` and the render branches
already exist, so only the type moves.

### D5 — Render through the Markdown pipeline as a fenced block, with highlighting

A `data` artifact renders by passing its content to `MarkdownRenderer` as a fenced code block. The fence
language comes from the extension (D2). The wrapper picks a backtick fence longer than the longest backtick run
in the content. So a file that contains a ``` run cannot break out of the fence.

A rehype highlighter is enabled. One mechanism serves both the new artifacts and the code fences already inside
`proposal.md` and `design.md`. It also inherits the app's code and chip classes. This matters because the VS
Code webview injects its own stylesheet onto bare elements, so the block must carry app classes and not rely on
element defaults. The highlighted block's `<code>` must set an explicit `bg-bg-tertiary`. The webview's
injected bare-`code` rule paints the editor's own code background, which is dark even under a light theme.
Without the explicit background, that colour shows through and the block reads dark on a light panel. This
reproduces only under the host stylesheet, never in a browser. So the renderer test pins it at the class
level, not by a paint check.

The highlighter changes the shape of a code node, so the `code` component must adapt. `rehype-highlight` adds
`hljs` to the class list and replaces the single text child with `hljs-*` token spans. The current block test,
`className?.startsWith("language-")`, can then fail, because `hljs` can come first. The test changes to find
`language-` anywhere in the class list. The component keeps rendering the child spans directly, so the token CSS
from D6 applies.

A `data` tab has no table of contents, because it is not Markdown. `isMarkdownLike` already returns false for
`data`, so no TOC shows with no further change. It has no folding. This is the same lane as `tasks`.

### D6 — Highlight colors are tokenized and contrast-checked

Highlighting adds a palette that the repo's contrast discipline does not yet cover. Do not ship a prebuilt
highlighter theme of untokenized colors. Instead, define a small set of per-theme `--color-*` tokens: base,
keyword, string, number, comment, and punctuation. Map the highlighter's `hljs-*` classes to them. Add the
tokens to `contrast.test.ts`, so each meets WCAG AA in both themes. Code content is meaningful text, so it
follows the standard. It is not excluded the way the decorative BDD marks are. This is most of the work.

Note: a code fence with no language hint renders as plain, uncolored code, and raises no error. Highlighting is
best-effort on the declared language.

### D7 — One classifier feeds discovery, count, and every search

The `rootKind` classifier feeds `discoverArtifacts`, `countArtifacts`, and the search on each host. spek has
three separate search implementations: the web server route in `openspec.ts`, the VS Code handler in
`handler.ts`, and the Kotlin `SearchService.kt`. Each one reads `listChangeArtifactFiles`, which derives from
`rootKind`. So a `data` artifact is always counted in the change-list badge and returned by full-text search,
on every host. This extends the single-source-of-truth guard that already binds discovery, count, and search
for Markdown. It also removes the by-hand wiring that a second predicate would need.

### D8 — All hosts

The core TS layers land in `@spekjs/core` as `artifact-files.ts` (the listing, count, and search file set) and
`artifact-discovery.ts` (the builder). The Kotlin side mirrors the pair: `ArtifactFiles.kt` and
`ArtifactDiscovery.kt`, with `SearchService.kt` reading `ArtifactFiles.artifactFiles`. Kotlin models the root
kinds as an `enum` (`RootKind`), so its `buildArtifact` `when` is exhaustive, which matches the TS
`assertNever` guard. `ChangeArtifact.kind` stays a `String` on both sides. The renderer is the shared React
SPA, so one `data` render branch covers the web, VS Code, and IntelliJ UIs together.

## Risks / Trade-offs

- The refactor touches working code. The markdown, tasks, and specs paths move into `artifact-files.ts` and
  `artifact-discovery.ts`, and their tests move with them. Mitigation: the behavior is unchanged. The existing
  tests pin it, and id precedence and mtime sort stay in `discoverArtifacts`.
- Highlighter palette against the contrast obligation. Mitigation: tokenize a small set and add contrast-test
  rows (D6). Do not ship an untokenized theme.
- Bundle weight. Mitigation: prefer a light rehype highlighter (highlight.js through `rehype-highlight`) over a
  grammar-bundling engine. It also serves markdown fences, so the cost is shared.
- Wider discovery net. Mitigation: the dotfile and root-only guards bound it (D2). It is symmetric with the
  existing `*.md` behavior.
- Cross-host drift. Mitigation: the Kotlin mirror moves in the same change (D8), with mirrored tests.

## Migration Plan

The change is additive at the type level. `ArtifactKind` gains a value, and `ChangeArtifact` keeps its shape.
Existing changes gain no new artifacts unless they already contain a root `.yaml`, `.yml`, or `.json`. The
published `@spekjs/core` API change is additive, so it is minor. There is no data migration. A later
discriminated-union `ChangeArtifact` (D4) would be a separate, major change.

## Open Questions

None.
