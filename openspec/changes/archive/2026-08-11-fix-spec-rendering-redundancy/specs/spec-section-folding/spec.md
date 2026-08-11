## MODIFIED Requirements

### Requirement: An open section's body is inset from its heading

When a folded section is open, its body SHALL be inset from the left edge its heading sits on, and the
section's vertical extent SHALL be marked, so that where a section begins and ends is legible from
position rather than from type size alone. A closed section SHALL carry no such marking, having no
extent to show.

The mark SHALL end where the section ends. Sections that are siblings SHALL be separated so that one
section's mark cannot meet the next one's: two marks that touch draw a single line spanning both
sections, which asserts that everything under it is one section — the opposite of what the mark is for,
and worse than no mark at all. The separation SHALL come from the section itself, not from the spacing
of the heading inside it, because that heading's leading space falls inside the section's own extent.

Opening or closing a section SHALL NOT change the spacing between the sections around it. A page that
shifts as a reader expands a scenario costs more than the marking returns.

Only the outermost open section SHALL draw a mark. A section nested inside another open section SHALL
still be inset — depth continues to read from position — but SHALL NOT draw a second mark of its own: two
marks of equal weight running in parallel read as one ornament repeated rather than as two nested
brackets, and the nested section's extent is already bounded by the mark enclosing it. This condition is
about nesting, not about a particular heading level, because which levels fold is given to the renderer
by its caller.

The mark SHALL be perceivable in every theme, at a contrast of at least 3:1 against the background it is
drawn on. This is stated because the obvious material for it is the colour already used for panel
edges, which is tuned to be barely visible — at 1.2:1 in the light theme — and a marking requirement
satisfied by something nobody can see is satisfied in name only. Restricting the mark to the outermost
section keeps this to a single measured value: a fainter mark for nested sections would need its own
pair of per-theme values, and would reopen a contrast question in order to draw the duplication this
requirement removes.

The heading itself SHALL remain on the left edge of the section rather than moving with its body, so
that headings at one level align with each other down the page and the inset reads as depth rather than
as drift. It MAY be offset from that edge by no more than the width of its own disclosure marker, so
that the marker is not drawn against the mark — a mark that touches the control beside it reads as part
of the control. Any such offset SHALL be the same whether the section is open or closed, or the headings
of open and closed sections stop aligning with each other, which the default state — requirements open,
scenarios closed — puts on screen immediately.

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

#### Scenario: Consecutive open sections do not share one mark

- **WHEN** two open requirement sections follow one another
- **THEN** the first section's mark ends before the second section's mark begins, with visible separation between them

#### Scenario: Toggling a section does not move the sections around it

- **WHEN** a scenario section inside a requirement is opened and then closed
- **THEN** the spacing between the requirement sections around it is the same throughout

#### Scenario: A nested open section draws no mark of its own

- **WHEN** an open scenario section is nested inside an open requirement section
- **THEN** the scenario's body is inset relative to the scenario's heading, in addition to the requirement's own inset
- **AND** only the requirement's extent is marked

#### Scenario: The extent marking is perceivable in every theme

- **WHEN** spec content is rendered with any theme active
- **THEN** the extent marking meets at least 3:1 contrast against the background it is drawn on

#### Scenario: Headings stay aligned across sections

- **WHEN** several requirement sections are rendered, open or closed
- **THEN** each requirement heading sits on the same left edge as the others, regardless of its open state

#### Scenario: The disclosure marker is not drawn against the mark

- **WHEN** an open section is rendered
- **THEN** its disclosure marker is separated from the extent mark rather than touching it
- **AND** a closed section's marker sits on the same left edge as an open one's

#### Scenario: Insetting does not accumulate outside sections

- **WHEN** content renders that is not inside any folded section
- **THEN** it is not inset
