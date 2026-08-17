## Context

v1.14.0 landed three fixes. A review of that release found ten defects; the proposal groups them into
four. Three of the four are mechanical — stale prose, a missing scan pattern, a paint order. The first
is not: it revisits a rule this repo wrote down deliberately, twice, and the design work is in changing
it without losing what it was protecting.

That rule is stated in two places at two scopes. `core-module` states the general one: a failure the
next read could find gone is dropped; a failure the *installed CLI* produced (`cli-failed` /
`cli-unparsable`) is retained, because re-asking costs a process start to be told the same thing.
`custom-schema-artifacts` states schema-order's exception: **every** unsuccessful consultation is
dropped, because the cache key names a schema while the query names a change, so one change's refusal
is not the bucket's to keep.

The exception's reasoning is right and its remedy overshoots. "Not the bucket's to keep" argues for
keeping it somewhere else, and dropping it entirely is what costs an environment where the CLI answers
nothing — an installation too old for `status --change --json` — a ~0.65–1.3s process start on every
change-detail read and every watcher-driven refetch, forever.

One fact bounds how much this is worth: **archived changes never reach the provider**
(`scanner.ts:288` consults it only for active ones), so the repeated-spawn cost is not paid by ordinary
archive browsing. It is paid by a broken or too-old CLI, which is exactly the case the memo has to fix
and the only one it has to fix.

## Goals / Non-Goals

**Goals:**

- A settled refusal is remembered *somewhere*, without the bucket keeping an answer that is not its own.
- The Kotlin schema-order reader classifies the CLI's output the way the TypeScript one does.
- A host of `@spekjs/ui` can learn the contract's full membership, and what each member is drawn as,
  from what the package ships.
- A graph label stays legible whichever node the simulation drifts over it.
- Each of the two contrast guards can see every mechanism its own package uses to put colour on screen.

**Non-Goals:**

- Re-opening `core-module`'s general rule. It is unchanged; only schema-order's exception to it moves.
- Adding a tenth member to the colour contract (see Decisions).
- Version bumps and CHANGELOG entries for either npm line — release-time work.
- The `specs[].path` absolute-path leak, and PR #48. Both are separate and out of scope.

## Decisions

### 1. A settled refusal is remembered against the change, and only ever replaces a spawn

A second, small memo keyed by the change records that the authority settled against it. It holds no
value beyond the fact, and shares the cache's TTL and size cap. It sits **between the bucket and the
spawn**, in this order:

1. The schema bucket holds a current answer → serve it, exactly as today. A settled change is **not**
   denied its schema's order.
2. Otherwise, a live mark for this change → return null, consulting nothing and installing nothing.
3. Otherwise → consult the authority.

*Why the bucket is checked first, and why this order is the whole decision.* The order is a property of
the **schema**, which is the premise the requirement opens with. Today a refused change is served a
sibling's answer for free: its own failure deleted the bucket entry, the sibling's success refilled it,
and the refused change's next read is a plain cache hit that maps those refs onto its own artifacts —
zero spawns, correct order. A memo consulted ahead of the bucket would take that away and hand back
null instead, which is a regression dressed as a fix. The memo exists to replace a **spawn**, never an
answer.

*Why not simply drop the exception and remember in the bucket?* That is the bug the exception exists to
prevent: one change's refusal would deny the order to every other change sharing its schema for the rest
of the window.

*Why not record the refusing slug inside the bucket entry?* A bucket holds one entry, so it remembers
only the most recent refusal. With a wholly broken CLI and changes A and B alternating, each read finds
the other's refusal and consults again — the per-read spawn survives, which is the whole point of the
change.

*Why is the mark read outside `ttlCached` rather than as an early return inside its `compute`?* Because
inside, a concurrent read of a **different** change joins the in-flight bucket entry and inherits a
refusal that was never about it — and it inherits it from a run that never spawned, so there is nothing
to share. This is settled precedent: the Kotlin unsafe-slug allowlist sits outside `getOrCompute` for
exactly this reason, and `custom-schema-artifacts` already requires that an outcome decided without
consulting the authority be settled before the cache is reached. Reading the memo needs a **non-installing**
look at the bucket first, which is a small addition beside `ttlCached` rather than a change to it.

*Where the mark is written is the mirror of that, and the opposite answer.* It SHALL be written **inside**
`compute`, which is the only place that holds both the failure's reason and the slug the argv actually
named. Written by whoever awaits the provider, a reader for change Y that legitimately joined an
in-flight run about change X would receive X's null and mark **Y** as settled — a settlement that was
never about Y, held for the whole window. That is strictly worse than the early return this decision
rejects, and it is reachable from the same misunderstanding.

*What this costs.* A settled change consults the authority once per window instead of once per read.
While no answer exists for its schema it falls back to narrative order, which is what it already got.
Nothing it is served today is taken away.

### 1a. The mark is invalidated wherever the schema-order cache already is

