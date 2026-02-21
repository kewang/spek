# Changelog

## 0.6.4

- Fix change detail showing "Change not found" error during file watcher refresh (e.g., after archiving a change)
- Improve API error messages — show descriptive server errors instead of generic "HTTP 404"

## 0.6.3

- Add git timestamp to changes — sort by precise commit time instead of date-only slug, display relative time (e.g., "3 hours ago") in Dashboard and Changes list
- Fix detect fallback — repos with openspec/ directory but no config.yaml are now correctly detected

## 0.6.2

- Sticky change detail header — change title and tab navigation stay fixed below the header when scrolling through long content

## 0.6.1

- Fix VS Code live-reload not detecting directory moves (e.g., archive operations)

## 0.6.0

- Live reload — spek viewer automatically refreshes when openspec files change on disk
- Web: Server-Sent Events (SSE) with chokidar file watching
- VS Code: FileSystemWatcher with postMessage notification
- Debounced refresh (500ms server + 300ms client) preserves existing data without loading flash

## 0.5.0

- Interactive spec-change graph view — D3 force-directed graph showing relationships between specs and changes
- Spec nodes (amber circles) scaled by history count, change nodes (colored rects) by spec count
- Graph interactions: drag, hover highlight, click navigation, zoom/pan with fit-to-viewport
- New `/graph` route with sidebar navigation link, working across Web, VS Code, and demo

## 0.4.0

- Spec diff viewer — compare current spec content against any historical change version with unified diff view
- Compare button on spec history timeline entries for quick diff access
- New API endpoint and core function for reading spec content at specific change versions
- Full support across Web, VS Code extension, and demo environments

## 0.3.1

- Add custom tab icon (spek logo) to VS Code webview panel for better visual identification

## 0.3.0

- Standalone demo page — self-contained HTML with embedded openspec data for GitHub Pages
- UI design polish — tab order, animations, search highlights, accessibility improvements
- Fix demo search — use ApiAdapter instead of direct fetch
- Plus Jakarta Sans web font for improved typography
- Add acknowledgments section to README

## 0.2.1

- GitHub Actions CI/CD — auto build and publish to VS Code Marketplace on `v*` tag push
- `npm version` auto-syncs version between root and vscode package.json

## 0.2.0

- Collapsible sidebar with icon-only mode — click toggle button to collapse/expand
- Sidebar state persisted in localStorage (web) across sessions
- Smooth CSS transition animation for sidebar width changes

## 0.1.0

Initial release.

- Dashboard with specs/changes overview and task completion stats
- Specs browser with detail view and revision history
- Changes timeline with tabbed views (Proposal / Design / Tasks / Specs)
- BDD syntax highlighting (WHEN/GIVEN, THEN, AND, MUST/SHALL)
- Task progress tracking with section-grouped progress bars
- Full-text search across specs and changes (Cmd+K)
- Markdown rendering with remark-gfm
- Dark / Light theme toggle
- Responsive layout with mobile support
- Repo selection with path validation and recent history
- Git-based spec history timestamps with in-memory cache
- VS Code extension with Webview Panel integration
- Brand logo and favicon
- Bilingual README (English / 繁體中文) with screenshots
