## MODIFIED Requirements

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
