## Context

See `proposal.md` — Why. Two constraints shape the approach.

**There is nothing to ask the CLI for.** OpenSpec's model has no post-implementation concept at all:
`formatChangeStatus` sets `isPlanningComplete` from *every* artifact being done, and its next-step
copy reads "All planning artifacts are complete. Run openspec instructions apply." Upstream #1312
described exactly this gap, naming `superpowers-bridge` as the schema working around it; it was
closed by #1062, which added `operations.apply.guidance` in `config.yaml` — free-text advisory
strings, no ordering. The schema-level remainder is #1456, which proposes only `instruction` and
`tracks` free text and is explicitly deferred. So this cannot follow the usual rule of deferring to
the CLI: the CLI has no answer, now or in the versions being designed.

**The corpus is bigger than the catalog.** A GitHub code search found 88 unique schemas declaring an
`apply` block, against the five listed in OpenSpec's community catalog. That corpus is what the
detection rule was tested against, and it is the reason the rule is stated in guards rather than as
a single condition.

## Goals / Non-Goals

**Goals:**

- Place post-implementation steps after apply using only the declared `requires` graph.
- Keep the derived edge distinguishable from a declared one, so the diagram never claims the CLI
  blocks on it.
- Make a step's identity independent of its declared id, so an artifact named `apply` survives.

**Non-Goals:**

- Reading a step's `instruction` prose to decide ordering. The rule uses the graph only; the
  surviving prohibition in the spec depends on that.
- Detecting a post-implementation artifact that declares `requires: []`. Nothing is declared, so
  nothing is derivable — and it levels to 1, so it never collides with apply anyway.
- Any Kotlin mirror. `schema-flow.ts` has no Kotlin caller; the IntelliJ tool window loads the same
  React SPA.
- Changing the artifact count, the schemas list, or the number of CLI calls either page makes.

## Decisions

### The rule is closure-based, not level-based

A step is post-implementation when it sits outside the transitive closure of `apply.requires` **and**
its own closure covers all of `apply.requires`. Read together: it cannot become available before
apply, and apply does not need it.

The obvious alternative — flag anything outside apply's closure that *ties or exceeds apply's
level* — was tested and rejected. On a constructed schema with a side `research → adr` chain, the
level rule pushes `adr` (planning work) past apply; the closure rule leaves it alone. Both rules
agree on every real schema, so the corpus alone would not have separated them.

### Two guards, each for a failure the corpus produced

- **At least one resolvable id in `apply.requires`.** The superset test is vacuously true against an
  empty set, so a schema whose `apply.requires` names only undeclared artifacts would have every
  artifact flagged. This is not hypothetical — `applyStepLevel` already has a branch for exactly
  that input.
- **Acyclic graph.** `computeArtifactLevels` already degrades to positional levels on a cycle.
  Layering a derived edge over a positional fallback is incoherent, so the rule declines to run.
  This requires `computeArtifactLevels` to *report* the fallback, which it currently swallows.

### Apply becomes a graph node rather than a post-hoc placement

Today `applyStepLevel` computes apply's level from the levels map, after the artifacts are levelled.
That cannot express steps that depend on apply. The apply step joins the graph — artifacts plus
apply, with derived edges added — and the whole thing is levelled once.

Levelling keeps using the **full** declared `requires`, not the transitive reduction. Removing an
implied edge never shortens the longest path, so the levels are the same either way; computing them
from the reduction would make that a coincidence rather than a guarantee.

`drawableRequires` then earns its keep: with `apply → verify` present and `apply` already requiring
`plan`, the declared `plan → verify` edge is implied by a longer path and drops out on its own. No
special-casing — `verify` renders one incoming connection, from apply.

### Step identity is separated from declared id

`schemaLayout.ts` builds `new Map(nodes.map((n) => [n.step.id, n]))`. A schema declaring an artifact
named `apply` produces two steps with id `"apply"`, one silently replacing the other, and edges then
resolve to the wrong node. `superspec` — the second most-starred schema source found, and an
OpenSpec + Superpowers bridge like the one this repo uses — declares such an artifact as an
implementation receipt.

Steps get a key distinct from the declared id, with the declared id kept as the display and
`requires`-resolution value for artifacts. Renaming the incoming artifact was rejected: the id is
what the schema author wrote and what the CLI reports, so changing it would make the view disagree
with `openspec status`. Upstream has the same collision (#1456 documents `openspec instructions`
being unable to reach an artifact named `archive`), which is a reason to be tolerant of the input,
not to normalise it away.

### The edge announces that it is derived

The rule proves a bound — the step cannot precede apply, and apply does not need it — but the
diagram would draw an order. Those are not the same claim, and against the 88-schema corpus about
18% of flagged artifacts are misread (see Risks). A derived edge that looks declared would assert
something false in those cases; a derived edge marked as derived states the inference and lets the
reader judge it.

### Ordering is a resolved property with a source, not an inference flag

