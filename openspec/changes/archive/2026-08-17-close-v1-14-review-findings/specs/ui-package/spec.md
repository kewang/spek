## MODIFIED Requirements

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

## ADDED Requirements

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
