# @spekjs/core

Framework-agnostic engine for reading [OpenSpec](https://github.com/Fission-AI/OpenSpec) repositories.

It scans an OpenSpec directory, reads specs and changes, parses task checkboxes, and aggregates data across git worktrees (and, experimentally, jj workspaces) — with no framework dependencies. This is the engine behind [spek](https://github.com/spekhq/spek), the OpenSpec viewer (Web, VS Code, IntelliJ).

## Install

```bash
npm install @spekjs/core
```

Node.js only (ESM). Its sole runtime dependency is `cross-spawn`.

## Usage

```js
import { scanOpenSpec, readChange, parseTasks } from '@spekjs/core'

// Scan a repository's OpenSpec structure
const data = await scanOpenSpec('/path/to/repo')
// → { specs, activeChanges, archivedChanges, defaultSchema }

// Read one change, including its dynamically discovered artifacts
const change = await readChange('/path/to/repo', 'my-change-slug')
// → { slug, artifacts, schema, defaultSchema, schemaOrder, ... }

// Parse a tasks.md checkbox list
const tasks = parseTasks('- [x] 1.1 Done\n- [ ] 1.2 Pending\n')
// → { total: 2, completed: 1, sections: [...] }
```

Scanning never shells out to the OpenSpec CLI. `readChange` may query it once (cached) to resolve
schema-authoritative artifact ordering, and degrades gracefully when the CLI is unavailable.

## Main API

| Function | Purpose |
| --- | --- |
| `scanOpenSpec(basePath)` | Scan a single directory's OpenSpec structure |
| `scanOpenSpecAggregated(basePath, opts)` | Scan across every worktree of the same repo |
| `readSpec(basePath, topic)` | Read one spec, including its history |
| `readSpecAtChange(basePath, topic, slug)` | Read a spec as of a given change |
| `readChange(basePath, slug, orderProvider?)` | Read one change and its artifacts |
| `parseTasks(content)` | Parse `- [x]` / `- [ ]` checkboxes, grouped by `##` section |
| `buildGraphData(basePath)` | Build spec–change relationship graph data |
| `buildGraphDataAggregated(basePath, opts)` | The same, aggregated across worktrees |
| `listWorktrees(basePath)` | List every git worktree of the same repo |
| `listWorkspaces(basePath, opts?)` | The same, plus jj workspaces when `includeJj` is set |
| `shouldUsePolling(path, opts?)` | Decide whether file watching must fall back to polling |

## jj (Jujutsu) workspaces — experimental

`scanOpenSpecAggregated` and `buildGraphDataAggregated` accept `includeJj` (**default `false`**). When
enabled, active changes are also collected from every jj workspace of the repo.

```js
const data = await scanOpenSpecAggregated('/path/to/repo', { aggregate: true, includeJj: true })
```

jj copies do not go through the git-divergence election used for git worktrees — a jj working-copy
commit is a change id, not a git ref, and every workspace materialises the full trunk. They are
deduplicated by **content fingerprint** instead: identical copies collapse to one, a diverged copy
keeps its own entry flagged `conflictsWith`, and the copy that `@` is editing is flagged `isCurrent`.

Nothing is spawned unless jj is requested, and `jj` is never required: with the CLI absent or the
directory not a jj repo, the jj helpers resolve to `[]` and results are identical to `includeJj: false`.

## Subpath exports

```js
import { extractHeadings, slugifyHeading } from '@spekjs/core/headings'
import {
  DEFAULT_ORDER,
  defaultRank,
  sortArtifacts,
  ARTIFACT_SORT_MODES,
} from '@spekjs/core/artifact-order'
```

These subpaths are kept separate so browser bundles can import the utilities without pulling in
server-only modules.

`sortArtifacts(artifacts, mode, schemaOrder?)` orders a change's artifacts by one of
`ARTIFACT_SORT_MODES` — `modified` (the order given), `schema` (the authoritative sequence, falling
back to the narrative order when unavailable), or `alpha` (by title). `ArtifactSortMode` is derived
from `ARTIFACT_SORT_MODES`, so validating a persisted preference against the array cannot drift from
the type. Callers must not mutate a returned list: under `modified` it may be the array they passed in.

It is generic in the element type, so **your own artifact type comes back out** — no cast, and fields
of your own stay reachable on the result:

```ts
interface MyArtifact extends ChangeArtifact {
  relPath: string
}

const sorted: MyArtifact[] = sortArtifacts(myArtifacts, 'schema', order)
sorted[0].relPath // still typed — no cast anywhere
```

The element only has to carry the two fields the rule reads — `id` (the narrative rank, the
`schemaOrder` lookup and both tiebreaks) and `title` (`alpha`) — so it need not be a `ChangeArtifact`.
One missing either is rejected at compile time.

## License

MIT © Kewang
