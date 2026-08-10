## ADDED Requirements

### Requirement: An open section's body is inset from its heading

When a folded section is open, its body SHALL be inset from the left edge its heading sits on, and the
section's vertical extent SHALL be marked, so that where a section begins and ends is legible from
position rather than from type size alone. A closed section SHALL carry no such marking, having no
extent to show.

The mark SHALL be perceivable in every theme, at a contrast of at least 3:1 against the background it is
drawn on. This is stated because the obvious material for it is the colour already used for panel
edges, which is tuned to be barely visible — at 1.2:1 in the light theme — and a marking requirement
satisfied by something nobody can see is satisfied in name only.

The heading itself SHALL remain on the same left edge as the content surrounding the section, so that
headings at one level align with each other down the page and the inset reads as depth rather than as
drift.

Insetting SHALL apply only at section boundaries. Depth is therefore bounded by the nesting the fold
rules already permit — a scenario inside a requirement — because the narrowest host this content renders
in is a tool window a few hundred pixels wide, where each additional level of indent is taken from the
line length that makes the text readable in the first place.

#### Scenario: An open requirement's body is inset

- **WHEN** a requirement section is open
- **THEN** its body is inset from the left edge of its heading, and the section's extent is marked

#### Scenario: A closed section shows no extent

- **WHEN** a section is closed
- **THEN** no extent marking is shown for it

#### Scenario: The extent marking is perceivable in every theme

- **WHEN** spec content is rendered with any theme active
- **THEN** the extent marking meets at least 3:1 contrast against the background it is drawn on

#### Scenario: Headings stay aligned across sections

- **WHEN** several requirement sections are rendered, open or closed
- **THEN** each requirement heading sits on the same left edge as the others, regardless of its open state

#### Scenario: A scenario inside a requirement insets once more

- **WHEN** an open scenario section is nested inside an open requirement section
- **THEN** the scenario's body is inset relative to the scenario's heading, in addition to the requirement's own inset

#### Scenario: Insetting does not accumulate outside sections

- **WHEN** content renders that is not inside any folded section
- **THEN** it is not inset
