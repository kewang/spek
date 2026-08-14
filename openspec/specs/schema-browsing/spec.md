## Purpose

Let a reader see the OpenSpec workflow schemas a repo can use — which schemas are available, which
one the repo actually runs on, what steps each schema defines, and what each step is meant to
contain — so that the process behind spek's changes is legible inside spek rather than only inside a
`schema.yaml` buried in an npm install directory.

## Requirements

### Requirement: Schema enumeration for a repo

The system SHALL enumerate the workflow schemas available to a selected repo from **one** source:
the schemas the `openspec` CLI reports, which covers all three resolver locations. Each enumerated
schema SHALL carry its `name`, its `description` (null when the schema declares none), its `source`,
and the number of artifacts it declares (null when the enumeration does not say).

The system SHALL NOT determine from the filesystem that something is a schema, including for the
repo's own `openspec/schemas/`. Everywhere else spek reads `openspec/` content directly, so this
exception needs stating: a schema is not repo content the way a spec is, but configuration for
OpenSpec's own engine, resolved across three directories with precedence and shadowing between them
of which a repo holds one. Deciding from disk that a directory is a schema means answering — with a
parser of our own, against a versioned file format whose commands the CLI still marks
experimental — a question OpenSpec owns, and answering it more leniently than OpenSpec does: a
`schema.yaml` OpenSpec refuses to run was drawn as though it were runnable. It also couples spek to
where those files live, which is OpenSpec's to change.

The cost is accepted deliberately: without the CLI there is no enumeration at all, not even for a
schema sitting in the repo being viewed. That matches how `schemaOrder` already degrades rather than
reimplementing OpenSpec's ordering from disk.

`source` SHALL cover every source the OpenSpec resolver searches — `project` (the repo's own
`openspec/schemas/`), `user` (a machine-global data directory), and `package` (shipped inside the
openspec package) — in that precedence order, an earlier match shadowing a later one of the same
name. A schema whose source is not recognised SHALL be omitted rather than guessed at, so the
recognised set must stay complete: omitting `user` made machine-level schemas vanish from the list
with nothing to explain their absence. Each source SHALL be described to the reader in its own
terms; a machine-level schema SHALL NOT be described as shipped with OpenSpec.

Schemas SHALL be deduplicated by name. A project-local schema and a package schema sharing a name
are not two schemas: the project-local one shadows the package one, so the surviving entry SHALL
have `source: "project"`. (What it shadows is reported by the schema definition, not the
enumeration — see "Schema definition read".)

The enumerated list SHALL be ordered deterministically — the repo's default schema first, then the
remainder by name, A–Z — so that repeated reads of an unchanged repo produce an identical list.

#### Scenario: Package schema enumerated

- **WHEN** a repo is scanned, the `openspec` CLI is available, and it reports a `spec-driven` schema shipped with the package
- **THEN** the enumeration includes an entry named `spec-driven` with `source: "package"` and its description

#### Scenario: Machine-level schema enumerated

- **WHEN** a schema exists in the OpenSpec global data directory and neither the repo nor the package declares one of that name
- **THEN** the enumeration includes it with `source: "user"`, described as defined for this machine rather than shipped with OpenSpec

#### Scenario: Project-local schema enumerated

- **WHEN** a repo contains `openspec/schemas/house-style/schema.yaml` and the CLI reports it
- **THEN** the enumeration includes an entry named `house-style` with `source: "project"`

#### Scenario: A schema directory the CLI does not report is not enumerated

- **WHEN** a repo contains `openspec/schemas/house-style/schema.yaml`, the CLI answers, and its enumeration omits `house-style` — which is what it does when it refuses that schema
- **THEN** the enumeration omits it too, and no definition of it is served
- **AND** the reader sees what `openspec schemas` itself reports, rather than a workflow OpenSpec would decline to run

#### Scenario: Project-local schema shadows a package schema of the same name

