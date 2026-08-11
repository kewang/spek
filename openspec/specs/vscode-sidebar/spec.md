## Purpose

在 VS Code sidebar 提供 specs TreeView，子節點為 heading 並可跳至 webview 錨點。
## Requirements
### Requirement: Activity Bar icon
The extension SHALL register a ViewContainer in the Activity Bar with a spek-branded SVG icon. The ViewContainer SHALL be visible when the workspace contains an `openspec/` directory.

#### Scenario: Activity Bar icon visible with openspec workspace
- **WHEN** VS Code opens a workspace containing an `openspec/` directory
- **THEN** the spek icon appears in the Activity Bar

#### Scenario: Activity Bar icon hidden without openspec workspace
- **WHEN** VS Code opens a workspace without an `openspec/` directory
- **THEN** the spek icon is not displayed in the Activity Bar

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

### Requirement: Changes TreeView
The sidebar SHALL display a TreeView listing changes from the OpenSpec repository, grouped by status (active and archived). Each item SHALL display the change slug name. When the change has a `createdDate`, the TreeItem SHALL set its `description` to a lifecycle hint:

- Active changes SHALL set `description` to `(<N>d)`, where `<N>` is the integer day count between `createdDate` and today.
- Archived changes (with both `createdDate` and `archivedDate`) SHALL set `description` to `→ archived (<N>d)`, where `<N>` is the day count between `createdDate` and `archivedDate`.

The TreeItem `tooltip` SHALL include `Created: <ISO date>` for any change with `createdDate`, and additionally `Archived: <ISO date>` for archived changes with `archivedDate`. Changes whose `createdDate` is null SHALL NOT have a lifecycle `description`, and the `tooltip` SHALL omit the corresponding line.

#### Scenario: Display changes with active and archived groups
- **WHEN** the workspace has both active and archived changes
- **THEN** the CHANGES section displays two groups: "Active" and "Archived", each containing their respective change items

#### Scenario: Display changes with only active changes
- **WHEN** the workspace has only active changes
- **THEN** the CHANGES section displays only the "Active" group

#### Scenario: Empty changes
- **WHEN** the workspace has no changes
- **THEN** the CHANGES section displays a welcome message indicating no changes found

#### Scenario: Active change shows lifecycle hint
- **WHEN** an active change has `createdDate: "2026-04-20"` and today is `2026-04-25`
- **THEN** the TreeItem's `description` is `(5d)`
- **AND** the `tooltip` includes the line `Created: 2026-04-20`

#### Scenario: Archived change shows lifecycle span
- **WHEN** an archived change has `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the TreeItem's `description` is `→ archived (8d)`
- **AND** the `tooltip` includes the lines `Created: 2026-02-14` and `Archived: 2026-02-22`

#### Scenario: Change without createdDate shows no lifecycle hint
- **WHEN** a change has `createdDate: null`
- **THEN** the TreeItem's `description` is empty (no lifecycle hint)
- **AND** the `tooltip` does NOT include a `Created:` line

### Requirement: TreeView item navigation
When the user clicks a TreeView item, the extension SHALL open the spek Webview Panel and navigate to the corresponding page. Clicking a spec heading child item SHALL navigate to the spec page with a URL hash matching the heading's slug, and the webview SHALL scroll to the corresponding heading. If the Webview Panel is not yet open, the extension SHALL queue the navigation request and deliver it after the webview completes its ready handshake.

#### Scenario: Click spec item
- **WHEN** the user clicks a spec item with topic "user-auth"
- **THEN** the extension opens the spek webview panel and navigates to `/specs/user-auth`

#### Scenario: Click heading child item
- **WHEN** the user clicks a heading child item under spec "user-auth" whose slug is "requirement-login"
- **THEN** the extension opens the spek webview panel and navigates to `/specs/user-auth#requirement-login`, and the webview scrolls to that heading

#### Scenario: Click change item
- **WHEN** the user clicks a change item with slug "add-login"
- **THEN** the extension opens the spek webview panel and navigates to `/changes/add-login`

#### Scenario: Panel already open
- **WHEN** the webview panel is already open and the user clicks a TreeView item
- **THEN** the panel is revealed and navigated to the corresponding page (with hash if applicable) without creating a new panel

#### Scenario: Panel not yet open - first click navigates correctly
- **WHEN** the webview panel is not open and the user clicks a TreeView item
- **THEN** the extension creates the panel, waits for the webview ready handshake, and navigates to the corresponding page (preserving any hash) in a single click

