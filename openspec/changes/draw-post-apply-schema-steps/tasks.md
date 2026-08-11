## 1. Core: cyclicity and the detection rule

- [ ] 1.1 Widen `computeArtifactLevels` in `packages/core/src/schema-flow.ts` to report whether it fell back to positional levels, keeping the levels map available to every existing caller
- [ ] 1.2 Update `packages/web/src/utils/schemaView.ts` and any other caller for the widened return, so the change is compile-verified rather than assumed
- [ ] 1.3 Add `postApplyArtifacts` to `schema-flow.ts` implementing the closure rule: apply declared, at least one resolvable id in `apply.requires`, acyclic graph, step outside `closure(apply.requires)`, and `closure(step)` covering every resolvable id in `apply.requires`
- [ ] 1.4 Put the closure rule behind a resolver that answers, per step, its ordering relative to implementation *and* the source that ordering came from, taking the apply step as a parameter rather than matching the literal id `"apply"`. Today it has one branch; a declared source is added as a branch that returns early, so precedence is per step and needs no mode switch
- [ ] 1.5 Export both from the `@spekjs/core/schema-flow` subpath and the package index, keeping the module free of any server-only import so the webview bundle is unaffected
- [ ] 1.6 Unit-test the rule against the corpus shapes: `superpowers-bridge` (`verify`, `retrospective`), `anvil` (`verify`), and no-ops for `spec-driven`, `nanopm`, `e2e-runbooks`, `propose-spec-verify`
- [ ] 1.7 Unit-test each guard with the input that motivated it: `apply.requires` resolving to nothing must flag nothing (empty-set superset trap), a cyclic graph must flag nothing, an artifact inside apply's closure is never flagged, and a side `research → adr` chain that ties apply's level is not flagged
- [ ] 1.8 Run `npm run build:core` so the web package's tests exercise the new code rather than the previous build

## 2. Step identity and apply as a graph node

- [ ] 2.1 Give `FlowStep` a key distinct from its declared id in `schemaView.ts`, keeping the declared id as the display and `requires`-resolution value for artifacts
- [ ] 2.2 Key the node map in `packages/web/src/utils/schemaLayout.ts` by that step key instead of `step.id`, so two steps sharing a declared id no longer collapse
- [ ] 2.3 Rework `buildFlowSteps` to level artifacts and apply as one graph, with a derived edge from apply into each step `postApplyArtifacts` identifies, levelling from the full declared `requires`
- [ ] 2.4 Give every edge an origin of `declared` or `derived`, set where the edge is produced, and have the view branch on that field rather than on which steps it connects — so an ordering that later arrives declared renders as an ordinary edge with no view change. Confirm `drawableRequires` drops the declared edge the derived one implies
- [ ] 2.5 Cover the forward path with a test that feeds the resolver a step whose ordering is already known: it returns `declared`, the closure rule does not run for that step, and the edge renders unmarked — the assertion that adopting a declared source is a branch rather than a rework
- [ ] 2.6 Correct the `buildFlowSteps` doc comment that claims post-implementation steps already stay after apply — it describes the intended behavior, not the behavior before this change
- [ ] 2.7 Update the existing assertion in `packages/web/src/utils/schemaView.test.ts` that `verify` shares apply's level, which encodes the behavior being replaced
- [ ] 2.8 Update the existing `withArchiveStep` assertion that archive depends on both `apply` and `retrospective`, since apply stops being a leaf once it has a dependent
- [ ] 2.9 Add tests for step-key independence: a schema declaring an artifact named `apply` keeps both steps addressable, with connections resolving to the intended one, and counts the declared artifact in its artifact count

## 3. Rendering the derived edge

- [ ] 3.1 Render the derived connection in `packages/web/src/components/SchemaFlow.tsx` visually distinct from a declared one
- [ ] 3.2 Name the derived form in the diagram legend, alongside the existing distinction for the archive step
- [ ] 3.3 State what the derived edge was derived from where the reader meets it, without asserting the CLI blocks on it
- [ ] 3.4 Verify the distinction holds in both themes and carries a non-colour cue, so it does not depend on hue alone

## 4. Verification against real schemas

- [ ] 4.1 Run `npm run type-check`, `npm run lint`, and `npm test`
- [ ] 4.2 Check `/schemas/superpowers-bridge` and `/schemas/anvil` in the running app: apply precedes `verify`, the connection into `verify` is the derived one and is the only one, and archive waits on the tail
- [ ] 4.3 Check `/schemas/superspec`: the declared `apply` artifact and the apply step both appear, both selectable, with connections landing on the intended step
- [ ] 4.4 Check `/schemas/spec-super`: `blackbox-test` is a known false positive, so confirm the derived marking reads as an inference rather than as a declared dependency
- [ ] 4.5 Check `/schemas/spec-driven`, `/schemas/nanopm`, and `/schemas/e2e-runbooks` render exactly as before
- [ ] 4.6 Confirm the schemas list still costs one CLI call and no page gained a request, since the rule needs `requires` that only the detail read holds
- [ ] 4.7 Verify the VS Code webview rendering of the derived edge against the real host, since the host injects its own stylesheet and this class of problem cannot reproduce in a browser
