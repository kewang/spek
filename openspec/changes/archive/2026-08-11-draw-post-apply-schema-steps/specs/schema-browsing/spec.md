## MODIFIED Requirements

### Requirement: Schema detail view renders the workflow as an ordered flow

The system SHALL provide a schema detail view rendering one schema as its workflow. The view SHALL
show the schema's name, description, source, whether it is the repo's default schema, its **artifact**
count, and the number of active changes using it; then its
artifacts as a visually connected sequence, each step showing the artifact id and the file or glob
it generates. A step's description and the ids it requires SHALL be reachable from the step without
being drawn on it — in the detail region described below, and as a pointer tooltip naming its
requirements — because a step carrying four fields is a card, and a column of cards stops reading as
a diagram.

The sequence SHALL be grouped by **dependency level** — a step's level being one past the deepest
artifact it requires — with every step of a level presented together as a peer group, and the
levels connected in ascending order. Steps within a level SHALL keep the schema's declared order.

A level SHALL NOT carry a printed label or number. The rows of the diagram already are the levels,
so a number beside each one restates what the layout shows, and nothing else in the app ever refers
to "level 3" for a reader to match it against. Numbering was added to reconcile the view's count
with the diagram and produced only chrome — leader lines drawn to reattach labels that had
detached — to fix a problem the labels themselves introduced.

This grouping takes precedence over the schema's declared order, and MAY therefore present an
artifact earlier than it is declared: an artifact that requires nothing belongs to the first level
however late it appears in `schema.yaml`. That is deliberate. Declared order is only one
linearisation of the dependency graph, and presenting it as a numbered sequence asserts an ordering
the schema does not impose — in `spec-driven`, `specs` and `design` both require only `proposal`,
so neither precedes the other. Grouping shows the constraint that exists; numbering the list
positionally would show one that does not.

A schema whose `requires` form a cycle has no valid levelling, and SHALL fall back to positional
levels rather than looping or inventing a rank. Each step SHALL be presented in a compact, uniform form carrying only its identity, what it
generates, and what it requires, so that a level of steps reads as a level.

A step's connections SHALL be highlighted when that step is **selected**, and SHALL NOT be
highlighted merely because a pointer is over it. Selection is a decision the rest of the view is
already about; hover is a pointer passing through. Driving the highlight from hover lit the diagram
up and dark again as the cursor crossed it, and left no highlight in place while the reader was
actually reading the selected step. Hover MAY still give a step its own affordance, but SHALL NOT
alter any other step or connection.

The view SHALL state that the connections between steps are the schema's declared `requires` — the
same dependencies the OpenSpec CLI blocks on — and SHALL make available the fact that a step's
instructions may impose ordering the dependency graph does not express. Both MAY be expressed as a
label and its tooltip rather than as running prose; the accumulated caveats on this view had grown
into a paragraph, and a paragraph nobody reads conveys nothing.

Every edge the diagram draws SHALL carry the source it came from — declared by the schema, or
derived by spek — and that source SHALL be decided where the edge is produced rather than by the
step it happens to connect. The diagram MAY draw an edge the schema does not declare **only** where
that edge is visually distinguishable from a declared one and identified as derived, naming what it
was derived from. No derived edge SHALL be drawn in a form a reader could mistake for a dependency
`openspec status` blocks on. An edge the schema *does* declare SHALL be drawn as a declared edge
whatever it connects, so that an ordering the schema states carries no derived marking. This
replaces a blanket prohibition on inferred edges. That prohibition was correct that
an ordinary edge asserts CLI enforcement, but it treated the alternative as neutral, and it is not:
OpenSpec's format cannot express an artifact produced after implementation — an artifact's
`requires` may name only other artifacts — so authors point such an artifact at the last planning
artifact and state the real ordering in prose. Drawing it by its declared dependency alone puts it
on the apply step's own level, asserting an interchangeability with implementation that is wrong in
every real instance, and inviting exactly the mistake those schemas' runtime prechecks exist to
block.

A step's ordering relative to implementation SHALL be taken from the schema wherever the schema
states it, and derived only where the schema does not. This precedence SHALL hold per step, so a
schema stating the ordering for one artifact and not another is served without either being
mishandled. The requirement below is on the ordering that results and on its being marked with the
source it came from — **not** on any particular means of arriving at it. OpenSpec's format cannot
currently express such an ordering, so today every such ordering is derived; a later format that can
express it SHALL be used in preference, and satisfies this requirement without changing it.

