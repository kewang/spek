## ADDED Requirements

### Requirement: The workflow diagram's marks are legible in every theme

Every mark in the schema detail view's diagram that is the only carrier of what it states SHALL meet at
least 3:1 against the least favourable surface it is drawn on, in every theme, and SHALL NOT take the
panel-hairline colour.

The diagram states things no text on the page repeats, and it states them with lines. An edge is the
only thing saying that one step depends on another — the detail region names a step's `requires` one
step at a time, and only once that step is selected. A dash is the only non-colour cue separating an
ordering the schema declares from one spek derived, and a declared step from the archive step that no
schema declares. The panel-hairline colour measures 1.22:1 dark and 1.13:1 light at full strength, so no
opacity of it reaches the floor, and a mark drawn in it is present in the document and absent from the
screen.

The marks this covers are the edge between two steps, its arrowhead, and the outline carrying the
archive step's distinction. An ordinary step's outline is **not** covered: its label already states that
a step is there, so the outline is trim, and requiring it to be legible would flatten the difference
between an outline that carries something and one that does not. Its fill states nothing either — a
step's fill against the panel behind it is 1.10:1 in both themes — so the label is the whole of what
carries a declared step, and it does so at better than 13:1.

Each legend swatch SHALL be drawn in the same colour and the same dash as the mark it explains. A legend
authored from its own values states a key in marks the diagram is not drawing, and it is the swatch —
a miniature, at a fraction of the mark's size — that fails first when the value is too faint. A reader
who cannot see the swatch is left with a sentence that has no referent.

Hover feedback on a step SHALL remain perceptible for every step, including one whose resting outline is
already a legible colour. Brightening a mark that is already bright is not feedback, and the step most
likely to be hovered for an explanation is the one drawn differently. This **strengthens** the existing
permission in "Schema detail view renders the workflow as an ordered flow" — that hover *may* give a
step its own affordance, and must not alter any other step or connection. What was optional there is
required here for every step alike; the constraint on what hover may touch is unchanged and still stated
there. The two are one rule, and a reader arriving at either is meant to be sent to the other.

This obligation is stated as its own requirement rather than folded into the one it strengthens, because
that requirement already governs the detail view's layout, scrolling, selection, archiving and apply in
a single block; a contrast clause added to it would be the sixth concern in a requirement that is
already hard to hold. Where a specification's requirements are granular — `graph-view`'s
`Edge rendering`, `Node visual encoding` and `Graph legend` — the clause belongs inside the requirement
that owns the mark, and that remains the preferred shape.

#### Scenario: An edge is legible in both themes

- **WHEN** the workflow diagram draws an edge between two steps, in either theme
- **THEN** the edge and its arrowhead meet at least 3:1 against the surface behind them

#### Scenario: The archive step's distinction is legible

- **WHEN** the workflow diagram draws the archive step, in either theme
- **THEN** the outline carrying its distinction from the declared steps meets at least 3:1 against what
  sits behind it

#### Scenario: An ordinary step's outline is not an indicator

- **WHEN** a step the schema declares is drawn with a fill and a label
- **THEN** its outline is treated as decoration and owes no contrast floor

#### Scenario: A legend swatch matches the mark it explains

- **WHEN** the legend shows a swatch for a mark used in the diagram
- **THEN** the swatch takes that mark's colour and dash, so the key cannot state something the diagram is
  not drawing

#### Scenario: Hover stays perceptible on a step whose resting outline is legible

- **WHEN** the reader hovers the archive step, whose resting outline is already drawn in a legible colour
- **THEN** the outline changes by a step the reader can see, as it does for a step whose resting outline
  is a hairline
