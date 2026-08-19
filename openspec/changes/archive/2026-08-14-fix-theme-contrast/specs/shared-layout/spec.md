## MODIFIED Requirements

### Requirement: TaskProgress component
The system SHALL provide a reusable TaskProgress component that displays a progress bar with completed/total count. The progress bar color SHALL reflect completion status: amber/accent color when incomplete, green when all tasks are completed (completed equals total).

The filled portion SHALL be distinguishable from its track by at least 3:1 in every theme, and both colours SHALL
come from the theme's palette rather than from one literal shared by every theme. The fill is the only thing stating
how far along a change is — no text beside it names the state — so it is a graphical object carrying information
rather than decoration.

#### Scenario: Display progress
- **WHEN** TaskProgress is rendered with `completed=3` and `total=5`
- **THEN** a progress bar at 60% width is shown in amber/accent color with text "3 / 5"

#### Scenario: Display completed progress
- **WHEN** TaskProgress is rendered with `completed=5` and `total=5`
- **THEN** a progress bar at 100% width is shown in green color with text "5 / 5"

#### Scenario: Zero tasks
- **WHEN** TaskProgress is rendered with `total=0`
- **THEN** component displays "No tasks" or an empty state

#### Scenario: The fill is distinguishable from the track
- **WHEN** the progress bar is rendered in either theme
- **AND** the change is partially complete or fully complete
- **THEN** the filled portion meets at least 3:1 against the track behind it