Where the ordering is derived, a step SHALL be identified as **post-implementation** when, and only
when, all of the following hold: the schema declares an apply step; at least one id in
`apply.requires` resolves to a declared artifact; the artifact graph is acyclic; the step is outside
the transitive closure of `apply.requires`; and the step's own transitive closure covers every
resolvable id in `apply.requires`. Together these establish that the step cannot become available
before apply does and that apply does not require it. The two guards are not decoration: with no
resolvable requirement the closure test is vacuously true and would identify every artifact, and
under a cycle the levels are already a positional fallback rather than a reading of the graph.

Each post-implementation step SHALL be given a derived dependency on the apply step, so that it is
levelled after implementation rather than beside it. Levelling SHALL continue to use the full
declared `requires`.

**A declared edge SHALL be suppressed only by a path made entirely of declared edges.** The
transitive reduction is information-preserving over facts, and a derived edge is not a fact, so a
derived edge SHALL NOT stand in as an implying hop that removes something the schema states. This
bites on exactly the schemas where the derivation is wrong: a step declaring `requires: [tasks]`
where apply also requires `tasks` would otherwise have that declared edge implied away by
`tasks → apply ⇢ step`, leaving a node whose only incoming connection is derived and captioned as
something the CLI does not enforce, while the dependency it does enforce is drawn nowhere. A derived
edge SHALL still be suppressed by any implying path, declared or derived: spek must not claim what
the drawn graph already entails.

The view SHALL NOT claim more for a derived edge than the derivation supports. The rule establishes
that apply does not require the step and that the step cannot precede apply; it does not establish
that the schema's author intended the step to follow implementation. Two kinds of step satisfy it
without being post-implementation — a planning artifact that happens to depend on everything apply
requires, and a schema that models implementation as an ordinary artifact instead of through
`apply` — and no signal in the declared format separates either from a genuine post-implementation
step. That is why the edge is marked as derived rather than asserted.

Two steps SHALL remain distinct whenever their ids collide. A schema MAY declare an artifact named
`apply`, which is a different step from the apply phase the schema declares under its `apply:` key,
and both SHALL be addressable, connectable, and selectable independently. Identifying a step by its
declared id alone silently discards one of the two and resolves connections to the wrong step.

A step whose output contains a wildcard SHALL NOT carry a separate marker saying so, and the flow
SHALL NOT carry a standing sentence explaining it: a `generates` value such as `specs/**/*.md`
already displays its wildcards, and the detail region states "one file per match" beside the output
of the selected step, which is where it is actionable. The detail view SHALL NOT present a count of the schema's artifacts as a
headline figure: one declared artifact whose output is a glob produces one file per delta a change
needs, so the count is not a count of files and a reader has no way to tell which it is. A figure
that requires a caveat to be read correctly is not reported at all.

Longer content — a step's description and its full `instruction` text — SHALL be revealed on demand
in a **single** detail region, showing at most one step at a time. That region SHALL carry its own
header naming the selected step, its output, and its requirements. It does not sit beneath the step
it describes, so there is nothing adjacent to identify it by; on a narrow viewport it lands below a
diagram the reader may already have scrolled past.

That region SHALL be positioned outside the diagram entirely — beside it where the viewport is wide
enough to hold both, and below it otherwise — rather than within the flow. Instruction text SHALL be
rendered as Markdown through spek's existing Markdown renderer, so that the guidance reads the way
the rest of spek's content does. No step's detail SHALL be open initially: the workflow is what the
view is for, and the guidance is what a reader asks for once they have found the step they care
about. A step declaring no instruction SHALL say so rather than showing an empty region.

Guidance text that explains how to use the view SHALL remain present whether or not a step is
selected. Copy that disappears on selection makes the flow jump under the pointer for no gain, and
it is inconsistent with the rest of the app, where conditional content is decided by the data and
stays stable for the life of the page.

Both alternatives are ruled out for reasons that showed up in use. Expanding detail *inside* a step
defeats the level grouping: the step grows and pushes its peers around, so the flow being read moves
while it is read. Placing the region *within the flow*, after the selected step's level, keeps the
answer beside the question but makes the diagram reflow every time a selection changes — the levels
below the selection shift down by however much instruction text the step happens to declare, which
on `superpowers-bridge`'s `retrospective` is thousands of characters. Keeping the region outside the
diagram means selecting a step changes the position of no step at all.

