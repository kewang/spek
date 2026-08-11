## MODIFIED Requirements

### Requirement: Specs TreeView
The sidebar SHALL display a TreeView listing all specs from the OpenSpec repository. Each spec item SHALL display the spec topic name and SHALL be expandable to reveal that spec's `h2` and `h3` headings as child nodes. Spec items SHALL be sorted alphabetically. Each heading child node SHALL display the heading text without the leading `## ` / `### ` markers and without the leading OpenSpec format keyword, matching what the rendered content shows for the same heading, and SHALL be visually distinguishable between `h2` and `h3` levels (for example by indentation, icon, or `description`).

Each heading child node's tooltip SHALL carry the heading's authored text unchanged. The tooltip is where the sidebar already repeats the heading, so the authored form stays reachable in this host at no cost — but the tree is one surface among four, and this SHALL NOT be read as a requirement to invent a second, hidden rendering elsewhere.

Navigation SHALL be unaffected: each heading child node SHALL continue to command a jump to the heading's slug, which is derived from the authored text.

#### Scenario: Display specs list
- **WHEN** the user opens the spek sidebar
- **THEN** a "SPECS" section displays all spec topics sorted alphabetically, each rendered as an expandable (collapsed by default) tree item

#### Scenario: Expand spec to view headings
- **WHEN** the user expands a spec item
- **THEN** the spec's `h2` and `h3` headings are loaded and displayed as child tree items in document order

#### Scenario: A requirement heading's label drops the format keyword
- **WHEN** the user expands a spec containing `### Requirement: Foo`
- **THEN** the child node's label reads `Foo`
- **AND** its tooltip reads `Requirement: Foo`

#### Scenario: Clicking a heading node still navigates
- **WHEN** the user clicks that child node
- **THEN** the webview navigates to `/specs/<topic>#<slug of the authored text>`, unchanged from before the label was elided

#### Scenario: Spec with no headings
- **WHEN** the user expands a spec item whose content has no `h2` or `h3` headings
- **THEN** the tree item shows no children (or an empty children list) and remains expandable without error

#### Scenario: h2 vs h3 visually distinguished
- **WHEN** a spec contains both `h2` and `h3` headings
- **THEN** the rendered child items make the level difference visually apparent (e.g., `h3` items are indented or marked differently from `h2` items)

#### Scenario: Empty specs
- **WHEN** the workspace has an openspec directory with no specs
- **THEN** the SPECS section displays a welcome message indicating no specs found
