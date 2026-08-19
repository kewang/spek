# ui-package Specification

## Purpose
TBD - created by archiving change extract-ui-package. Update Purpose after archive.
## Requirements
### Requirement: `@spekjs/ui` package exports reusable visualization components

The repository SHALL provide a `@spekjs/ui` package that exports the two OpenSpec visualizations as
reusable React components:

- **`SpecGraph`** — the force-directed graph of spec ↔ change relationships.
- **`ChangeTimeline`** — the Gantt-style timeline of change lifecycles.

These two SHALL remain **distinct visualizations**: the graph shows relationships (no notion of time),
the timeline shows lifecycles on a date axis. One SHALL NOT be substituted for the other.

The package SHALL NOT export the full-page views (Dashboard, SpecList, SpecDetail, ChangeList,
ChangeDetail). Those carry the web application's layout and are not reusable by a host with a
different chrome.

#### Scenario: Host renders the graph

- **WHEN** a host renders `<SpecGraph>` with graph data
- **THEN** the force-directed graph is rendered, with specs and changes as distinct node shapes and
  edges between a change and the specs it touches

#### Scenario: Host renders the timeline

- **WHEN** a host renders `<ChangeTimeline>` with a list of changes
- **THEN** each change is rendered as a horizontal bar on a date axis, spanning its lifecycle

### Requirement: Components are presentational and depend on no host facility

The exported components SHALL be **presentational**: they receive their data through props and report
user intent through callbacks. They SHALL NOT depend on any facility of a particular host.

Specifically, the components SHALL NOT:

- import or use a **router** (`react-router` or otherwise) — navigation SHALL be expressed as
  callbacks (`onSelectChange(slug)` / `onSelectSpec(topic)`), and the components SHALL NOT know the
  shape of any URL;
- import or use an **API adapter, data-fetching hook, or HTTP client** — data SHALL arrive as props;
- import or use a **theme context** — see the colour contract below.

A host SHALL be able to render the components without providing a router, an adapter, or a theme
provider.

**Rationale**: the downstream host is an Electron application with no router, whose data arrives over
IPC, and whose adapter interface is not even signature-compatible with the web's (`folderId` is the
first parameter of every method — it has several repositories open at once).

#### Scenario: Component renders without a router

- **WHEN** a host renders either component outside of any router context
- **THEN** it renders successfully

#### Scenario: Selecting a node reports intent to the host

- **WHEN** the user activates a change in either component
- **THEN** the component invokes the host-supplied callback with that change's slug, and performs no
  navigation itself

#### Scenario: Package declares no router or adapter dependency

- **WHEN** inspecting the package's dependencies
- **THEN** no router package is listed, in any dependency class

### Requirement: The package defines an explicit colour contract

The package SHALL express all of its colours through a documented set of CSS custom properties under
a package-owned prefix, and SHALL ship default values for them. A host SHALL be able to re-theme both
components **solely by overriding those custom properties**.

The contract SHALL be the **only** source of colour the components render. No colour literal — a hex
value, an `rgb()` / `hsl()` value, or a CSS named colour — SHALL appear outside the declaration of the
contract's own defaults. A literal cannot follow a theme it cannot see, and a host that overrides every
property it is given still cannot reach one.

Two values are exempt, and no others. Both are stated here rather than left to whoever writes the check,
because an unstated exemption is how the literals grew in the first place:

- **`transparent`**, which renders nothing and therefore cannot be theme-wrong. It is also structural: a
  tint of a contract colour is expressed as a mix *with* transparent, so forbidding it would forbid the
  mechanism the contract relies on.
- **A shadow's black.** A shadow is the absence of light on whatever lies behind it, not a colour the
  component is choosing, and giving it a contract property would add a member for something no host has
  asked to re-theme.

The components SHALL NOT read CSS custom properties belonging to the host's own design system, and
SHALL NOT require the host to use any particular CSS framework.

**The documentation the package ships SHALL describe the contract as it is**: every member, and what
each one is drawn as. A host can only override the names it is told about, and it maps each name from
what that name is said to colour — so a member the documentation omits is inherited silently at the
package's own default, and a member the documentation describes as something the package no longer
draws with it is mapped to the wrong value on purpose. Neither is visible to any check the package can
run: nothing links the prose to the code. This obligation is met by the documentation that reaches a
consumer of the published package, not only by comments in its source.

