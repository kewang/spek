## 1. Core: cyclicity and the detection rule

- [x] 1.1 Widen `computeArtifactLevels` in `packages/core/src/schema-flow.ts` to report whether it fell back to positional levels, keeping the levels map available to every existing caller
  - Deviation: done additively instead of by widening. `computeArtifactLevels` is exported from `packages/core/src/index.ts`, so changing its return type would break `@spekjs/core` consumers — contradicting the proposal's "additive, so a minor bump". A new `levelArtifacts` returns `{ levels, cyclic }` and `computeArtifactLevels` delegates to it, so there is still one traversal and one answer.
- [x] 1.2 Update `packages/web/src/utils/schemaView.ts` and any other caller for the widened return, so the change is compile-verified rather than assumed
  - Deviation: no caller needed updating, because 1.1 left the signature unchanged. The compile-verification this task was buying is instead covered by 1.3's caller of `levelArtifacts` and by `npm run type-check` in 4.1.
- [x] 1.3 Add `postApplyArtifacts` to `schema-flow.ts` implementing the closure rule: apply declared, at least one resolvable id in `apply.requires`, acyclic graph, step outside `closure(apply.requires)`, and `closure(step)` covering every resolvable id in `apply.requires`
- [x] 1.4 Put the closure rule behind a resolver that answers, per step, its ordering relative to implementation *and* the source that ordering came from, taking the apply step as a parameter rather than matching the literal id `"apply"`. Today it has one branch; a declared source is added as a branch that returns early, so precedence is per step and needs no mode switch
- [x] 1.5 Export both from the `@spekjs/core/schema-flow` subpath and the package index, keeping the module free of any server-only import so the webview bundle is unaffected
- [x] 1.6 Unit-test the rule against the corpus shapes: `superpowers-bridge` (`verify`, `retrospective`), `anvil` (`verify`), and no-ops for `spec-driven`, `nanopm`, `e2e-runbooks`, `propose-spec-verify`
- [x] 1.7 Unit-test each guard with the input that motivated it: `apply.requires` resolving to nothing must flag nothing (empty-set superset trap), a cyclic graph must flag nothing, an artifact inside apply's closure is never flagged, and a side `research → adr` chain that ties apply's level is not flagged
- [x] 1.8 Run `npm run build:core` so the web package's tests exercise the new code rather than the previous build

## 2. Step identity and apply as a graph node

- [x] 2.1 Give `FlowStep` a key distinct from its declared id in `schemaView.ts`, keeping the declared id as the display and `requires`-resolution value for artifacts
- [x] 2.2 Key the node map in `packages/web/src/utils/schemaLayout.ts` by that step key instead of `step.id`, so two steps sharing a declared id no longer collapse
- [x] 2.3 Rework `buildFlowSteps` to level artifacts and apply as one graph, with a derived edge from apply into each step `postApplyArtifacts` identifies, levelling from the full declared `requires`
- [x] 2.4 Give every edge an origin of `declared` or `derived`, set where the edge is produced, and have the view branch on that field rather than on which steps it connects — so an ordering that later arrives declared renders as an ordinary edge with no view change. Confirm `drawableRequires` drops the declared edge the derived one implies
- [x] 2.5 Cover the forward path with a test that feeds the resolver a step whose ordering is already known: it returns `declared`, the closure rule does not run for that step, and the edge renders unmarked — the assertion that adopting a declared source is a branch rather than a rework
- [x] 2.6 Correct the `buildFlowSteps` doc comment that claims post-implementation steps already stay after apply — it describes the intended behavior, not the behavior before this change
- [x] 2.7 Update the existing assertion in `packages/web/src/utils/schemaView.test.ts` that `verify` shares apply's level, which encodes the behavior being replaced
- [x] 2.8 Update the existing `withArchiveStep` assertion that archive depends on both `apply` and `retrospective`, since apply stops being a leaf once it has a dependent
- [x] 2.9 Add tests for step-key independence: a schema declaring an artifact named `apply` keeps both steps addressable, with connections resolving to the intended one, and counts the declared artifact in its artifact count
  - Deviation: keys are allocated as "declared id unless already claimed" rather than prefixed by kind, so for every schema without a collision the key *is* the id and the diagram's graph reads in the schema's own vocabulary. Prefixing would have rewritten 11 passing layout assertions into a translated id space for no behavioural gain.
  - Found while implementing: `resolveImplementationOrdering`'s declared branch had to stop firing when an artifact claims the phase's id. In `superspec`, `verify.requires: [apply]` names the declared artifact — a dependency the CLI itself resolves — so reading it as the phase would have invented an edge the author never wrote, on the one schema most likely to hit it. Covered by a core test.

