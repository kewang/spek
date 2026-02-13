## 1. Theme Toggle

- [x] 1.1 Define light theme CSS variables in `global.css` under `[data-theme="light"]` selector
- [x] 1.2 Create `ThemeContext` with theme state, toggle function, localStorage persistence (`spek:theme`), and system preference detection
- [x] 1.3 Wrap app with `ThemeProvider` in `main.tsx`, set `data-theme` attribute on `<html>`
- [x] 1.4 Add theme toggle button (sun/moon icon) to Layout header

## 2. Responsive Layout

- [x] 2.1 Add `sidebarOpen` state and mobile breakpoint detection (`matchMedia 768px`) to Layout
- [x] 2.2 Refactor Sidebar to accept `open`/`onClose` props; render as overlay with backdrop on mobile, fixed on desktop
- [x] 2.3 Add hamburger menu button to header (visible only on mobile)
- [x] 2.4 Update main content area to remove fixed `ml-60` on mobile
- [x] 2.5 Update header to hide repo path on mobile
- [x] 2.6 Update Dashboard stat cards grid to `grid-cols-2 md:grid-cols-4` and navigation cards to stack on mobile

## 3. Recent Path Enhancement

- [x] 3.1 Add async path validation in SelectRepo — call detect API for each recent path on mount
- [x] 3.2 Display status indicators for each recent path: spinner (checking), green checkmark (valid), red indicator (invalid)
- [x] 3.3 Add delete button for individual recent paths, update localStorage on removal

## 4. Spec History

- [x] 4.1 Extend `readSpec()` in `scanner.ts` to return `history` array with `{ slug, date, description, status }` for each related change
- [x] 4.2 Update `useSpec` hook type to include `history` field
- [x] 4.3 Add history timeline UI section to SpecDetail page with date, description, and link to change

## 5. Verification

- [x] 5.1 Verify theme toggle works: dark ↔ light, persists across reload, respects system preference on first visit
- [x] 5.2 Verify responsive layout: sidebar collapses on mobile, overlay works, grids adapt
- [x] 5.3 Verify recent paths show validation status and allow deletion
- [x] 5.4 Verify spec history timeline displays correctly with links to changes
- [x] 5.5 Run `npm run type-check` and `npm run build` to confirm no errors