**A member whose value is a colour the host owns SHALL say whose it is.** Where the package draws with
the colour of a surface it does not control — the surface a component is mounted on — the contract
cannot supply that colour, only name it, and a host that mounts the component somewhere other than the
assumed surface has to be told which member to point at it.

**Rationale**: the components previously read the web application's Tailwind theme tokens directly
(`--color-border`, `--color-text-primary`, …) and styled themselves with its semantic utility classes.
A host whose tokens are named differently — as the downstream Electron application's are — would
render the graph with no colours at all.

**Rationale for the literal rule**: eleven colour literals grew beside the contract, and most were copies
of a contract value. A copy does not follow what it was copied from: the archived graph node holds
`--spek-text-muted`'s *former* dark default, so when the host re-authored that token the node did not
follow — the token now measures 4.37:1 where the node is drawn and the node stayed at 2.93:1, under the
floor, in the theme nobody thought was affected. Nothing broke it; it stopped tracking.

**Rationale for the documentation obligation**: the release that added the ninth member shipped with
documentation describing eight, and with two of its rows naming colours the components had stopped
drawing with. A host following it overrides everything it is told to and still reproduces the defect the
release fixed — in the light theme only, since the value it silently inherits is the package's dark
default. This is the same failure as the copied literal, one level out: the prose stopped tracking the
contract, and nothing that runs could tell.

#### Scenario: Host overrides the colour contract

- **WHEN** a host defines the package's colour custom properties with its own values
- **THEN** both components render in the host's colours

#### Scenario: Host provides no colours

- **WHEN** a host renders the components without defining any of the package's custom properties
- **THEN** the components render with the package's default colours, not with missing or transparent
  colours

#### Scenario: Package does not require the host's CSS framework

- **WHEN** a host that does not use the same CSS framework renders the components
- **THEN** the components are styled correctly

#### Scenario: No colour is rendered from outside the contract

- **WHEN** any component renders a colour
- **THEN** that colour resolves from a contract custom property
- **AND** no colour literal appears in the package's source outside the declaration of the contract's defaults,
  other than `transparent` and a shadow's black

#### Scenario: A colour the contract cannot express is added to it

- **WHEN** a component needs a colour that no existing contract property expresses
- **THEN** the contract gains a property for it, with a default value
- **AND** the addition is recorded for consumers, because a host that overrides the properties it already
  knows will otherwise take the new default silently

#### Scenario: A host can learn the whole contract from what the package ships

- **WHEN** a host re-themes the components using only the documentation shipped with the published package
- **THEN** it is told about every member of the contract, so no member is left at the package's default
  by omission
- **AND** each member is described as what the components currently draw with it

#### Scenario: A member coloured by the host's own surface says so

- **WHEN** the package draws with the colour of the surface a component is mounted on
- **THEN** the documentation states that the member carries that surface's colour, so a host mounting the
  component on a different surface maps it to that one

### Requirement: Theme changes are signalled by the host, not detected by the package

The graph resolves its colours imperatively (they are written into SVG attributes). It SHALL re-render
when the host signals that the theme has changed, via an explicit prop.

The package SHALL NOT attempt to detect theme changes by observing the host's DOM — a host is not
required to signal a theme change in any particular way.

#### Scenario: Host signals a theme change

- **WHEN** the host changes the value of the theme-signal prop
- **THEN** the graph re-resolves its colours and re-renders

### Requirement: React is a peer dependency

The package SHALL declare `react` and `react-dom` as **peer** dependencies, and SHALL NOT declare them
as direct dependencies — two React instances in one application break hooks at runtime.

`@spekjs/core` SHALL likewise be a peer dependency: the components use its types and, at runtime, its
`graph-node-id` subpath, and the host and the package must agree on one definition of them.

Because that subpath is a runtime import, the declared `@spekjs/core` range SHALL have a floor at the
core version that introduced it. A range that admits an older core resolves a package without the
subpath and fails when the module is loaded — not at install, and not during type checking, where
`skipLibCheck` suppresses the unresolved specifier inside this package's own declaration files.

#### Scenario: Peer dependencies declared

- **WHEN** inspecting the package manifest
- **THEN** `react`, `react-dom` and `@spekjs/core` appear under `peerDependencies` and not under
  `dependencies`

#### Scenario: Core peer floor covers the subpath

- **WHEN** the declared `@spekjs/core` peer range is compared against the core version that introduced
  the `graph-node-id` subpath
- **THEN** the range excludes every core version older than it

