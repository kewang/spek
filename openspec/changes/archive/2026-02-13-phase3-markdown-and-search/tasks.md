## 1. Dependencies

- [x] 1.1 Install react-markdown and remark-gfm packages

## 2. MarkdownRenderer Component

- [x] 2.1 Create MarkdownRenderer component with react-markdown + remark-gfm rendering
- [x] 2.2 Implement BDD keyword highlighting (WHEN/GIVEN, THEN, AND, MUST/SHALL, ADDED/MODIFIED) using custom component overrides
- [x] 2.3 Add dark theme styles for rendered Markdown (code blocks, links, headings, tables)

## 3. Integrate MarkdownRenderer

- [x] 3.1 Replace `<pre>` in SpecDetail with MarkdownRenderer
- [x] 3.2 Replace `<pre>` in ChangeDetail (proposal, design, specs tabs) with MarkdownRenderer

## 4. SearchDialog Component

- [x] 4.1 Create SearchDialog component with modal overlay, search input, and results display
- [x] 4.2 Add useSearch hook to call `/api/openspec/search` with 300ms debounce
- [x] 4.3 Implement result grouping by type (Specs / Changes) with context preview
- [x] 4.4 Implement keyboard navigation (arrow keys to select, Enter to confirm, Escape to close)
- [x] 4.5 Implement click-to-navigate using React Router

## 5. Integrate SearchDialog

- [x] 5.1 Add Cmd+K / Ctrl+K global keyboard shortcut to open SearchDialog
- [x] 5.2 Replace disabled search button in Layout header with functional search trigger