The format will probably gain a way to declare this (#1456). The design assumes that and is built so
adopting it is a new branch at one seam, not a rework.

Three things carry that:

- **The spec states the property, not the mechanism.** The requirement says post-implementation steps
  are drawn after apply, that a step's ordering relative to implementation is taken from the schema
  where the schema states it, and that only an ordering spek *derived* carries the derived marking.
  It does not require that anything be inferred. When a declaration becomes available the spec needs
  no edit — the same requirement is satisfied by a better source.
- **Edges carry their origin from day one.** Every edge is `declared` or `derived`, decided where the
  edge is produced rather than at the point it is drawn. The view branches on that field, not on "is
  this the apply edge". A declared post-implementation edge therefore renders as an ordinary solid
  connection with no view change at all — the rendering work in this change is the part that does
  *not* need redoing.
- **One resolver owns the question.** A single function answers "what is this step's ordering
  relative to implementation, and where did that come from". Today it has one branch, the closure
  rule. Adding a declared source means adding a branch that returns `declared` and returning early;
  the inference then runs only for steps the schema says nothing about. Precedence is per-step, not
  per-schema, so a schema that declares ordering for one artifact and not another is handled without
  a mode switch.

This mirrors how the repo already treats the schema-name guard, where containment was replaced by
name validation for one path: the property was unchanged and only the mechanism differed. Here the
property is the drawn ordering; today's mechanism is derivation, tomorrow's is declaration.

Two smaller choices follow. `SchemaDefinition` keeps unknown top-level keys out of the way rather
than failing on them, so a schema authored against a newer format still renders — the seam for the
new field is the parse in `schemas.ts`, and it is a field addition rather than a shape change. And
the resolver takes the apply step as a parameter instead of matching on the literal id `"apply"`,
which is what makes the id-collision fix and the forward path the same piece of work.

## Risks / Trade-offs

**The rule misreads two classes of step, and no declared signal separates them** → Precision over
the corpus is ~82% (39 flagged artifacts, ~7 wrong). *Class A*, planning artifacts that happen to
depend on everything apply requires: `ai-solo-workflow`'s `execution-plan` (which plans the
execution and must precede apply), `feature-workflow`'s `work-packages`, `plan-findings`,
`change-context`. *Class B*, schemas that model implementation as an ordinary artifact instead of
through `apply`: `pdca`'s `do`, `openspec-agile-workflow`'s `implementation`. `apply.tracks` and
`generates` look identical across both groups and the genuine cases, so there is no cheap filter.
Mitigated by marking the edge derived rather than asserted, and bounded by where the errors live:
every built-in schema is a no-op, all three flagged artifacts across the official catalog are
correct, and every false-positive source found is a 0–21 star repository.

**This reverses a decision the spec recorded** → The prior requirement forbade inferred edges on the
grounds that they show a constraint absent from `openspec status`. That reasoning is preserved, not
discarded: the replacement forbids any edge *indistinguishable from* a declared one, and the rule
reads no instruction prose. What changed is the evidence that the status quo is not the neutral
option — drawing these steps beside apply asserts an interchangeability wrong in every real case.

**Levels shift for schemas that were rendering acceptably** → `superpowers-bridge` moves `verify` 6→7,
`retrospective` 7→8, archive 8→9. Two existing assertions encode the old placement and change with
it, and both are cited in `tasks.md` so neither is edited without noticing.

**Archive's dependencies move as a side effect** → Once apply has a dependent it is no longer a leaf,
so archive depends on the post-implementation tail alone. This follows from the leaf rule rather
than changing it, but it is the kind of consequence that reads as a regression if it is not stated —
hence its own scenario.

**Upstream may later declare this properly** → Adopting it is a branch in the resolver plus a field
in the parse; the spec, the edge model, and the rendering are unchanged (see Decisions — "Ordering
is a resolved property with a source"). The declaration wins per step, per the standing rule that
spek does not answer questions OpenSpec owns. The residual risk is that #1456 lands a shape the
resolver cannot express — most plausibly ordering declared in `config.yaml` rather than
`schema.yaml`, which would make it a property of the project rather than of the schema, and a
schema detail view has no project to resolve it against. That would need more than a branch, and
nothing in this change can prevent it.

## Migration Plan

No data, storage, or API shape changes; the affected surfaces render from the same responses. The
change is additive on `@spekjs/core` (new exports, no signature changed), so the core line takes a
minor bump recorded at release time. Rollback is reverting the commit — nothing persists.

Verification runs against real published schemas rather than fixtures alone, since the rule is a
claim about what schema authors actually write. Which schemas resolve depends on what the CLI is
configured with, so the artifacts name the *roles* to cover rather than a machine's inventory:
`superpowers-bridge` (in this repo) and `anvil` for genuine post-implementation steps, `superspec`
for an artifact whose id collides with the apply phase, `spec-super` for a known false positive, and
`spec-driven` plus any two other unaffected schemas as no-op controls. All are installable from the
community catalog.