### Requirement: The package is published to the npm public registry

`@spekjs/ui` SHALL be published to the npm public registry so that repositories outside this monorepo
can depend on it.

Within this monorepo, `@spekjs/web` SHALL resolve it through npm workspaces rather than from the
registry, so that development is not gated on the package's release cadence.

The package's `dist` SHALL be built when the package is published, and SHALL NOT be built as part of
installing the monorepo's dependencies. A build triggered by install (npm's `prepare` lifecycle) runs
before npm has created the workspace symlinks, so the package's TypeScript build cannot resolve
`@spekjs/core` and fails — taking the whole `npm ci` down with it. Builds that need `dist` (the web
app, the webview bundles, CI) SHALL invoke the package's build explicitly.

#### Scenario: Downstream repository installs the package

- **WHEN** a repository outside this monorepo installs `@spekjs/ui` from the registry
- **THEN** the package resolves and its components can be imported

#### Scenario: In-repo consumer resolves locally

- **WHEN** `@spekjs/web` is built within this monorepo
- **THEN** it uses the local `packages/ui` sources, not a registry copy

#### Scenario: Installing from a clean checkout

- **WHEN** `npm ci` runs in a checkout with no existing `node_modules` (a CI runner)
- **THEN** the install completes without attempting to build `@spekjs/ui`

#### Scenario: Publishing the package

- **WHEN** the package is published to the registry
- **THEN** `dist` is built as part of publishing, so the published tarball carries the compiled output

### Requirement: `@spekjs/web` consumes the package with no change in behaviour

`@spekjs/web` SHALL render its graph and timeline pages using the components from `@spekjs/ui`.
Those pages SHALL retain their current behaviour and appearance — the extraction is not an occasion to
change what the user sees.

The pages SHALL retain everything that is the host's own concern: data fetching, loading and error
states, routing, the theme toggle, and the page chrome.

All of the web application's build targets SHALL continue to build, and the timeline's existing unit
tests SHALL continue to pass after moving with the code they test.

#### Scenario: Graph page behaves as before

- **WHEN** the user opens the graph page
- **THEN** it behaves as it did before the extraction, including zoom, pan, node dragging, neighbour
  highlighting, and navigating to a change by activating its node

#### Scenario: Timeline page behaves as before

- **WHEN** the user opens the timeline page
- **THEN** it behaves as it did before the extraction, including grouping by topic, hiding active or
  archived changes, the tooltip, and navigating to a change

#### Scenario: All build targets still build

- **WHEN** each of the web application's build targets is built
- **THEN** every one of them succeeds

#### Scenario: Timeline unit tests travel with the code

- **WHEN** the timeline's lane-building and scale logic move into the package
- **THEN** their existing unit tests move with them and pass there

### Requirement: Graph change node ids are interpreted in one place

Graph change node ids SHALL be resolved to a change slug by **one** function, owned by `@spekjs/core` —
the package that produces the format — and consumed from there by every component and exported helper in
`@spekjs/ui` that needs a slug, today `SpecGraph` and the timeline's `changeTopicsMap`. The behaviour of
that function is specified by the `core-module` capability and is not restated here.

`@spekjs/ui` SHALL continue to export `changeNodeSlug` from its entry point, re-exporting core's
implementation, so that hosts which adopted it when it was ui's own keep working.

`@spekjs/ui` SHALL NOT carry its own copy of the parsing.

**Rationale**: ui's two consumers previously disagreed with each other, which was fixed by extracting a
shared helper into ui. That left the deeper split in place: core writes the format and ui reads it, so the
two packages can still drift — which is how the original defect arose. A host needing the same parsing
outside a bundler could not reach ui's copy either, since the package's only entry point pulls in React
and d3, and was about to reimplement it.

#### Scenario: Both consumers agree

- **WHEN** the same aggregated graph is passed to `SpecGraph` and to `changeTopicsMap`
- **THEN** both resolve a given change node to the same slug, through core's function

#### Scenario: Existing consumers keep working

- **WHEN** a host that imports `changeNodeSlug` from `@spekjs/ui` upgrades
- **THEN** the import still resolves and behaves identically

#### Scenario: No second implementation

- **WHEN** the package's sources are inspected
- **THEN** the parsing appears once, as a re-export of core's function, and is not reimplemented

### Requirement: The published package is loadable by Node ESM

`@spekjs/ui` declares `"type": "module"`, so its published output SHALL satisfy Node's ESM resolver:
every relative specifier it emits SHALL carry a file extension. Importing the package SHALL work in
plain Node, not only through a bundler.