- **WHEN** a repo contains `openspec/schemas/spec-driven/schema.yaml` and the package also ships a `spec-driven` schema
- **THEN** the enumeration contains exactly one `spec-driven` entry, with `source: "project"`

#### Scenario: Deterministic order

- **WHEN** a repo's default schema is `spec-driven` and the enumeration also finds `agent-driven` and `house-style`
- **THEN** the list is ordered `spec-driven`, `agent-driven`, `house-style`

#### Scenario: Repo with no schemas

- **WHEN** the `openspec` CLI reports no schemas
- **THEN** the enumeration is an empty list, not an error

### Requirement: Schema definition read

The system SHALL read a single named schema's full definition from its `schema.yaml`, exposing: the
schema `name`, `version`, `description`, resolved `source` and filesystem `path`; an ordered list of
its artifacts, each carrying `id`, `generates` (the output path or glob it produces), `description`,
`requires` (the artifact ids that must exist first), and `instruction` (the schema's full guidance
text for that artifact, as authored); and the apply step, carrying its `requires`, `tracks`, and
`instruction`. The artifact order SHALL be the order declared in `schema.yaml`, which is the
schema's authoritative sequence. The definition SHALL also report its location written in the terms
its own source means — relative to the repo for a project schema, relative to the home directory
for a user one, and stripped of the install prefix for a package one — alongside the absolute path,
because an absolute path is the wrong unit for every source and forces the reader to do the
subtraction. The view SHALL show that form rather than restating the source in prose: the source is
already named as a badge, so a sentence repeating it is redundant. The definition SHALL also report
what this schema shadows, if anything — a project-local schema that takes precedence over a same-named package schema SHALL
carry the shadowed schema's source and path.

Fields absent from a schema SHALL be reported as null (or an empty list for `requires`) rather than
substituted with a default, so that the view never presents invented guidance as if the schema had
authored it.

The path to a schema SHALL be resolved through the `openspec` CLI whatever the schema's source, the
repo's own project-local schemas included. Only OpenSpec knows what shadows what across the three
directories it searches, so locating a schema from the one directory visible here could resolve a
name to a different schema than the one OpenSpec would run.

#### Scenario: Each source's location is written in its own terms

- **WHEN** a project, user, and package schema are each read
- **THEN** their locations read as a repo-relative path, a home-relative path, and a path without its install prefix respectively, with the absolute path still available

#### Scenario: Read a package schema definition

- **WHEN** the `spec-driven` schema is read
- **THEN** the result exposes its four artifacts in the declared order `proposal`, `specs`, `design`, `tasks`, each with its `generates`, `description`, `requires`, and `instruction`, plus an apply step requiring `tasks` and tracking `tasks.md`

#### Scenario: Read a project-local schema definition

- **WHEN** a schema the CLI resolves as `source: "project"` is read
- **THEN** its definition is read from the `schema.yaml` at the directory the CLI reported, under `<repo>/openspec/schemas/<name>/`

#### Scenario: Shadowing reported on the definition

- **WHEN** a project-local `spec-driven` schema shadowing the package schema of the same name is read
- **THEN** its definition reports the shadowed package schema's source and path

#### Scenario: Missing optional fields are null, not invented

- **WHEN** an artifact in a schema declares no `description` and no `requires`
- **THEN** its `description` is null and its `requires` is an empty list

#### Scenario: Unknown schema name

- **WHEN** a definition is requested for a schema name that resolves to no package or project schema
- **THEN** the system reports that the schema was not found rather than returning a partial or fabricated definition

### Requirement: Schema name is validated before use as a path segment

The system SHALL reject any schema name that is not a single safe path segment. A name is taken from
client input and used both as a CLI argument and as a filesystem path segment under
`<repo>/openspec/schemas/`, so a name containing a path separator, a `.` or `..` segment, a null
byte, or a leading `-` SHALL be rejected before any filesystem or process access is attempted. A
rejected name SHALL be reported as not found; it SHALL NOT be passed to the filesystem or the CLI.