The diagram SHALL be left at its natural height, with the page's own scrollbar the only one. Pinning
the diagram in place while the prose scrolls past it requires capping it to the viewport, and a
capped region needs a scrollbar of its own to stay reachable — a second scroll region nested in the
page, which appears on any window shorter than the diagram and is the more intrusive of the two
problems. Scaling the diagram to fit the cap instead was tried and abandoned: the SVG derives its
height from its used width, so constraining it vertically means giving it a definite height to
resolve against, which takes a flex chain spanning three components or a hand-computed viewport
`calc` that silently drifts when the legend wraps. That is disproportionate machinery for a
scrollbar.

Archiving SHALL be rendered as the flow's terminal step, and SHALL be visually distinguished from
the artifacts the schema declares. It is a real step — every change, under every schema, ends by being
archived — so omitting it would leave the workflow without its ending. But no schema declares it:
`schema.yaml` carries only `artifacts` and `apply`, and the OpenSpec authority returns no
instruction, requirements, or tracked file for archiving. Drawing it identically to a declared step
would therefore claim schema membership it does not have, so the distinction SHALL be carried in
the diagram itself and named in its legend.

The archive step SHALL depend on every **leaf** — each step nothing else requires — rather than on
the last step alone, because a change becomes archivable only once everything it declares is
finished. A derived dependency counts for this as a declared one does, so a schema whose
post-implementation steps follow apply leaves apply no longer a leaf. It SHALL carry no instruction
or output, and any guidance shown for it SHALL be identified as spek's own rather than the
schema's. It SHALL be excluded from any count of the schema's artifacts, which would otherwise be
inflated by one for every schema alike.

The apply step SHALL be rendered as a step of the same flow, showing what it requires, what file it
tracks, and its instruction — because when a change becomes implementable is part of the workflow
being explained. It SHALL be levelled from its own `requires` exactly as an artifact is, and SHALL
NOT be forced to the end of the flow: a schema may declare artifacts that come *after*
implementation, and pinning apply last would place them before it. Only when apply requires nothing
the schema declares — leaving no dependency to place it by — SHALL it be placed after every
artifact. Apply SHALL be levelled as a full participant in the graph rather than as a step
positioned after the fact, since steps derived to follow it take their own level from its level.
Because apply may still share a level with an artifact, its distinguishing marker SHALL be carried
by the step itself rather than by the level.

Apply SHALL be excluded from the artifact count, by the same rule that excludes archiving: it
belongs to every schema alike, so counting it adds the same constant everywhere and distinguishes
nothing. It is also the only work a schema declares outside `artifacts:` — the sole top-level keys
any surveyed schema uses are `name`, `version`, `description`, `artifacts`, `apply` and `format`
(parsing configuration, not a step) — so excluding it leaves nothing else uncounted. An artifact a
schema happens to name `apply` is a declared artifact and SHALL be counted as one.

Requesting a schema that does not resolve SHALL render a not-found state naming the schema, not a
blank or errored page.

#### Scenario: Artifacts grouped by dependency level

- **WHEN** the detail view renders `spec-driven`
- **THEN** `proposal` forms the first level, `specs` and `design` together form the second as a peer group, `tasks` the third, and the apply step the last

#### Scenario: Selecting a step highlights its connections

- **WHEN** a step is selected
- **THEN** the connections into and out of that step are highlighted, and no others are

#### Scenario: Connections are not highlighted without a selection

- **WHEN** no step is selected, whatever the pointer is over
- **THEN** no connection is highlighted

#### Scenario: Steps sharing a prerequisite share a level

- **WHEN** the detail view renders a schema where `specs` and `design` both require only `proposal`, and `tasks` requires both
- **THEN** `proposal` is level 1, `specs` and `design` share level 2 as a peer group, and `tasks` is level 3, with no level carrying a printed label or number

#### Scenario: An unconstrained artifact declared last is presented first

- **WHEN** a schema declares `proposal`, then `tasks` (requiring `proposal`), then `glossary` (requiring nothing)
- **THEN** `glossary` appears in the first level alongside `proposal`, ahead of `tasks`, despite being declared last

#### Scenario: Declared order decides the order within a level

