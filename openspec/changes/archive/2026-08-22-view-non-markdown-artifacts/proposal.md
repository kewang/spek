## Why

An OpenSpec artifact's file type comes from its schema's `generates:` value. Not every artifact is Markdown.
A real schema shows this. The `event-driven` schema declares an artifact `asyncapi` with `generates: asyncapi.yaml`.
That artifact is required. The schema's `tasks` artifact lists `requires: [asyncapi]`.

spek's scanner discovers a change's artifacts from a narrow set: root `*.md` files plus a non-empty `specs/`
tree (`discoverArtifacts` / `listChangeMarkdownFiles`). It drops any other file at the change root. A `.yaml`,
`.yml`, or `.json` artifact is one such file. So a change authored under `event-driven` renders every tab
except its `asyncapi.yaml`. That artifact is declared and required, but the viewer never shows it.

This change lets spek show non-Markdown artifacts that already exist in a change.

## What Changes

- The scanner discovers root-level `.yaml`, `.yml`, and `.json` files as a new `data` artifact kind. Discovery
  stays root-only. It does not recurse past the existing `specs/` tree. It excludes dotfiles, so it never
  shows the change's own `.openspec.yaml` metadata. This matches how the scanner already discovers root `*.md`
  files.
- Artifact discovery splits into two layers. `artifact-files.ts` is the filesystem view: it lists which files
  are artifacts, their kinds, their names, and their mtimes, and it reads no content. `artifact-discovery.ts`
  reads content and builds the artifacts. One `rootKind` classifier names the kind of each root file, so
  classification lives in one place instead of branches spread through `discoverArtifacts`. A new root artifact
  type is one entry in `rootKind` and one branch in `buildArtifact`.
- Every consumer derives from that one classifier: discovery, the artifact count on `ChangeInfo`, and the
  search on each host. spek has three separate search implementations, one for each host. Each one reads the
  same artifact file set. So a `data` tab always counts in the change-list badge and returns from full-text
  search. A type shown as a tab cannot be missed by count or search, because count and search both derive from
  `rootKind`, not from a second list to keep in step.
- The change-detail render switch on `kind` becomes exhaustive. A default branch calls an `assertNever` guard.
  So a future artifact type cannot fall through unhandled, which the current switch allows.
- Change detail renders a `data` artifact as a syntax-highlighted code block. The language comes from the file
  extension. A `data` tab has no table of contents, because its content is not Markdown, and it has no
  folding. This matches the Tasks tab.
- `MarkdownRenderer` gains syntax highlighting for fenced code blocks, through a rehype highlighter. A `data`
  artifact renders through this same pipeline as a fenced block. So the highlighting covers both the new
  artifacts and the code fences already inside `proposal.md` and `design.md`.
- Highlight colors are per-theme tokens. Each meets the project's contrast obligation in both the light theme
  and the dark theme. Code is meaningful text, so the tokens follow the standard rather than an exclusion.
- The Kotlin mirror gains the same two layers, so IntelliJ stays at parity: `ArtifactFiles.kt` for the listing,
  count, and search file set, and `ArtifactDiscovery.kt` for the builder. `SearchService.kt` reads
  `ArtifactFiles.artifactFiles`. Kotlin models the root kinds as an `enum`, so its `buildArtifact` `when` stays
  exhaustive.

A change that contains only Markdown artifacts does not change. The scanner discovers nothing new. The one
exception: code fences inside its documents now render highlighted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-scanner`: discovers root-level `.yaml`, `.yml`, and `.json` as a `data` artifact kind. Discovery
  is root-only and excludes dotfiles. One source of truth feeds artifact discovery, the count on `ChangeInfo`,
  and the search on each host from one file set.
- `change-browsing`: the change-detail tabs render a `data` artifact as a syntax-highlighted code block, with
  no table of contents and no folding.
- `markdown-renderer`: fenced code blocks are syntax-highlighted, with theme-aware, contrast-checked colors.
- `search-api`: a change's `data` artifacts are part of the searchable content.

## Impact

- **`@spekjs/core`**: `ArtifactKind` gains `"data"`. Discovery splits into `artifact-files.ts` (the listing,
  count, mtime, and search file set) and `artifact-discovery.ts` (the builder), with one `rootKind` classifier
  driving `countArtifacts`, `listChangeArtifactFiles`, and the build. `changeDirMtime` reads the same file set,
  so it reflects every kind's files, including `data`, with no per-kind wiring. The existing `uniqueId` logic
  separates cross-extension id collisions: `spec.md` becomes `spec`, and `spec.json` becomes `spec-2`.
  `ChangeArtifact` keeps its current shape: the optional
  fields stay, so the change is additive. It is therefore **minor, not patch**. A later move to a
  discriminated-union `ChangeArtifact` would be a breaking type change and a **major** bump. This change does
  not make that move (see design D4).
- **`packages/web/src`**: a `data` render branch in `ChangeDetail`, plus an `assertNever` default on the kind
  switch. A rehype highlighter in `MarkdownRenderer`, plus a change to the `code` component's block test (see
  design D5). New per-theme `--color-*` highlight tokens in `global.css`. `contrast.test.ts` extended for those
  tokens.
- **`packages/web/server`**: the web search index reads `listChangeArtifactFiles`, so it includes `data`
  artifacts.
- **`packages/vscode`**: the search handler in `handler.ts` reads the same file set, so it includes `data`
  artifacts.
- **`packages/intellij`**: the Kotlin `ArtifactFiles.kt` listing, the `ArtifactDiscovery.kt` builder, the
  `SearchService.kt` search, and their tests.
- **No behavior change** for a change with only Markdown artifacts, apart from code fences now rendering
  highlighted.