#### Scenario: Traversal attempt rejected

- **WHEN** a schema definition is requested for the name `../../etc`
- **THEN** the request is rejected as not found, having read no file and spawned no process

#### Scenario: Ordinary name accepted

- **WHEN** a schema definition is requested for the name `spec-driven`
- **THEN** the name passes validation and resolution proceeds

### Requirement: The repo's default schema is identified

The system SHALL identify the repo's default schema as the value of `schema:` in
`<repo>/openspec/config.yaml`, read directly from disk without invoking the `openspec` CLI, and
SHALL mark that schema in the enumeration and in the schema detail. When `config.yaml` declares no
schema or is absent, no schema SHALL be marked default. The UI SHALL label this state **default**,
matching the `Default schema:` wording the Changes page already uses for the same value — not
"active", which reads as a lifecycle state the schema does not have.

A default schema name that resolves to no enumerated schema SHALL still be reported as the repo's
default schema name, so that a repo pointing at a schema its toolchain cannot resolve is visible as
exactly that rather than silently showing nothing.

#### Scenario: Default schema marked

- **WHEN** `openspec/config.yaml` declares `schema: spec-driven` and `spec-driven` is enumerated
- **THEN** that entry is marked as the repo's default schema, labelled `default`, and sorts first

#### Scenario: No default schema declared

- **WHEN** `openspec/config.yaml` is absent or declares no `schema:`
- **THEN** no enumerated schema is marked default and the list is ordered by name alone

#### Scenario: Default schema does not resolve

- **WHEN** `openspec/config.yaml` declares `schema: retired-workflow` and no such schema is enumerated
- **THEN** the response still reports `retired-workflow` as the default schema name, and the view states that it could not be resolved

### Requirement: Active changes are attributed to their schema

The system SHALL report, for each enumerated schema, the active changes declaring that schema —
identified by the `schema` field already carried on each scanned change — as a count plus the list
of those change slugs. Changes whose schema name matches no enumerated schema SHALL NOT be dropped
silently; they SHALL be reported under an unresolved-schema grouping so that the total is
reconcilable against the changes list.

This attribution SHALL NOT require reading any change's artifacts, and SHALL NOT report how far an
individual change has progressed through its schema's steps.

The same attribution SHALL be reported for a single schema alongside its definition, counted over
the same set of active changes and by the same rule as the list. A detail view needs the count, and
obtaining it by fetching the whole catalog is the expensive direction: the catalog costs a CLI
enumeration, whereas this count is taken from a change scan that needs no subprocess. The two SHALL
NOT disagree — a reader opening a schema from the list sees the number that row showed.

#### Scenario: Usage reported with a schema's definition

- **WHEN** a single schema's definition is requested and two active changes declare it
- **THEN** the response carries that definition together with a usage count of 2 and those two slugs, without enumerating the catalog

#### Scenario: Detail usage agrees with the list

- **WHEN** the same aggregation scope is in effect for both views
- **THEN** the count shown on a schema's detail view equals the count shown for that schema in the list

#### Scenario: Changes counted per schema

- **WHEN** three active changes declare `spec-driven` and one declares `house-style`
- **THEN** the `spec-driven` entry reports a count of 3 with those three slugs, and `house-style` reports a count of 1

#### Scenario: Change declaring an unenumerated schema

- **WHEN** an active change declares `schema: retired-workflow` and no such schema is enumerated
- **THEN** that change is reported under an unresolved-schema grouping rather than omitted

#### Scenario: Schema with no changes

- **WHEN** an enumerated schema is declared by no active change
- **THEN** its count is 0 and its slug list is empty

### Requirement: Degradation when the OpenSpec CLI is unavailable

Because schemas can only be enumerated through the `openspec` CLI, the system SHALL, when the CLI is
unavailable — not installed, exiting non-zero, timing out, or emitting unparsable output — report an
empty enumeration together with the reason, and the view SHALL surface that statement. A CLI failure
SHALL NOT produce an error response, an empty page with no explanation, or a hang.

