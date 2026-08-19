## Why

A schema can declare artifacts that are only produced *after* implementation, but OpenSpec's format
has no way to say so: an artifact's `requires` can name only other artifacts, and the CLI's own
graph pass dereferences each entry as a declared artifact, so `requires: [apply]` throws rather than
parsing. Authors work around it by pointing the post-implementation artifact at the last planning
artifact and stating the real ordering in prose — `superpowers-bridge`'s `verify` declares
`requires: [plan]` while its instruction says the step "MUST run on a completed implementation", and
`anvil`'s `verify` opens with "Produced AFTER apply completes."

spek renders the declared graph faithfully, so those artifacts land on apply's own level and read as
its peers. In `superpowers-bridge` that puts `verify` beside `apply`, inviting exactly the mistake
the schema's runtime precheck exists to block.

A survey of every OpenSpec schema discoverable on GitHub — 88 unique schemas declaring an `apply`
block, well beyond the five in the official catalog — found **18 that declare post-implementation
artifacts**, four of which fail OpenSpec's own validation and never enumerate. So roughly one schema
author in five hits this, and 14 such schemas can reach spek's diagram today.

**This reverses a decision this spec already recorded.** The `schema-browsing` requirement currently
states the graph "SHALL NOT be augmented with edges the CLI does not enforce", with a scenario
naming this exact `apply → verify` case, on the grounds that such an edge "would show a constraint
that does not exist in `openspec status`". That reasoning was right about what an *ordinary* edge
claims. What has changed is the evidence: drawing these steps as peers is not neutral — it asserts
an interchangeability that is wrong in every one of the real cases — and an edge marked as inferred
can carry the ordering without claiming the CLI enforces it. The prohibition is replaced with a
narrower one: no edge may be drawn that is *indistinguishable* from a declared edge.

## What Changes

- Post-implementation artifacts are detected from the `requires` graph alone, by a rule that holds
  only when apply exists with at least one resolvable requirement and the graph is acyclic: an
  artifact outside the transitive closure of `apply.requires`, whose own closure covers all of
  `apply.requires`. Such an artifact cannot become available before apply does, and apply does not
  need it.
- The apply step is levelled as a real node in the graph, with a synthesised edge to each detected
  artifact, so those artifacts fall after apply rather than beside it. Levelling continues to use
  the full declared `requires`; the transitive reduction already drops the now-redundant declared
  edge, so `verify` draws one incoming connection, from apply.
- The synthesised edge is rendered **visually distinct from a declared edge** and identified as
  inferred, naming the reason. The ordering is derived, not declared, and must never be mistaken for
  something `openspec status` blocks on.
- **BREAKING (view only)**: a schema declaring an artifact literally named `apply` no longer
  collapses against the synthesised apply step. Both are currently keyed by `step.id`, so one silently
  replaces the other and connections resolve to the wrong node. `superspec` (the second most-starred
  schema source found, and an OpenSpec + Superpowers bridge like the one this repo uses) declares
  such an artifact, as an implementation receipt.
- The archive step's dependencies follow from the above rather than changing by their own rule: once
  apply has a dependent it is no longer a leaf, so archive depends on the post-implementation tail
  instead of on apply and that tail both.

The inference is deliberately bounded. Against the 88-schema corpus the rule is a no-op on every
built-in schema and correct on all three flagged artifacts across the official catalog, but its
precision over all 39 artifacts it flags is about 82%. Two classes are misread: planning artifacts
that happen to depend on everything apply requires (`ai-solo-workflow`'s `execution-plan`,
`feature-workflow`'s `work-packages`), and schemas that model implementation as an ordinary artifact
rather than through the `apply` block (`pdca`'s `do`, `openspec-agile-workflow`'s `implementation`).
No signal in the declared format separates either class from a genuine post-implementation step —
`apply.tracks` and `generates` look identical across both — which is why the edge must announce that
it is inferred rather than assert an ordering.

## Capabilities

### New Capabilities

None. This changes how an existing view draws a graph it already reads.

### Modified Capabilities

- `schema-browsing`: replaces the prohibition on inferred edges with a requirement that a derived
  edge be drawn and marked as derived; states the detection rule and its guards; requires the apply
  step to be levelled as a graph node with dependents; requires an artifact whose id collides with
  the apply step to remain addressable as a distinct step.

## Impact

- `packages/core/src/schema-flow.ts` — `computeArtifactLevels` reports whether it fell back to
  positional levels (a cycle), which the new rule must refuse to run on; new `postApplyArtifacts`.
  Exported at the existing `@spekjs/core/schema-flow` subpath, so it stays browser-safe.
- `packages/web/src/utils/schemaView.ts` — `buildFlowSteps` levels apply as a graph node and carries
  the inferred edges; `withArchiveStep`'s leaf detection is unchanged but its result moves.
- `packages/web/src/utils/schemaLayout.ts` — the node map keyed by `step.id` must not collapse two
  steps sharing an id.
- `packages/web/src/components/SchemaFlow.tsx` — renders the inferred edge distinctly.
- Two existing assertions encode today's behaviour and change with it:
  `schemaView.test.ts` asserting `verify` shares apply's level, and the one asserting archive
  depends on both `apply` and `retrospective`.
- `@spekjs/core` gains a public export — additive, so a minor bump on the core line, to be recorded
  at release time rather than in this change.
- No Kotlin mirror: `schema-flow.ts` has no Kotlin caller, since the IntelliJ tool window loads the
  same React SPA.
- No new CLI call and no filesystem read. The rule uses `requires`, which only the detail read
  holds, so the schemas list stays at one CLI call.