`intellij-embedded-server` requires resync to clear the schema-order cache and that "a manual Refresh
SHALL NOT invalidate less than an automatic one does". A mark that survives `SchemaOrder.clearCache()`
makes both false for a settled change, so it is cleared there — which is also the seam `SpekCaches`
already drives from both the resync route and the file watcher, and the seam the Kotlin tests reset
between cases.

The TypeScript side has **no** schema-order invalidation seam at all: the bucket is bounded only by its
TTL, and Web / VS Code resync clears the git-timestamp cache and nothing else. So a mark there is held
for the same window an answer already is, which is consistent rather than a new hole — but it does have
a cost worth stating: a change being written while the reader watches can draw a non-zero exit from a
half-written state, and that settlement now stands for up to the TTL where today the next watcher-driven
refetch would retry it. Bounded, symmetric with how an answer already behaves on that host, and the
alternative — a third, shorter lifetime for marks — buys 30 seconds at the price of a duration nobody
can derive. Adding an invalidation seam to the TypeScript core is a separate change; this one records
the gap rather than inventing half of it.

### 2. What counts as settled is `isTransient`, not a second taxonomy

`cli-unavailable` / `cli-timeout` are still forgotten with nothing recorded — a host that repairs itself
must serve the order on the next read, and that is the requirement `core-module` states. Everything else
is the installed CLI answering, and is marked. Reusing the existing predicate is the point: a reason
added later is already required to be placed on one side of it, and this gives that placement one more
consequence rather than a second rule to keep in step.

*One imprecision is accepted knowingly.* Of the two settled reasons, only `cli-failed` is plausibly
about the change — the exception's own justification is "a non-zero exit is typically the CLI refusing
*this* slug". `cli-unparsable` is a property of the installation (a wrapper printing a banner over the
JSON), identical for every change, and a repo-scoped mark would cost one consultation per window where a
per-change mark costs one per change. Marking both per change is deliberate: a second scope is a second
lifetime and a second invalidation site for a case that differs only in how many spawns a broken
installation gets, and `isTransient` is the rule this repo already requires a new reason to be placed
against. If a repo-scoped mark is ever wanted, it is `cli-unparsable` alone that moves.

### 3. Kotlin splits "is this readable at all" from "what does it say"

The divergence is not a missing branch, it is a function doing two jobs. TypeScript parses JSON in the
runner — an exit-0 run whose stdout will not parse is `cli-unparsable` and never reaches the extractor —
so `parseOrderFromStatus` only ever maps fields, and a null from it means one thing. Kotlin's
`parseOrderFromStatus` takes the raw string and swallows both failures into the same null, and its
caller reads that null as an answer.

So the fix mirrors the boundary rather than special-casing the symptom: JSON parsing is separated from
order extraction, an unreadable body is a failure, and a readable body with no order is an answer. The
per-change mark of decision 1 is mirrored here too, since `intellij-embedded-server` already requires
the Kotlin implementation to follow the same caching rules.

**The seam is `parseToJsonElement` alone, and this is the part that is easy to get wrong.** Kotlin's
current line is `json.parseToJsonElement(text).jsonObject` — two failures in one expression. TypeScript's
boundary is `JSON.parse` and nothing more, so a body of `null`, `42`, `"str"` or `[1,2]` parses, reaches
the extractor, yields no order, and is an **answer**. If the Kotlin split treats a failed `.jsonObject`
cast as unreadable, those four bodies become failures on one side and answers on the other — the same
class of divergence this decision exists to close, and it would fail the scenario written for it.

**A reason has to be constructed on the Kotlin side, because nothing produces one there.**
`OpenspecCli.Outcome` is deliberately raw (`Completed` / `TimedOut` / `StartFailed`) and the schema-order
caller never touches `SchemaDegradedReason`, so `isTransient` — which exists — has no caller to apply it.
Mirroring decision 2 means mapping the outcome to a reason first: `StartFailed → CLI_UNAVAILABLE`,
`TimedOut → CLI_TIMEOUT`, `Completed` with a non-zero exit → `CLI_FAILED`, `Completed` at exit 0 with an
unreadable body → `CLI_UNPARSABLE`. Without that step the two sides agree by coincidence rather than by
the same rule.

### 4. `--spek-bg-primary` is documented, not replaced by a new contract member

The halo needs the colour of whatever surface the graph is mounted on, and it uses `--spek-bg-primary`.
That is an assumption about the host, and the honest fix is to say so in the contract's documentation:
this member means *the surface the graph sits on*, and a host mounting the graph on a secondary panel
maps it to that panel's colour.

*Why not add `--spek-graph-surface`?* Adding a contract member is the one change existing hosts do not
inherit — a host overrides the names it knows, so a new one silently takes the package's dark default.
That is the reasoning `ui-package` already records for keeping the contract at nine, and a tenth member
introduced to describe a surface hosts already map would fail exactly that way. Documenting an existing
member costs a host nothing and is checkable by reading the package.

*Why not make the halo colour a prop?* It is not a colour literal, so the contract permits it, but it
adds host-facing API for something every host answers the same way. Reconsider only if a host reports
that mapping `--spek-bg-primary` to its graph panel breaks something else — nothing else in the package
draws with it.