It SHALL NOT substitute a reading of its own. A schema in the repo being viewed is the one the
system could reach without the CLI, and it is still not reported: serving it would mean answering
from one directory a question OpenSpec answers across three, and vouching for a definition OpenSpec
has not accepted. Empty-and-explained is the honest answer, and the same one `schemaOrder` gives.

The same rule applies to a single schema's definition: when a name cannot be resolved because the
CLI is unavailable, the system SHALL report that specific reason rather than reporting the schema as
nonexistent, and SHALL NOT resolve the name from disk instead.

#### Scenario: CLI absent, nothing enumerated

- **WHEN** the `openspec` CLI is not installed and the repo contains `openspec/schemas/house-style/schema.yaml`
- **THEN** the Schemas page lists nothing and states that schemas could not be enumerated because the OpenSpec CLI is unavailable
- **AND** requesting `house-style`'s definition reports that same reason rather than serving it from disk

#### Scenario: CLI failure is bounded

- **WHEN** the `openspec` CLI hangs while enumerating schemas
- **THEN** the call is abandoned after a bounded timeout and the result is the degraded enumeration, not an indefinite wait

#### Scenario: Package schema detail unavailable is distinguished from not found

- **WHEN** a definition is requested for a package schema while the CLI is unavailable
- **THEN** the reported reason is that the OpenSpec CLI is unavailable, not that the schema does not exist

### Requirement: Schema reads stay off the scan hot path

Reading schemas SHALL happen only when schema information is requested, and SHALL NOT be performed
while scanning changes, building the overview, aggregating worktrees, or reading a change detail.
No directory scan SHALL gain a subprocess spawn as a result of this capability.

Schema enumeration and schema definitions SHALL be cached per repo with a bounded lifetime and a
bounded cache size, so that repeatedly opening the schema views does not spawn the CLI on every
request once a read has produced something worth keeping, and so that installing the CLI (or editing a
schema) is picked up without restarting the server.

A read that could not reach the CLI at all, or whose call was cut short by the CLI's own timeout, SHALL
NOT be cached: it is a statement about the environment at one moment, and the environment is exactly
what a bounded lifetime was never able to observe changing, so the next request reads again. Every
other outcome SHALL be cached, including the degraded ones. A CLI that ran and exited non-zero, or
emitted output that cannot be read, is reporting the installed CLI rather than the moment — a request
a second later finds it identical, and re-asking costs a process start each time on views that refetch
whenever the watched tree changes. A refusal is likewise an answer: a name the CLI reports no schema
for is a fact about the repo.

A definition read SHALL be judged where the distinction survives. Reporting that a schema was not found
is the same value whether the CLI refused the name or the resolved `schema.yaml` could not be read, and
only the second is about the environment — so the read itself SHALL decide, rather than the cache
inferring it from a result that no longer says. What is reported to the caller is unchanged.

The cache SHALL hold the in-flight computation, not only its finished value, so that a caller
arriving while a read is running joins it rather than starting a second one. Two callers racing on
a cold entry compute the same answer either way, so the duplication is invisible in the result and
paid in subprocesses — which is what the cache exists to avoid. This SHALL hold for a read that is about
to fail as well: not remembering a failure must not become not sharing one, or a host without the CLI
pays a spawn per concurrent reader. Sharing bounds only simultaneous readers, though — sequential ones
each pay a read — which is why the rule above turns on whether a second read could differ rather than on
how often the views read. The bounded lifetime SHALL exceed the CLI's own timeout, or an entry
can be judged stale while the call filling it is still running.

#### Scenario: Concurrent cold requests share one CLI run

- **WHEN** two requests for the same uncached schema information arrive while the first is still running
- **THEN** the CLI is spawned once and both requests are answered from that single run

