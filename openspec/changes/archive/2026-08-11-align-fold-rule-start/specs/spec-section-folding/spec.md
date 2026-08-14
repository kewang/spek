## MODIFIED Requirements

### Requirement: An open section's body is inset from its heading

When a folded section is open, its body SHALL be inset from the left edge its heading sits on, and the
section's vertical extent SHALL be marked, so that where a section begins and ends is legible from
position rather than from type size alone. A closed section SHALL carry no such marking, having no
extent to show.

The mark SHALL begin at the top of its section heading's first line and SHALL end at the bottom of the
section's last content. Neither end is the section's box. A box holds two spaces the content does not:
the space above the heading, and the trailing space below the last paragraph or list. A mark drawn to
the box therefore overstates what it encloses at both ends — at the top it begins before the section
reads as beginning, and since that space is also what holds the section apart from the one before it,
spends the separation on the very thing the separation exists to interrupt; at the bottom it runs on
past the last thing it contains, so the mark and the content it marks disagree about where the section
stopped.

Sections that are siblings SHALL be separated, and no mark SHALL be drawn in the separation. Two marks
that touch draw a single line spanning both sections, which asserts that everything under it is one
section — the opposite of what the mark is for, and worse than no mark at all. This is stated as a
requirement on what is drawn rather than on distance, because a separation that exists but is mostly
filled by the following section's mark is the same defect at a smaller scale, and satisfies any wording
that only asks the two marks not to meet. The separation SHALL come from the section itself, not from
the spacing of the heading inside it, because that heading's leading space falls inside the section's
own extent.

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
scenarios closed — puts on screen immediately. The space above a heading SHALL likewise be the same
whether its section is open or closed: it is the section that holds that space, and a section that
reserved it only while open would move its own heading as a reader toggled it.

The space a section reserves above its heading SHALL follow the section's nesting rather than its
heading's level, for the same reason the mark is suppressed by nesting: which levels fold is the
caller's choice, so a rule that reads a heading level stops applying the moment that choice changes. A
section that is not nested therefore reserves the space of a top-level section whatever its heading —
a scenario with no requirement before it is spaced as the top-level section it is, not as the
subordinate one its heading level suggests.

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

#### Scenario: The mark begins at its own heading

- **WHEN** an open section is rendered
- **THEN** its mark begins level with the top of the section heading's first line
- **AND** the space above that heading carries no mark

#### Scenario: The mark ends with its content

- **WHEN** an open section's last content is a paragraph or a list
- **THEN** the mark ends at the bottom of that content
- **AND** the trailing space below it carries no mark

#### Scenario: Consecutive open sections do not share one mark

- **WHEN** two open requirement sections follow one another
- **THEN** the first section's mark ends before the second section's mark begins, with visible separation between them
- **AND** the whole of that separation is free of any mark

#### Scenario: A section's leading space follows its nesting

- **WHEN** a scenario section with no requirement before it is rendered
- **THEN** it reserves the same space above its heading as a top-level requirement section does

#### Scenario: A heading's leading space does not depend on its open state

- **WHEN** an open section and a closed section are rendered at the same level
- **THEN** the space above each section's heading is the same

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
