# Changelog

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