Because a cache can outlive the thing it describes, it SHALL be discarded both when the host
observes a change under the watched `openspec/` tree and when the user requests a refresh. Only one
of the three schema directories is watched — the repo's own — so an edit to a machine-global schema,
or a schema promoted from the repo to that directory, produces no event at all; refresh is the
authoritative way to pick those up, and without invalidation it would report success while serving
the superseded copy.

Watch-driven invalidation SHALL be scoped in two ways, neither of which may delay it past the
refetch it precedes. It SHALL apply only to events that can have changed what a schema read
returns — a file under a schema's own directory, or the repo's `openspec/config.yaml`, which names
the default and so decides which entry is marked default. A watcher admits every `.md` and `.yaml`
under `openspec/`, nearly all of which is change and spec content that no schema read consults, and
invalidating on those re-pays the enumeration for edits that cannot have altered a single field.
It SHALL also apply only to the repo the watcher observes: the caches are process-wide, shared by
every repo a host has open, so an unscoped discard makes an edit in one repo cost another an
enumeration.

Every host that observes file changes SHALL perform this invalidation, not only those whose refresh
command does. A host that notifies its client to refetch without discarding first will serve the
pre-edit copy from a still-live cache entry while reporting the refresh as successful.

#### Scenario: An unrelated edit does not discard the catalog

- **WHEN** a change's `tasks.md` under the watched tree is saved while a client is watching
- **THEN** the cached schema reads are retained, and the refetch that follows spawns no `openspec` process

#### Scenario: One repo's edit does not discard another's cache

- **WHEN** a schema is edited in one watched repo while a second repo's catalog is cached in the same host
- **THEN** only the edited repo's cached reads are discarded, and the second repo's are still served from cache

#### Scenario: Scanning spawns nothing new

- **WHEN** the changes list, the overview, or an aggregated scan runs
- **THEN** no schema enumeration is performed and no `openspec` process is spawned on that path

#### Scenario: Repeated schema requests reuse the cache

- **WHEN** the Schemas page is opened twice within the cache lifetime for the same repo, and the CLI was reached on the first read
- **THEN** the second request is served from cache without spawning the `openspec` CLI again

#### Scenario: A schema edited in the repo is picked up by live reload

- **WHEN** a schema under the repo's `openspec/schemas/` is edited while a client is watching
- **THEN** the cached read is discarded as part of the same notification, so the refetch the client performs returns the edited schema rather than the cached copy

#### Scenario: A schema moved or edited outside the repo is picked up on refresh

- **WHEN** a schema is promoted from the repo to the machine-global directory, or edited there, producing no filesystem event the host observes
- **THEN** a manual refresh discards the cached reads, so the schema's new source and content are shown without waiting for the cache lifetime to elapse

#### Scenario: A later install is picked up by the next read

- **WHEN** the schemas are first read with the `openspec` CLI absent, the CLI is then installed, and the schemas are read again within the cache lifetime
- **THEN** the second read enumerates package schemas rather than serving the degraded result for the rest of the lifetime

#### Scenario: A CLI that answers unusably is not re-asked every request

- **WHEN** the schemas are read while the installed CLI exits non-zero or emits output that cannot be read, and the schemas are read again within the cache lifetime
- **THEN** the second read is served the same degraded enumeration from cache, spawning no further process

#### Scenario: An unknown schema name stays cached

- **WHEN** a definition is requested for a name the CLI reports no schema for, and the same definition is requested again within the cache lifetime
- **THEN** the second request is served from cache without spawning the CLI again, because the CLI answered

#### Scenario: A definition whose file could not be read is re-read

- **WHEN** a definition request resolves a schema but its `schema.yaml` cannot be read, and the same definition is requested again within the cache lifetime
- **THEN** the schema is read again rather than the failure being served for the rest of the lifetime, even though both are reported as the schema not being found

### Requirement: Schemas list view

