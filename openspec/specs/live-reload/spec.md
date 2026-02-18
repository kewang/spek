### Requirement: File change detection for Web version
The Web server SHALL monitor the `openspec/` directory for file changes using `chokidar` and push notifications to connected clients via Server-Sent Events (SSE).

#### Scenario: SSE endpoint connection
- **WHEN** a client connects to `GET /api/openspec/watch?dir=<repoPath>`
- **THEN** the server opens an SSE stream and begins monitoring `<repoPath>/openspec/` for `.md` and `.yaml` file changes

#### Scenario: File change notification
- **WHEN** a `.md` or `.yaml` file inside `openspec/` is created, modified, or deleted
- **THEN** the server sends an SSE event `data: {"type":"changed"}` to all connected clients for that directory, debounced at 500ms

#### Scenario: Client disconnect cleanup
- **WHEN** a client disconnects from the SSE endpoint
- **THEN** the server removes the client from the notification list and cleans up the watcher if no other clients are connected for that directory

#### Scenario: Shared watcher per directory
- **WHEN** multiple clients connect to the same `dir` parameter
- **THEN** the server SHALL reuse the same chokidar watcher instance for that directory

### Requirement: File change detection for VS Code version
The VS Code extension SHALL monitor the workspace's `openspec/` directory for file changes and notify the webview.

#### Scenario: FileSystemWatcher setup
- **WHEN** the spek Webview Panel is created
- **THEN** the extension host creates a `vscode.workspace.createFileSystemWatcher` for `**/openspec/**/*.{md,yaml}`

#### Scenario: File change notification to webview
- **WHEN** a file matching the watcher pattern is created, modified, or deleted
- **THEN** the extension host sends `{ type: "fileChanged" }` to the webview via `postMessage`, debounced at 500ms

#### Scenario: Watcher cleanup
- **WHEN** the spek Webview Panel is disposed
- **THEN** the FileSystemWatcher SHALL be disposed along with other panel resources

### Requirement: RefreshContext for frontend refresh coordination
The frontend SHALL provide a `RefreshContext` that coordinates data refresh across all hooks when file changes are detected.

#### Scenario: RefreshContext provides refreshKey
- **WHEN** a component or hook calls `useRefreshKey()`
- **THEN** it receives the current `refreshKey` number value from the context

#### Scenario: Refresh triggered by file change
- **WHEN** `refresh()` from `RefreshContext` is called
- **THEN** the `refreshKey` counter increments, causing all `useAsyncData` hooks to re-fetch their data

### Requirement: useFileWatcher hook
The frontend SHALL provide a `useFileWatcher` hook that connects to the appropriate file change event source based on the runtime environment.

#### Scenario: Web environment with SSE
- **WHEN** `useFileWatcher` is active in the Web environment
- **THEN** it opens an `EventSource` connection to `/api/openspec/watch?dir=<repoPath>` and calls `refresh()` on each received event

#### Scenario: VS Code environment with postMessage
- **WHEN** `useFileWatcher` is active in the VS Code webview environment
- **THEN** it listens for `message` events with `type === "fileChanged"` and calls `refresh()` on each received event

#### Scenario: Demo environment no-op
- **WHEN** `useFileWatcher` is active in the Demo environment
- **THEN** it does nothing (no event source to connect to)

#### Scenario: Cleanup on unmount
- **WHEN** the component using `useFileWatcher` unmounts
- **THEN** the EventSource connection or message listener SHALL be cleaned up

### Requirement: Debounced re-fetch in useAsyncData
The `useAsyncData` hook SHALL support automatic re-fetch triggered by `refreshKey` changes with debounce to avoid excessive requests.

#### Scenario: Re-fetch on refreshKey change
- **WHEN** `refreshKey` changes in the `RefreshContext`
- **THEN** `useAsyncData` triggers a new fetch after a 300ms debounce delay

#### Scenario: Debounce coalesces rapid changes
- **WHEN** `refreshKey` changes multiple times within 300ms
- **THEN** only one re-fetch is triggered after the last change

#### Scenario: Existing data preserved during re-fetch
- **WHEN** a re-fetch is triggered by `refreshKey` change
- **THEN** the existing `data` SHALL remain visible (no loading flash) until the new data arrives