The repository SHALL carry an automated guard that fails when a source file reintroduces an
extensionless relative specifier — a build-time check from the compiler, or a test. A guard is required
rather than optional: every consumer in this repository resolves through a bundler, which tolerates the
omission, so a regression would otherwise reach the registry unnoticed.

**Rationale**: all three published versions emit `from "./SpecGraph"`, which Node rejects.
Nothing failed, because every consumer bundled — it was found only when a host tried to import the
package from a Node process.

#### Scenario: Importing from plain Node

- **WHEN** the published package is imported from a Node ESM context
- **THEN** it resolves, rather than failing with `ERR_MODULE_NOT_FOUND` on an internal specifier

#### Scenario: A new file omits an extension

- **WHEN** a source file adds a relative import with no file extension
- **THEN** the guard fails, before the package can be published

### Requirement: The package's defaults are legible on the package's own surfaces

A host that overrides nothing is the only case the package can judge on its own, and it SHALL judge it:
every default value SHALL meet, against the default background it is drawn on, the contrast floor for
what it carries — 4.5:1 where it is text, 3:1 where it is a graphical object that is the only carrier of
its information.

A default SHALL be measured at **every** strength the components draw it at, not at one nominal strength
per member. A member is not used one way: the same default fills a node at partial opacity, strokes an
edge at partial opacity, and sets a label at full strength, and each of those answers to its own floor.
Measuring one strength and calling the member checked is a guard whose passing means nothing about the
uses it did not measure — the strength that happens to be measured today is the stricter one in both
places it is wrong, so the table passes while a re-authored default could take a use it never looks at
below its floor.

The package SHALL NOT attempt to verify contrast for a themed host. Ratios require values, and under the
contract those belong to the host; the host is where they are measured.

#### Scenario: Defaults are measured against the package's own surfaces

- **WHEN** the package's default colour values are checked
- **THEN** each meets the floor for what it carries against the package's own default background

#### Scenario: A default drawn at more than one strength is measured at each

- **WHEN** a contract member is drawn at more than one opacity across the components
- **THEN** its default is measured at each of those opacities, against the floor that use answers to

#### Scenario: Contrast for a host's values is not the package's claim

- **WHEN** a host overrides the contract with its own values
- **THEN** whether those values meet the floor is verified by the host, not by the package

### Requirement: A graph label stays legible whichever node the simulation drifts over it

A node label SHALL remain readable against whatever the force simulation puts behind it. A label sits
below its own node and never on it, but nodes collide, and against a node's fill a label measures
1.06–1.84:1 in either theme — so the label carries the colour of the surface the graph is mounted on
behind its glyphs, and is read against that surface whatever it happens to overlap.

That protection SHALL hold for every overlapping pair, in both directions. It is delivered by paint
order and by nothing else, so a label SHALL be drawn above **every** node rather than above the nodes
that happen to be drawn before it: a label nested inside its own node's group is covered — glyphs and
protection together — by any node drawn after it, which is half of the collisions the protection exists
for and the half no measurement of the colours can reveal.

Making the labels reachable in paint order SHALL NOT make them reachable to the pointer: they take no
pointer events, and hover and drag continue to be answered by the nodes.

**Nor SHALL it change what a reader sees in any state the graph already defines.** A label follows its
node's emphasis exactly as before — including the hover de-emphasis, which the capability defining the
graph states as an exemption claimed against a measurement, and which it records as having been chosen
over dimming the graphics while leaving the labels at full strength. Whether a label is drawn inside its
node or above every node is a fact about paint order and nothing else; a state that reached the label
through its node must be applied to it directly once it no longer is.

#### Scenario: A label overlapped by a later-drawn node stays readable

- **WHEN** the simulation places a node over another node's label, in either drawing order
- **THEN** the label and the surface colour behind its glyphs are drawn above that node, so the label is
  read against the mounted surface rather than against the node's fill

#### Scenario: Labels do not intercept pointer interaction

- **WHEN** the reader hovers or drags where a label overlaps a node
- **THEN** the node answers the interaction, not the label

#### Scenario: A de-emphasised node's label is de-emphasised with it

- **WHEN** the graph de-emphasises the nodes that are not part of a reader-caused emphasis state
- **THEN** each of those nodes' labels is de-emphasised to the same degree, and returns to full strength
  with them when the state ends