The system SHALL provide a Schemas view listing every enumerated schema for the selected repo. Each
entry SHALL display the schema name, its description, its source (package, user, or project), its
**artifact** count, and the number of active changes using it — labelled so it is unambiguously a count
of **active** changes, not of all changes. The repo's default schema SHALL be visually distinguished
from the rest. Each entry SHALL link to that schema's detail view.

A schema's **artifact count** is the number of artifacts it declares. Two artifacts that share a
dependency level count separately: both are work, and neither stops being work because the other
could be produced alongside it. The count describes how much a schema asks for, not the shape of its
dependency graph; the diagram on the detail view shows the shape, by drawing a shared level side by
side.

The unit SHALL be **artifact**, which is OpenSpec's own noun for the thing — the `artifacts:` key in
`schema.yaml`, the field in the CLI's enumeration, `planningArtifacts` in its status output. spek is
a viewer of OpenSpec content, so inventing a synonym would make a reader who opens `schema.yaml`
translate our noun back into theirs to check the number against what they see. It is a count of
artifacts, not of *files*: an artifact whose output is a glob produces as many files as the change
needs, which is why the label names artifacts rather than anything file-shaped.

This count SHALL agree with the number of artifacts a change under that schema is shown to have.
Artifact discovery already collapses a non-empty `specs/` into a single artifact, so a change
declaring five delta specs presents one `specs` artifact, not five — the glob multiplies files, not
artifacts, on both views. A count derived any other way would put the schemas page and the change
page on different units, and a reader moving between them would see two numbers for one thing.

Building the list SHALL cost one CLI invocation regardless of how many schemas are installed. No
field on an entry may require reading a schema's definition: doing so would spawn a subprocess per
row, and it would not even prefetch usefully, since definition reads are cached per schema and only
the one the reader opens is ever wanted. The artifact count is compatible with that limit because
the enumeration already names each schema's artifacts — it omits only their `requires`, which the
count does not consult.

When the enumeration is empty **and succeeded**, the view SHALL show an empty state explaining that
no workflow schemas were found, rather than a blank page. When the enumeration is empty because it
degraded, the view SHALL show neither that empty state nor a count of zero: both assert something
about the repo, and a failed enumeration has established nothing about it. The degraded statement is
what the view has to say, and saying "no schemas were found" beneath "schemas could not be listed"
contradicts it. This is the same distinction a single schema's view keeps between "does not exist"
and "could not look" — it applies to the list only because degradation made empty a state the list
can now actually reach.

#### Scenario: Schemas listed

- **WHEN** the Schemas view is opened for a repo with two enumerated schemas
- **THEN** both are listed with name, description, source, artifact count, and change-usage count

#### Scenario: Listing costs one CLI round

- **WHEN** the Schemas view is opened for a repo with a dozen enumerated schemas
- **THEN** the enumeration spawns the `openspec` CLI once, and no schema definition is read to build the list

#### Scenario: Default schema distinguished

- **WHEN** the Schemas view renders and one schema is the repo's default schema
- **THEN** that entry is visually marked `default` and appears first

#### Scenario: Empty state

- **WHEN** the Schemas view is opened for a repo with no enumerated schemas
- **THEN** an empty state explains that no workflow schemas were found

#### Scenario: Empty because degraded says only that

- **WHEN** the Schemas view is opened and the enumeration degraded, so the list is empty and carries a reason
- **THEN** the view states that reason, and shows neither the "no workflow schemas were found" empty state nor a count of zero schemas

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
into a paragraph, and a paragraph nobody reads conveys nothing. The graph SHALL NOT be augmented with edges the CLI does not
enforce: `superpowers-bridge` declares `verify.requires: [plan]` while its own instruction says
verify must run after implementation, enforcing that with a runtime precheck rather than through
the graph, and drawing an inferred `apply → verify` edge would show a constraint that does not
exist in `openspec status`.

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
finished. It SHALL carry no instruction or output, and any guidance shown for it SHALL be
identified as spek's own rather than the schema's. It SHALL be excluded from any count of the
schema's artifacts, which would otherwise be inflated by one for every schema alike.

