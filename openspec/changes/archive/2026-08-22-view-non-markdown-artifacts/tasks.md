# Tasks — View non-markdown artifacts in a change

## 1. Core: artifact-files listing and data discovery

**Evolution note.** This section was first built as a registry of self-describing producers. During review the
registry was found to add machinery for no gain once the cheap metadata path and the rich builder split into
separate files, so it was replaced (see design D1). The tasks below describe what shipped: two layers plus one
`rootKind` classifier. Behavior is unchanged throughout, pinned by the pre-existing tests.

- [x] 1.1 Add `"data"` to `ArtifactKind` in `@spekjs/core` types.
- [x] 1.2 Add `artifact-files.ts` — the filesystem view of a change directory (readdir and stat only, no
  content reads). It owns the `rootKind` classifier (the one place that names a root file's kind), `rootArtifacts`
  (the root files with their kinds, one directory read), `listSpecFiles`, and the cheap public functions
  `countArtifacts`, `changeDirMtime`, `listChangeArtifactFiles`, `listChangeMarkdownFiles`.
- [x] 1.3 Add `artifact-discovery.ts` — `discoverArtifacts` reads each file's content and builds the artifacts
  over a shared id/mtime pass. **Deviation:** the id-dedup order is `(specs, tasks, markdown, data)`, not
  `(tasks, markdown, data, specs)`. `specs` must reserve its id *first* so a root `specs.md` still becomes
  `specs-2`, and `markdown` must precede `data` so `spec.md` keeps `spec` and `spec.json` becomes `spec-2`.
  Order only affects id-dedup; display order is mtime-sorted regardless. Confirmed by the existing `specs.md` +
  `specs/` tests, which still pass.
- [x] 1.4 Classify root-level `.yaml`, `.yml`, and `.json` as `data` in `rootKind` (root-only and non-dotfile).
  `buildArtifact` sets `content` to the raw text and the title to the filename with its extension. **Deviation:**
  the fence language is *not* derived in core — `ChangeArtifact` gains no field, so the frontend derives the
  language from the title's extension at render time (D2/D5). Core only stores the extension-bearing title.
- [x] 1.5 Derive `countArtifacts` from `rootArtifacts` plus the specs tree, so the change-list badge matches the
  tabs.
- [x] 1.6 Derive `changeDirMtime` from the same artifact file set plus `specsMtime`, so it reflects every kind's
  files, including `data`. An edit to only a `data` artifact then bumps the change's mtime for the cross-worktree
  election, and a future kind is included with no further change.
- [x] 1.7 Add unit tests in `artifact-discovery.test.ts`. Confirm `.yaml`, `.yml`, and `.json` are discovered as
  `data`. Confirm `.openspec.yaml` (a dotfile) is excluded. Confirm a `.json` file in a subdirectory is not
  discovered. Confirm `spec.md` and `spec.json` produce different ids. Confirm the count equals the tab count.
  The markdown, tasks, and specs output is pinned unchanged by the pre-existing tests, which still pass. Added a
  `listChangeArtifactFiles` test and a `changeDirMtime`-includes-data test.

## 2. Web: render and highlight

- [x] 2.1 Added `rehype-highlight@^7` to `MarkdownRenderer` (`detect: false`). A language-tagged fence is
  highlighted; a language-less fence renders plain; an unknown language degrades to a warning (never throws).
  BDD-keyword and keywords-in-code behavior unchanged (block code never runs `processChildren`).
- [x] 2.2 Adapted the `code` component. Confirmed via source that `rehype-highlight` **unshifts** `hljs` to the
  front (index.js:101), so the block test is now `classList.some(c => c.startsWith("language-")) ||
  classList.includes("hljs")`, not `startsWith`. Child spans render directly.
- [x] 2.3 Added `--color-hl-{base,keyword,string,number,comment,punctuation}` to both theme blocks in
  `global.css`, mapped from `hljs-*` classes (no highlight.js theme imported — its literals would bypass the
  contrast discipline). Block carries the app's `pre`/`code` classes already.
- [x] 2.4 Added a `data` render branch in `ChangeDetail.tsx`, before the `tasks` branch. Renders through
  `MarkdownRenderer` as a fenced block via `fencedBlock` (fence grows past any backtick run) with the language
  from `dataLanguage`. **Deviation:** `isMarkdownLike` / `dataLanguage` / `fencedBlock` moved to
  `utils/dataArtifact.ts` (pure, testable without the page's hook/router graph). No folding; `isMarkdownLike`
  returns false for `data`, so no TOC.
- [x] 2.5 Made the render dispatch exhaustive. **Deviation:** implemented as an early guard
  `if (artifact.kind !== "tasks") return assertNever(artifact.kind)` rather than a `switch`/`default`, so the
  large tasks JSX needed no reindent. Same guarantee — a new unhandled kind is a compile error.
- [x] 2.6 Added the six `hl-*` tokens to `contrast.test.ts` `TEXT_TOKENS` (no tint). Measured worst-surface:
  dark ≥ 7.76:1, light ≥ 5.49:1 — all clear WCAG AA in both themes.
- [x] 2.7 Added `MarkdownRenderer.highlight.test.ts` (json/yaml highlighted, no-language plain, BDD-in-code
  unmarked, prose BDD still marked) and `utils/dataArtifact.test.ts` (extension→language mapping, fence-grow
  escaping, data renders highlighted, `isMarkdownLike("data") === false`).

## 3. Search: web and VS Code

- [x] 3.1 Pointed the web search index (`openspec.ts`) at `listChangeArtifactFiles` (was `listChangeMarkdownFiles`),
  so it includes `data` artifacts.
- [x] 3.2 Pointed the VS Code search handler (`handler.ts`) at `listChangeArtifactFiles` too, so it includes
  `data` artifacts. Keeps the shown-as-tab invariant on the VS Code host.
- [x] 3.3 Added `openspec.search.test.ts` (throwaway express app): a query matching a `.yaml` artifact and one
  matching a `.json` artifact each return their change.

## 4. IntelliJ: Kotlin parity

- [x] 4.1 Mirrored the two layers in Kotlin: `ArtifactFiles.kt` (the listing, `rootArtifacts`, `listSpecFiles`,
  `count`, `artifactFiles`) and `ArtifactDiscovery.kt` (the builder). Kotlin models the root kinds as an `enum`
  (`RootKind`), so `buildArtifact`'s `when` is exhaustive, which matches the TS `assertNever` guard.
  `ChangeArtifact.kind` stays a `String`, matching the loose-DTO decision (D4). Existing markdown/tasks/specs
  behavior unchanged (pinned by the pre-existing tests, still passing).
- [x] 4.2 Pointed `SearchService.kt` at `ArtifactFiles.artifactFiles(changeDir)` (was an open-coded `.md`
  filter), so IntelliJ search indexes `data` artifacts from the same file set.
- [x] 4.3 Added Kotlin tests mirroring 1.7 (data discovered, dotfile excluded, root-only, spec.md/spec.json id
  dedupe, count == tabs, `artifactFiles` set) plus a `SearchService` test: content inside a `.yaml` data
  artifact is found. Full `./gradlew test` passes.

## 5. Verification

- [x] 5.1 Verified by tests, not a manual browser paint: core discovers `asyncapi.yaml` as a `data` artifact
  (titled with extension) and excludes `.openspec.yaml`; `MarkdownRenderer` renders a json/yaml fenced block
  with real `hljs-*` token spans (`renderToStaticMarkup`); the data render path composes
  `fencedBlock`+`dataLanguage` to the same highlighted output. Tab generation from `artifacts` is existing
  tested behavior. No live screenshot captured.
- [x] 5.2 A Markdown-only change is unchanged: the pre-existing `artifact-discovery.test.ts` / Kotlin tests still pass
  untouched; the only new behavior is fenced code blocks now highlighting (covered by the renderer tests).
- [x] 5.3 On each host the count and search include `data`: core `countArtifacts` test (count == tabs), web
  `openspec.search.test.ts`, VS Code shares `listChangeArtifactFiles`, Kotlin `count` + `SearchService` test.
- [x] 5.4 Discovery is root-only and dotfile-excluding: verified in both TS and Kotlin tests (subdir `.json`
  not discovered, `.openspec.yaml` excluded).
- [x] 5.5 All gates pass: `npm run build:core`, `npm run type-check`, `npm run lint`, `npm test` (core 372 /
  ui 33 / web 211, 0 fail), Kotlin `./gradlew test` (BUILD SUCCESSFUL), and `npm run build` (web Vite bundle
  builds; ~249 KB gzip — the highlighter weight D5 accepted).
