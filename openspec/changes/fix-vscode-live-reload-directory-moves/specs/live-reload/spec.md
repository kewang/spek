## MODIFIED Requirements

### Requirement: File change detection for VS Code version
The VS Code extension SHALL monitor the workspace's `openspec/` directory for file changes and notify the webview.

#### Scenario: FileSystemWatcher setup
- **WHEN** the spek Webview Panel is created
- **THEN** the extension host creates a `vscode.workspace.createFileSystemWatcher` for `openspec/**` to detect all changes including directory moves

#### Scenario: File change notification to webview
- **WHEN** a file or directory matching the watcher pattern is created, modified, deleted, or moved
- **THEN** the extension host sends `{ type: "fileChanged" }` to the webview via `postMessage`, debounced at 500ms

#### Scenario: Watcher cleanup
- **WHEN** the spek Webview Panel is disposed
- **THEN** the FileSystemWatcher SHALL be disposed along with other panel resources