## 3. Rendering the derived edge

- [x] 3.1 Render the derived connection in `packages/web/src/components/SchemaFlow.tsx` visually distinct from a declared one
- [x] 3.2 Name the derived form in the diagram legend, alongside the existing distinction for the archive step
- [x] 3.3 State what the derived edge was derived from where the reader meets it, without asserting the CLI blocks on it
- [x] 3.4 Verify the distinction holds in both themes and carries a non-colour cue, so it does not depend on hue alone
  - Verified by screenshot in both themes across `superpowers-bridge`, `anvil`, `superspec`, `spec-super` and `spec-driven`. The cue is a dash pattern, not a hue, so it survives selection (the edge keeps its dash while lighting up in the accent), greyscale, and a colour-blind reader.
  - Consequence worth noting: selection was moved from step id to step key in `SchemaDetail` / `SchemaFlow` / `SchemaGraph` as part of 3.1, since a schema with two steps sharing an id could otherwise select only one of them.

## 4. Verification against real schemas

- [x] 4.1 Run `npm run type-check`, `npm run lint`, and `npm test`
- [x] 4.2 Check `/schemas/superpowers-bridge` and `/schemas/anvil` in the running app: apply precedes `verify`, the connection into `verify` is the derived one and is the only one, and archive waits on the tail
  - `superpowers-bridge`: brainstorm → proposal → design → specs → tasks → plan → **apply → verify** → retrospective → archive; 9 solid edges and exactly 1 dashed. `anvil`: … → tasks → **apply → verify** → archive; 7 solid, 1 dashed. Archive waits on the post-implementation tail in both.
- [x] 4.3 Check `/schemas/superspec`: the declared `apply` artifact and the apply step both appear, both selectable, with connections landing on the intended step
  - `superspec`: both `apply` steps render (… → plan → apply → apply → verify → finalize → archive), each selectable, connections landing on the intended one. Keyed by declared id alone, one silently replaced the other.
- [x] 4.4 Check `/schemas/spec-super`: `blackbox-test` is a known false positive, so confirm the derived marking reads as an inference rather than as a declared dependency
  - `spec-super`: apply → blackbox-test, drawn dashed and explained as spek's reading. The known false positive reads as an inference the reader can reject, which is what the derived marking is for.
- [x] 4.5 Check `/schemas/spec-driven`, `/schemas/nanopm`, and `/schemas/e2e-runbooks` render exactly as before
  - `spec-driven`, `nanopm`, `e2e-runbooks`: 0 dashed edges and unchanged order (`proposal → specs → design → tasks → apply → archive` for the first two). 13 of the 17 schemas resolvable here are no-ops.
- [x] 4.6 Confirm the schemas list still costs one CLI call and no page gained a request, since the rule needs `requires` that only the detail read holds
  - Measured with a logging shim ahead of the real binary on PATH, not inferred: the schemas list costs **1** `openspec schemas --json` for 17 schemas, and each detail page costs **1** `openspec schema which <name> --json`. Unchanged. No page gained a network request either — the branch adds no `fetch`, adapter call, effect or EventSource anywhere (checked against the diff).
- [ ] 4.7 Verify the VS Code webview rendering of the derived edge against the real host, since the host injects its own stylesheet and this class of problem cannot reproduce in a browser
  - **Outstanding — needs a human at the VS Code UI.** The extension is built from this branch and installed (`kewang.spek-vscode@1.12.0`), but this session runs as the *remote* half of an SSH session, so the Electron app is on the user's machine and unreachable from here.
  - Machine-verifiable half done: both inline `<code>` elements added by this change carry all four chip utilities (`bg-bg-tertiary text-accent px-1.5 py-0.5`), and no bare `<code>` was added — that is the specific rule the host stylesheet breaks. The dashed edge itself is an SVG `stroke-dasharray`, which a host stylesheet cannot reach.
  - What still needs eyes: the three chips in the derived-order callout rendering as chips rather than picking up the host's `code` styling.