- **WHEN** a schema declares `design` before `specs` and both require only `proposal`
- **THEN** the second level presents `design` before `specs`

#### Scenario: Dependencies reachable per step

- **WHEN** the detail view renders an artifact declaring `requires: [specs, design]`
- **THEN** connections are drawn from `specs` and `design` into that step, a pointer tooltip on the step names both, and selecting it lists both in its detail region — without either id being drawn on the step itself

#### Scenario: Instructions rendered as Markdown

- **WHEN** a step is selected and its instruction contains Markdown headings, lists, and fenced code blocks
- **THEN** the view renders them through the shared Markdown renderer rather than as raw text

#### Scenario: The meaning of the connections is stated

- **WHEN** the detail view renders a schema
- **THEN** it states that the connections are the declared `requires` that the CLI blocks on, and that a step's instructions may add ordering the graph does not express

#### Scenario: No edge is inferred beyond what the schema declares

- **WHEN** a schema declares `verify.requires: [plan]` while its instruction says verify must follow implementation
- **THEN** the ordering drawn is taken from the declared `requires` graph alone and never from the instruction text, and any connection not itself declared is one the declared graph entails, drawn in the derived form rather than as a declared dependency

#### Scenario: A post-implementation step is placed after apply

- **WHEN** a schema declares `verify` requiring `plan` and `retrospective` requiring `verify`, and its apply step requires only `plan`
- **THEN** apply appears one level after `plan`, `verify` one level after apply, and `retrospective` after `verify` — rather than `verify` sharing apply's level

#### Scenario: A derived edge is distinguishable from a declared one

- **WHEN** the diagram draws the connection from apply into a post-implementation step
- **THEN** that connection is rendered differently from a declared `requires` connection and is identified as derived rather than as a dependency the CLI blocks on

#### Scenario: A derived edge does not suppress a declared one

- **WHEN** `verify` declares `requires: [plan]`, apply requires `plan`, and `verify` is derived to follow apply
- **THEN** `verify` draws both connections — the declared one from `plan` and the derived one from apply — because the only path implying the declared edge runs through a derived hop, which is an inference rather than a fact

#### Scenario: A derived edge implied by another path is not drawn

- **WHEN** `retrospective` declares `requires: [verify]` and both `verify` and `retrospective` follow implementation
- **THEN** only `verify` draws a derived connection from apply, because `retrospective` already reaches apply through `verify` and a second derived edge would state nothing new

#### Scenario: No step is derived when apply has no resolvable requirement

- **WHEN** a schema's apply step requires only ids the schema does not declare
- **THEN** no step is identified as post-implementation, and every artifact keeps the level its declared `requires` give it

#### Scenario: No step is derived when the graph is cyclic

- **WHEN** a schema's `requires` form a cycle, so levels fall back to positional
- **THEN** no step is identified as post-implementation and no derived edge is drawn

#### Scenario: A step apply requires is never derived to follow it

- **WHEN** an artifact is inside the transitive closure of `apply.requires`
- **THEN** it is drawn before apply by its declared dependencies, whatever else it requires

#### Scenario: A step outside apply's closure that can precede it keeps its place

- **WHEN** a schema's apply step requires `proposal`, `specs`, and `verification`, and an artifact outside apply's closure requires only `specs`
- **THEN** that artifact keeps the level its declared `requires` give it and is not derived to follow apply, because its dependencies do not cover everything apply requires

#### Scenario: An artifact named apply stays distinct from the apply step

- **WHEN** a schema declares an artifact whose id is `apply`, alongside the apply step declared under its `apply:` key
- **THEN** both appear as separate steps, each selectable on its own, with connections resolving to the intended one and neither replacing the other

#### Scenario: A pattern-generating step is marked as such

- **WHEN** the detail view renders a schema whose `specs` artifact generates a glob such as `specs/**/*.md`
- **THEN** the step shows that output as declared, with no pattern marker drawn and no artifact count presented; selecting the step states that its output produces one file per match

#### Scenario: No detail is open initially

- **WHEN** the detail view first renders a schema
- **THEN** the flow is shown with no step's instruction text displayed

#### Scenario: Guidance text does not disappear on selection

- **WHEN** a step is selected
- **THEN** the guidance explaining how to use the flow is still shown, unchanged

#### Scenario: Selecting a step moves no step in the diagram

