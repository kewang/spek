## ADDED Requirements

### Requirement: Load React SPA in Webview
The Webview SHALL load the spek React application from the extension's bundled assets.

#### Scenario: Webview HTML generation
- **WHEN** the extension creates a Webview Panel
- **THEN** it generates an HTML document that loads the built React bundle with asset paths converted via `webview.asWebviewUri()`

#### Scenario: Asset path resolution
- **WHEN** the Webview HTML references JS or CSS files
- **THEN** all asset paths SHALL use `webview.asWebviewUri()` to convert local file paths to Webview-safe URIs

#### Scenario: File change notification forwarding
- **WHEN** a file in the `openspec/` directory changes
- **THEN** the Webview Panel SHALL forward the `{ type: "fileChanged" }` message to the React application so it can refresh its data

### Requirement: Content Security Policy
The Webview SHALL enforce a Content Security Policy that allows the React application to function while preventing unauthorized content.

#### Scenario: CSP configuration
- **WHEN** the Webview HTML is generated
- **THEN** it includes a CSP meta tag that allows scripts and styles from the extension's webview URI origin with a unique nonce, and disallows inline scripts without the nonce

#### Scenario: Tailwind CSS compatibility
- **WHEN** Tailwind CSS styles are loaded in the Webview
- **THEN** all styles SHALL be loaded from external CSS files (not inline style tags) to comply with CSP

### Requirement: Workspace path injection
The Webview SHALL receive the workspace path from the extension host so the React app can skip the repo selection page.

#### Scenario: Initial workspace path
- **WHEN** the Webview is created in a workspace with an `openspec/` directory
- **THEN** the extension host sends a `{ type: 'init', workspacePath: '/path/to/repo' }` message after the Webview is ready

#### Scenario: Webview ready handshake
- **WHEN** the React app finishes mounting in the Webview
- **THEN** it sends a `{ type: 'ready' }` message to the extension host to signal it can receive the workspace path

### Requirement: Theme synchronization
The Webview SHALL respect the VS Code color theme.

#### Scenario: Dark theme active
- **WHEN** VS Code is using a dark color theme
- **THEN** the Webview renders the spek dark theme

#### Scenario: Light theme active
- **WHEN** VS Code is using a light color theme
- **THEN** the Webview renders the spek light theme

#### Scenario: Theme change
- **WHEN** the user changes the VS Code color theme while the Webview is open
- **THEN** the Webview updates its theme to match

### Requirement: Tab icon display
The Webview Panel SHALL display the spek logo as the tab icon for visual identification.

#### Scenario: Tab icon is set on panel creation
- **WHEN** the extension creates a Webview Panel
- **THEN** the panel's `iconPath` SHALL be set to the `webview/favicon.svg` file from the extension's bundled assets

#### Scenario: Icon visibility across themes
- **WHEN** the tab icon is displayed in either light or dark VS Code theme
- **THEN** the icon SHALL be visually distinguishable against the tab bar background