The apply step SHALL be rendered as a step of the same flow, showing what it requires, what file it
tracks, and its instruction — because when a change becomes implementable is part of the workflow
being explained. It SHALL be levelled from its own `requires` exactly as an artifact is, and SHALL
NOT be forced to the end of the flow: a schema may declare artifacts that come *after*
implementation, and pinning apply last would place them before it. Only when apply requires nothing
the schema declares — leaving no dependency to place it by — SHALL it be placed after every
artifact. Because apply may therefore share a level with an artifact, its distinguishing marker
SHALL be carried by the step itself rather than by the level.

Apply SHALL be excluded from the artifact count, by the same rule that excludes archiving: it
belongs to every schema alike, so counting it adds the same constant everywhere and distinguishes
nothing. It is also the only work a schema declares outside `artifacts:` — the sole top-level keys
any surveyed schema uses are `name`, `version`, `description`, `artifacts`, `apply` and `format`
(parsing configuration, not a step) — so excluding it leaves nothing else uncounted.

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
- **THEN** the diagram draws only the declared edge, placing `verify` by its declared dependency, and adds no inferred edge from the apply step

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

- **WHEN** a schema ends with two steps that feed nothing else, such as `apply` and `retrospective`
- **THEN** the archive step depends on both, not on whichever comes last

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

### Requirement: Navigation between schemas and changes

The schema views SHALL link to the changes that use a schema, and a change's schema badge SHALL link
to that schema's detail view **wherever the badge appears** — the change detail, the changes list,
and the dashboard alike — so that the relationship is traversable in both directions. A view whose
rows are themselves links SHALL keep the badge clickable within the row, and the row SHALL continue
to open its change when activated anywhere else.

The badge SHALL link even when the name resolves to no installed schema. The detail view answers
such a name by stating that no schema of that name was found for the repo, which is the answer a
reader seeing an unfamiliar badge is looking for; suppressing the link would require every view
carrying a badge to enumerate the schemas first, purely to decide whether the link was safe.

#### Scenario: From schema to its changes

- **WHEN** a schema entry reporting 3 active changes is activated on the usage control
- **THEN** the user is taken to those changes

#### Scenario: From a change to its schema

- **WHEN** a change detail displays its schema badge
- **THEN** activating the badge opens that schema's detail view

#### Scenario: Badge is clickable inside a row that is itself a link

- **WHEN** a schema badge is displayed in a changes-list or dashboard row whose whole card opens the
  change
- **THEN** activating the badge opens the schema's detail view, and activating the row anywhere else
  opens the change

#### Scenario: Badge naming an unresolvable schema still links

- **WHEN** a change's schema badge names a schema that does not resolve, and the badge is activated
- **THEN** the schema detail view states that no schema of that name was found for this repo

### Requirement: Surface parity for schema browsing

The web app, the VS Code webview, the IntelliJ tool window, and the static demo SHALL all provide
the schemas list and schema detail views over the same data shape, each through its own host
transport: the web app and IntelliJ over HTTP, VS Code over the extension-host message channel with
the host calling the core module directly, and the demo over data embedded in the page at build
time. The demo's embedded data SHALL be captured at build time so the demo requires no `openspec`
CLI and no filesystem access at view time.

#### Scenario: VS Code renders schemas

- **WHEN** the Schemas view is opened in the VS Code webview
- **THEN** it shows the same schemas, in the same order, as the web app shows for the same repo

#### Scenario: IntelliJ renders schemas

- **WHEN** the Schemas view is opened in the IntelliJ tool window
- **THEN** it shows the same schemas, in the same order, as the web app shows for the same project

#### Scenario: Demo renders schemas without a CLI

- **WHEN** the static demo page is opened on a machine with no `openspec` CLI and no access to the repo
- **THEN** the Schemas views render from the data embedded at build time