- **WHEN** a step in a level shared with another step is selected
- **THEN** its detail appears outside the diagram, and no step in any level changes size or position

#### Scenario: Detail sits beside the diagram when there is room

- **WHEN** a step is selected on a viewport wide enough for two columns
- **THEN** its detail appears beside the diagram rather than within the flow, and the diagram is unchanged

#### Scenario: Detail sits below the diagram on a narrow viewport

- **WHEN** a step is selected on a viewport too narrow for two columns
- **THEN** its detail appears below the diagram, still outside the flow

#### Scenario: Detail names the step it describes

- **WHEN** a step is selected and its detail region is shown
- **THEN** the region names the step, its output, and its requirements alongside its description and instruction, because it does not sit beneath the step it describes

#### Scenario: The diagram is not given a scroll region of its own

- **WHEN** the detail view renders a schema taller than the viewport
- **THEN** the diagram renders at its natural height and the page's own scrollbar is the only one

#### Scenario: Only one step's detail at a time

- **WHEN** one step is selected and the user then selects a different step
- **THEN** only the newly selected step's detail is shown

#### Scenario: Step with no instruction

- **WHEN** a selected step declares no `instruction`
- **THEN** the detail region states that the schema declares no instructions for that step

#### Scenario: Archiving is the terminal step, marked as not schema-declared

- **WHEN** the detail view renders any schema
- **THEN** an archive step appears after every other step, drawn differently from the declared steps, with the legend naming that difference

#### Scenario: Archiving waits for every leaf

- **WHEN** a schema ends with two steps that feed nothing else, such as an apply step and a `glossary` artifact nothing requires
- **THEN** the archive step depends on both, not on whichever comes last

#### Scenario: Archiving waits for the post-implementation tail

- **WHEN** a schema's `retrospective` is derived to follow `verify`, which is derived to follow apply
- **THEN** the archive step depends on `retrospective` and not also on apply, because apply is no longer a step that nothing else requires

#### Scenario: Artifacts sharing a dependency level are counted separately

- **WHEN** a schema declares 8 artifacts, two of which sit at the same dependency level
- **THEN** it reports 8 artifacts — the shared level changes how the diagram draws them, not how much work the schema asks for

#### Scenario: The count does not depend on the requires graph

- **WHEN** two schemas declare the same number of artifacts, one as a strict chain and one with no `requires` at all
- **THEN** both report the same artifact count

#### Scenario: A glob artifact counts once, on both pages

- **WHEN** a schema declaring 4 artifacts — one of them a glob such as `specs/**/*.md` — is used by a change whose `specs/` holds 5 delta specs
- **THEN** the schema reports 4 artifacts and that change is shown as having 4 artifacts, not 8

#### Scenario: Detail view needs no second request for its counts

- **WHEN** a schema's detail view is opened directly by URL, with nothing cached
- **THEN** it renders its artifact count and its active-change count without requesting the schemas catalog

#### Scenario: Archiving is excluded from the artifact count

- **WHEN** the artifact count is shown for a schema
- **THEN** it counts only the artifacts the schema declares, and the archive step is not among them

#### Scenario: An artifact named apply is counted as an artifact

- **WHEN** a schema declares 9 artifacts, one of them named `apply`, alongside its apply step
- **THEN** it reports 9 artifacts — the declared artifact counts, and the apply step remains excluded

#### Scenario: Archiving shows no schema guidance

- **WHEN** the archive step is selected
- **THEN** the detail states that archiving belongs to OpenSpec rather than to any schema, instead of reporting that this schema declares no instructions for it

#### Scenario: Apply step placed by its dependencies

- **WHEN** the detail view renders a schema whose apply step requires `tasks` and tracks `tasks.md`, and no artifact follows `tasks`
- **THEN** apply appears one level after `tasks`, showing what it requires and that progress is tracked in `tasks.md`

#### Scenario: Artifacts after implementation stay after it

- **WHEN** a schema declares `verify` and `retrospective` following `plan`, and its apply step requires only `plan`
- **THEN** apply appears one level after `plan` and before `retrospective`, rather than at the end of the flow

#### Scenario: Apply with no placeable dependency goes last

- **WHEN** a schema's apply step requires nothing that the schema declares
- **THEN** apply appears after every artifact

#### Scenario: Schema not found

- **WHEN** the detail view is opened for a schema name that does not resolve
- **THEN** a not-found state naming that schema is rendered