### Requirement: TreeView refresh on file changes
The TreeView SHALL automatically refresh when files under the `openspec/` directory are created, modified, or deleted. The refresh SHALL also invalidate any cached spec content used to populate heading child nodes, so that subsequent expansions reflect the latest content.

#### Scenario: New spec added
- **WHEN** a new spec file is created under `openspec/specs/`
- **THEN** the Specs TreeView refreshes to include the new spec item

#### Scenario: Change deleted
- **WHEN** a change directory is deleted under `openspec/changes/`
- **THEN** the Changes TreeView refreshes to remove the deleted change item

#### Scenario: Spec content modified
- **WHEN** a `spec.md` file is modified under `openspec/specs/`
- **THEN** the Specs TreeView refreshes such that the next expansion of that spec re-reads the file and shows the updated heading list

### Requirement: Open spek command from sidebar
The sidebar SHALL provide a toolbar action button to open the full spek Webview Panel (dashboard view).

#### Scenario: Click open button in sidebar toolbar
- **WHEN** the user clicks the open button in the SPECS view toolbar
- **THEN** the spek webview panel opens showing the dashboard view

### Requirement: jj workspace setting and indicators

The VS Code extension SHALL contribute a configuration setting `spek.aggregateJjWorkspaces` (boolean,
default false — experimental, opt-in) that controls whether jj workspaces are included in aggregation, independent of git
worktree aggregation. The extension SHALL read this setting and pass it to `@spekjs/core` as
`includeJj`. The sidebar SHALL indicate jj-sourced changes (showing the workspace name), mark a change
that the jj working-copy commit `@` is currently editing (`isCurrent`), and mark a change carrying
`conflictsWith` as diverging from its base.

#### Scenario: Setting disables jj inclusion

- **WHEN** `spek.aggregateJjWorkspaces` is set to false
- **THEN** the sidebar and webview exclude jj-only workspace changes, matching git-worktree-only aggregation

#### Scenario: jj source shown in sidebar

- **WHEN** the sidebar renders an aggregated change whose `source.vcs === "jj"`
- **THEN** it shows the jj workspace name as the source indicator

#### Scenario: Divergent change marked in sidebar

- **WHEN** the sidebar renders an aggregated change carrying `conflictsWith`
- **THEN** it shows a "conflicts with &lt;source&gt;" marker on that item


### Requirement: Worktree aggregation setting and header-control binding

The VS Code extension SHALL contribute a configuration setting `spek.aggregateWorktrees` (boolean,
default true) that controls git-worktree aggregation, mirroring the existing `spek.aggregateJjWorkspaces`
for jj. The extension handler SHALL treat both settings as the source of truth: it SHALL resolve
`aggregate` from `spek.aggregateWorktrees` (mirroring how `includeJj` is resolved from
`spek.aggregateJjWorkspaces`) for the change / overview / graph data it serves, regardless of any value
sent by the webview.

The webview aggregate checkbox on the Changes page SHALL be removed; the aggregation scope in VS Code
is controlled solely by the global header control, which reads and writes these two settings. The
handler SHALL serve `getAggregationPrefs` (returning the two settings' values) and `setAggregationPrefs`
(writing both settings at the Workspace configuration scope). The extension SHALL refresh the webview
when either aggregation setting changes, so an external settings edit is reflected in the header
control.

#### Scenario: Setting drives aggregation

- **WHEN** `spek.aggregateWorktrees` is set to false
- **THEN** the sidebar and webview show only the current directory's changes, without cross-worktree
  aggregation

#### Scenario: Header control writes the settings

- **WHEN** the user changes the aggregation scope from the header control in the VS Code webview
- **THEN** the extension updates `spek.aggregateWorktrees` and `spek.aggregateJjWorkspaces` at the
  Workspace scope, equivalent to editing `settings.json`

#### Scenario: External settings edit refreshes the control

- **WHEN** either `spek.aggregateWorktrees` or `spek.aggregateJjWorkspaces` is changed externally while
  the webview is open
- **THEN** the webview refreshes and the header control reflects the new value

#### Scenario: No aggregate checkbox on the Changes page

- **WHEN** the Changes page renders in the VS Code webview
- **THEN** it shows no aggregate checkbox; the aggregation scope is set from the header control only