### 5. Labels move to their own layer

Paint order is the only thing that decides which of two overlapping labels survives, and today each
label is a child of its own node's `<g>`. A single labels layer appended after the nodes layer puts
every label above every node, which is what the halo was added to guarantee. The tick handler positions
two selections instead of one, and labels keep `pointer-events: none`, so pointer interaction is
unchanged.

**Hover dimming is not unchanged, and moving the labels without moving it is a silent spec violation.**
The dim is written as `nodeSel.attr("opacity", …)`, i.e. onto the group that *contains* the label today,
so lifting the label out leaves every non-connected label at full strength while its node drops to 0.1.
`graph-view` requires all non-connected nodes to reduce to 0.1, and it records "dimming the graphics
while leaving every label at full strength" as an option that was **considered and rejected** in favour
of the stated exemption. This change has no `graph-view` delta and no intention of reopening that
judgement, so the labels selection carries the same opacity in both handlers, and the refactor is
required to be invisible to the reader.

*Why not enlarge the halo, or sort nodes so labels win?* Neither addresses it: the halo is already the
right mechanism and is simply painted over, and there is no node order in which every label is above
every other node.

### 6. Each token is measured at every alpha it is drawn at

This concerns **the package's** table only. `@spekjs/ui`'s `CARRIES` pairs each member with a single
nominal alpha, and is wrong in a direction that happens not to fail today: `--spek-text-muted` is
declared at full strength and drawn at 0.85 (every edge, every archived node fill), `--spek-accent` is
declared at 0.85 and also drawn at full strength for the timeline's *today* label. A member therefore
carries a **list** of the strengths it is drawn at, each with the floor that use answers to — a full-strength
`accent` answering to 4.5:1 as text, not to the 3:1 its 0.85 node fill answers to.

The web host's table is already this shape and is the model to copy, not a second thing to fix: its rows
are `(token, alpha, floor)` and it already carries `accent` at both 0.85 and full strength, and
`text-muted` at both. Today's figures pass either way on both sides (worst cases: `text-muted` at 0.85
is 4.37:1 on `bg-tertiary`, `accent` at full strength 7.85:1); it is the next re-authoring of a default
that the package's current table would wave through.

### 7. A decorative border is excluded by name, not re-coloured

Widening the web scan to `border-<token>/<alpha>` surfaces **five** occurrences, not one: the jj conflict
badge's `border-status-warning/40` and four `border-accent/40` (the default-schema badge, the timeline
page, the schema flow legend, and a second badge on the changes list). The one that motivated it is the
conflict badge, at 1.77:1 light / 2.63:1 dark — quoted against `bg-tertiary`, the worst of the theme's
three surfaces, which is the term this repo measures in. Its text carries the meaning, so under
`theme-toggle`'s own rule it is decoration and owes nothing — the defect is that the guard could not see
it either way. It is declared as an exclusion with that reason stated, rather than re-coloured to clear
a floor it does not answer to; raising its alpha would make a hairline compete with the text it frames.
The next border alpha that *is* the sole carrier of its information now has to be declared one way or
the other.

### 8. The comment-language fix starts at `openspec/config.yaml`

The Chinese comments are not an oversight. `openspec/config.yaml`'s `context` block states
"Conventions: 程式碼英文，註解與文件繁體中文", and that block is fed to every agent that asks the CLI for
artifact instructions — it contradicts `CLAUDE.md` and it wins in the moment of writing. Correcting the
line is the fix; translating the comments it already produced is the cleanup.

## Risks / Trade-offs

- **A second memo is a second place a stale refusal can live** → same TTL, same size cap, stated beside
  the bucket it complements rather than in a new module, so the two cannot drift on lifetime; cleared on
  the seam the schema-order cache is already cleared on, where a host has one (decision 1a).
- **A settlement drawn from a change mid-write stands for the window on Web / VS Code** (decision 1a) →
  accepted and stated: those hosts already hold an *answer* for the same window, so this is symmetric,
  and the escape hatch — a schema-order invalidation seam in the TypeScript core — is a change of its own
  rather than half of this one.
- **The verification of the label fix cannot be a rendering test** → the repo has no DOM environment in
  any package, and `packages/ui`'s only suite parses source text. The assertable part is the drawing
  order in the source; the geometry is verified by looking at the real graph, which the tasks say
  explicitly rather than implying a test that cannot exist.
- **Widening the web scan may surface call sites beyond the one found** → each is resolved the same way:
  measured and declared, or excluded with its reason. A silent pass is the only outcome not allowed.
- **Moving labels to their own layer touches the tick handler**, the one place the graph's per-frame
  cost lives → the added work is one more selection's transform per tick, no new measurement or layout.
- **Two published packages change in one change** → their version lines and CHANGELOGs are decided at
  release time; this change records in the proposal's Impact what the release will need to say.
- **The Kotlin fix has no shared fixture with TypeScript**, unlike the task parser → the two are aligned
  by convention, so the scenarios are written to be satisfiable identically on both sides and each
  suite asserts its own.
