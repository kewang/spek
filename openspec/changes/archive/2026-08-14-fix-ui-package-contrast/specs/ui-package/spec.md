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

**Rationale**: the components previously read the web application's Tailwind theme tokens directly
(`--color-border`, `--color-text-primary`, …) and styled themselves with its semantic utility classes.
A host whose tokens are named differently — as the downstream Electron application's are — would
render the graph with no colours at all.

**Rationale for the literal rule**: eleven colour literals grew beside the contract, and most were copies
of a contract value. A copy does not follow what it was copied from: the archived graph node holds
`--spek-text-muted`'s *former* dark default, so when the host re-authored that token the node did not
follow — the token now measures 4.37:1 where the node is drawn and the node stayed at 2.93:1, under the
floor, in the theme nobody thought was affected. Nothing broke it; it stopped tracking.

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

## ADDED Requirements

### Requirement: The package's defaults are legible on the package's own surfaces

A host that overrides nothing is the only case the package can judge on its own, and it SHALL judge it:
every default value SHALL meet, against the default background it is drawn on, the contrast floor for
what it carries — 4.5:1 where it is text, 3:1 where it is a graphical object that is the only carrier of
its information.

The package SHALL NOT attempt to verify contrast for a themed host. Ratios require values, and under the
contract those belong to the host; the host is where they are measured.

#### Scenario: Defaults are measured against the package's own surfaces

- **WHEN** the package's default colour values are checked
- **THEN** each meets the floor for what it carries against the package's own default background

#### Scenario: Contrast for a host's values is not the package's claim

- **WHEN** a host overrides the contract with its own values
- **THEN** whether those values meet the floor is verified by the host, not by the package
