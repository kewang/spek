### Requirement: Activity Bar icon
The extension SHALL register a ViewContainer in the Activity Bar with a spek-branded SVG icon. The ViewContainer SHALL be visible when the workspace contains an `openspec/` directory.

#### Scenario: Activity Bar icon visible with openspec workspace
- **WHEN** VS Code opens a workspace containing an `openspec/` directory
- **THEN** the spek icon appears in the Activity Bar

#### Scenario: Activity Bar icon hidden without openspec workspace
- **WHEN** VS Code opens a workspace without an `openspec/` directory
- **THEN** the spek icon is not displayed in the Activity Bar

### Requirement: Specs TreeView
The sidebar SHALL display a TreeView listing all specs from the OpenSpec repository. Each item SHALL display the spec topic name. Items SHALL be sorted alphabetically.

#### Scenario: Display specs list
- **WHEN** the user opens the spek sidebar
- **THEN** a "SPECS" section displays all spec topics sorted alphabetically

#### Scenario: Empty specs
- **WHEN** the workspace has an openspec directory with no specs
- **THEN** the SPECS section displays a welcome message indicating no specs found

### Requirement: Changes TreeView
The sidebar SHALL display a TreeView listing changes from the OpenSpec repository, grouped by status (active and archived). Each item SHALL display the change slug name.

#### Scenario: Display changes with active and archived groups
- **WHEN** the workspace has both active and archived changes
- **THEN** the CHANGES section displays two groups: "Active" and "Archived", each containing their respective change items

#### Scenario: Display changes with only active changes
- **WHEN** the workspace has only active changes
- **THEN** the CHANGES section displays only the "Active" group

#### Scenario: Empty changes
- **WHEN** the workspace has no changes
- **THEN** the CHANGES section displays a welcome message indicating no changes found

### Requirement: TreeView item navigation
When the user clicks a TreeView item, the extension SHALL open the spek Webview Panel and navigate to the corresponding page.

#### Scenario: Click spec item
- **WHEN** the user clicks a spec item with topic "user-auth"
- **THEN** the extension opens the spek webview panel and navigates to `/specs/user-auth`

#### Scenario: Click change item
- **WHEN** the user clicks a change item with slug "add-login"
- **THEN** the extension opens the spek webview panel and navigates to `/changes/add-login`

#### Scenario: Panel already open
- **WHEN** the webview panel is already open and the user clicks a TreeView item
- **THEN** the panel is revealed and navigated to the corresponding page without creating a new panel

### Requirement: TreeView refresh on file changes
The TreeView SHALL automatically refresh when files under the `openspec/` directory are created, modified, or deleted.

#### Scenario: New spec added
- **WHEN** a new spec file is created under `openspec/specs/`
- **THEN** the Specs TreeView refreshes to include the new spec item

#### Scenario: Change deleted
- **WHEN** a change directory is deleted under `openspec/changes/`
- **THEN** the Changes TreeView refreshes to remove the deleted change item

### Requirement: Open spek command from sidebar
The sidebar SHALL provide a toolbar action button to open the full spek Webview Panel (dashboard view).

#### Scenario: Click open button in sidebar toolbar
- **WHEN** the user clicks the open button in the SPECS view toolbar
- **THEN** the spek webview panel opens showing the dashboard view
