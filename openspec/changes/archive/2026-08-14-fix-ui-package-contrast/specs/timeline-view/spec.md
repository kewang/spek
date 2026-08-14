## MODIFIED Requirements

### Requirement: Timeline visualizes change lifecycle as bars

The timeline SHALL render each change with a `createdDate` as a horizontal bar positioned by date on a shared time axis.

A bar is the only thing stating when a change lived, so it SHALL meet at least 3:1 against the timeline
background in every theme the host offers. Its status SHALL be carried by the bar's colour, and SHALL NOT
be carried by reducing the bar's opacity: opacity applies after the colour is chosen, so no value in the
contract can reach the floor through it — the archived bar measured 1.91:1 light and 2.17:1 dark even after
its colour was corrected.

The "today" line and its label state where now is, and SHALL meet their floors — 3:1 for the line, 4.5:1
for the label — without an opacity standing between the contract's value and what is drawn. Both failed on
that mechanism alone: the line at `stroke-opacity` 0.5 measured 2.35:1 light, and the label at
`fill-opacity` 0.8 measured 4.39:1, each carrying a colour that clears its floor at full strength.

The timeline's grid lines and its topic separators are **not** covered by that floor. They are drawn from
the contract's border colour at 1.05:1–1.22:1, and they are decoration: a bar's dates are stated by the
axis labels and by its tooltip, and a separator divides groups that are already labelled. They are named
here because they were measured and judged, not overlooked — the same line drawn around a panel's own
hairline border.

#### Scenario: Archived change renders as fixed segment

- **WHEN** a change has both `createdDate` and `archivedDate`
- **THEN** the bar spans `[createdDate, archivedDate]` with neutral muted fill
- **AND** the bar shape is a rounded rectangle

#### Scenario: Active change extends to today

- **WHEN** a change has `createdDate` and `status === "active"`
- **THEN** the bar spans `[createdDate, today]` with accent fill
- **AND** the right edge displays an open arrow indicator

#### Scenario: Today reference line

- **WHEN** the timeline renders
- **THEN** a vertical dashed line marks "today" across the chart area

#### Scenario: The today marker is visible in every theme

- **WHEN** the timeline is rendered in either theme
- **THEN** the "today" line meets at least 3:1 and its label at least 4.5:1 against the least favourable of the host's surfaces

#### Scenario: Both bar states are visible in every theme

- **WHEN** the timeline is rendered in either theme
- **THEN** the active bar and the archived bar each meet at least 3:1 against the least favourable of the host's surfaces
- **AND** the two remain distinguishable from each other by colour
