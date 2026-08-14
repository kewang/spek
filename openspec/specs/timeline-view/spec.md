## Purpose

Present change lifecycles as a horizontal Gantt-style timeline, so progress over time is visible at a glance.
## Requirements
### Requirement: Timeline page route

The system SHALL expose a `/timeline` route in the web app that renders a horizontal Gantt-style timeline of all OpenSpec changes for the active repo.

#### Scenario: Navigate to timeline via sidebar

- **WHEN** user clicks the `Timeline` entry in the sidebar nav
- **THEN** the URL changes to `/timeline` and the timeline page renders
- **AND** the sidebar entry is visually highlighted as active

#### Scenario: Direct URL access

- **WHEN** user opens the app and navigates to `/timeline` directly
- **THEN** the timeline page renders without redirect (assuming a repo is selected)

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

### Requirement: Time axis adapts to data span

The horizontal time axis SHALL auto-fit its domain to the data and choose tick density based on span.

#### Scenario: Domain covers all visible bars

- **WHEN** the timeline renders with N changes
- **THEN** the axis domain covers `[min(createdDate), max(archivedDate ?? today)]` with small left/right padding

#### Scenario: Tick density by span

- **WHEN** the domain span is < 14 days
- **THEN** major ticks render daily
- **WHEN** the span is 14–60 days
- **THEN** major ticks render weekly (Monday)
- **WHEN** the span is 60–365 days
- **THEN** major ticks render monthly with weekly minor grid
- **WHEN** the span is > 365 days
- **THEN** major ticks render quarterly with monthly minor grid

### Requirement: Bar interactions

Bars SHALL be interactive, providing hover details and click-through navigation.

#### Scenario: Hover shows tooltip

- **WHEN** user hovers a bar
- **THEN** a tooltip displays the change slug, status, `createdDate`, `archivedDate` (or `Active`), and duration in days

#### Scenario: Click navigates to change detail

- **WHEN** user clicks a bar
- **THEN** the app navigates to `/changes/:slug` for that change

### Requirement: Group by spec topic toggle

The timeline SHALL provide a toggle that, when enabled, groups bars into lanes by the spec topic each change affects.

Topic grouping SHALL produce the same lanes whether the graph data came from a single working directory
or from worktree/workspace aggregation. Aggregated graphs namespace change node ids by the winning
worktree (`change:<worktreeKey>:<slug>`); the timeline SHALL resolve such an id back to its plain slug
before matching it against the changes it renders.

#### Scenario: Toggle off shows flat lane list

- **WHEN** the group toggle is off (default)
- **THEN** all changes are listed as one column of lanes ordered by `createdDate` ascending

#### Scenario: Toggle on groups by topic

- **WHEN** the group toggle is on
- **THEN** lanes are grouped under section headers per spec topic
- **AND** changes affecting multiple topics appear as a separate bar in each topic's group

#### Scenario: Multi-topic change indicator

- **WHEN** a change appears in multiple topic groups
- **THEN** each occurrence's tooltip lists all affected topics

#### Scenario: Grouping under worktree aggregation

- **WHEN** the group toggle is on and the graph was built with aggregation across more than one worktree,
  so its change node ids carry a worktree key
- **THEN** each change is grouped under the spec topics its node is connected to, exactly as it would be
  without aggregation
- **AND** a change is placed in the no-topic lane only when none of its spec edges resolve to a spec node
  present in the graph

### Requirement: Status filter chips

The timeline SHALL provide filter chips to hide active or archived bars.

#### Scenario: Hide archived

- **WHEN** the `Hide archived` chip is toggled on
- **THEN** archived bars are removed from view and the time axis re-fits to remaining data

#### Scenario: Hide active

- **WHEN** the `Hide active` chip is toggled on
- **THEN** active bars are removed from view and the time axis re-fits to remaining data

### Requirement: Handle changes without created date

The timeline SHALL gracefully degrade for changes missing `createdDate` rather than guessing.

#### Scenario: Missing createdDate listed separately

- **WHEN** one or more changes have `createdDate === null`
- **THEN** they are omitted from the time axis area
- **AND** an `Unknown created (N)` section lists them with clickable links to detail

#### Scenario: All changes missing createdDate

- **WHEN** every change has `createdDate === null`
- **THEN** the page shows a neutral empty-state message stating that no created dates are available for these changes
- **AND** the message SHALL NOT assert that the user omitted `created:` frontmatter, since the field may be present in the file but not surfaced by the backend

### Requirement: Theme and responsive behavior

The timeline SHALL respect the active theme and remain usable on narrow viewports.

#### Scenario: Theme switching

- **WHEN** the theme is toggled between dark and light
- **THEN** the timeline colors update to match (axis, grid, bars, today line, tooltip)

#### Scenario: Narrow viewport

- **WHEN** the viewport width is below the chart's minimum content width
- **THEN** the chart area becomes horizontally scrollable while the lane label column remains visible

