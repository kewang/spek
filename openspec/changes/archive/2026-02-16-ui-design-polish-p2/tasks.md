## 1. Layout and Navigation

- [x] 1.1 Increase main content top padding in Layout.tsx (pt-14 → pt-18) for h1 breathing room
- [x] 1.2 Change back navigation links from text-sm to text-base font-medium in SpecDetail.tsx and ChangeDetail.tsx

## 2. Tab Fixes

- [x] 2.1 Swap tab order in ChangeDetail.tsx: move Specs before Tasks (Proposal → Design → Specs → Tasks)
- [x] 2.2 Add fade-in CSS animation to TabView.tsx content panel with key-based re-render (150ms)
- [x] 2.3 Add prefers-reduced-motion media query to disable tab animation

## 3. List Enhancements

- [x] 3.1 Add history count display to SpecList.tsx spec items (use existing historyCount from SpecInfo)
- [x] 3.2 Add left accent border (border-l-4 border-accent) to active change cards in ChangeList.tsx

## 4. Search Improvements

- [x] 4.1 Create highlightMatch utility function for marking matched text fragments
- [x] 4.2 Apply highlight to search result titles and context in SearchDialog.tsx ResultItem
- [x] 4.3 Add type filter toggle (All / Specs / Changes) to SearchDialog.tsx
- [x] 4.4 Improve empty state message with search suggestions

## 5. Task Checkbox Styling

- [x] 5.1 Replace text-based [x]/[ ] with custom SVG checkmark/circle icons in ChangeDetail.tsx Tasks tab
- [x] 5.2 Add opacity-60 to completed task items

## 6. Verification

- [x] 6.1 Visual test with agent-browser: verify h1 spacing, tab order, back links, animations across pages
- [x] 6.2 Run type-check to ensure no TypeScript errors
- [x] 6.3 Rebuild demo page and verify changes apply
