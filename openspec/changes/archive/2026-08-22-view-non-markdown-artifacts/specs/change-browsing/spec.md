## MODIFIED Requirements

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface whose tabs are generated from the change's discovered `artifacts` array, in the order that array provides (schema-enriched when available, otherwise the default `proposal, design, specs, tasks` ordering). Each tab's label SHALL be the artifact's title, and its content SHALL render according to the artifact's kind: `markdown` artifacts render their Markdown content, the `specs` artifact lists and renders its delta spec files, the `tasks` artifact renders structured task data with a TaskProgress bar, and a `data` artifact renders its raw file content as a syntax-highlighted code block with the language inferred from the file extension. A `data` tab SHALL NOT show a table of contents, because its content is not Markdown. Tab content SHALL transition with a fade-in animation when switching. The change title (including back navigation link) and tab navigation bar SHALL be sticky-positioned below the main header, remaining visible when the user scrolls through long content. The active tab SHALL be reflected in the URL `?tab=<artifact-id>` query parameter; when absent or unknown, the first artifact's tab SHALL be active.

#### Scenario: Tabs generated from artifacts
- **WHEN** a change's discovered artifacts are `proposal, design, specs, tasks`
- **THEN** the page renders tabs in that order with those titles

#### Scenario: Custom-schema tabs
- **WHEN** a change's discovered artifacts include `brainstorm, proposal, plan, verify` (a non spec-driven schema)
- **THEN** a tab is rendered for each artifact, in the discovered/enriched order, each showing that artifact's content

#### Scenario: View a markdown artifact tab
- **WHEN** user clicks a markdown artifact's tab
- **THEN** that artifact's Markdown content is displayed with a fade-in transition

#### Scenario: View specs tab
- **WHEN** user clicks the specs artifact's tab and the change has delta specs
- **THEN** the delta spec files are listed and their content displayed with a fade-in transition

#### Scenario: View tasks tab
- **WHEN** user clicks the tasks artifact's tab
- **THEN** the tasks content is displayed with a TaskProgress bar showing completion statistics, with a fade-in transition

#### Scenario: View a data artifact tab
- **WHEN** user clicks a `data` artifact's tab (for example `asyncapi.yaml`)
- **THEN** the artifact's raw file content is displayed as a syntax-highlighted code block with a fade-in transition, and no table of contents is shown

#### Scenario: Default and unknown tab query param
- **WHEN** the page loads with no `tab` query parameter, or a `tab` value that matches no artifact id
- **THEN** the first artifact's tab is active and no error is raised

#### Scenario: Sticky header on scroll
- **WHEN** user scrolls down through long change content
- **THEN** the change title (with back link) and tab navigation bar SHALL remain fixed below the main application header
- **AND** the sticky area SHALL have an opaque background that covers scrolling content beneath it
