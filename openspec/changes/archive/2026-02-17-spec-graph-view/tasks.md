## 1. Core: Graph Data Builder

- [x] 1.1 Define `GraphData`, `GraphNode`, `GraphEdge` types in `packages/core/src/types.ts`
- [x] 1.2 Implement `buildGraphData(repoDir)` function in `packages/core/src/scanner.ts`
- [x] 1.3 Export `buildGraphData` and new types from `packages/core/src/index.ts`

## 2. API: Graph Endpoint and Adapter

- [x] 2.1 Add `GET /api/openspec/graph` route in Express server
- [x] 2.2 Add `getGraphData()` to `ApiAdapter` interface in `packages/web/src/api/types.ts`
- [x] 2.3 Implement `getGraphData()` in `FetchAdapter`
- [x] 2.4 Implement `getGraphData()` in `MessageAdapter`
- [x] 2.5 Implement `getGraphData()` in `StaticAdapter` (read from `window.__DEMO_DATA__.graphData`)

## 3. VS Code Extension: Handler

- [x] 3.1 Add `getGraphData` message handler in extension host (`handler.ts`)

## 4. Frontend: Graph View Page

- [x] 4.1 Install D3 dependencies (`d3-force`, `d3-selection`, `d3-zoom`, `d3-drag`, `@types/d3-*`)
- [x] 4.2 Create `GraphView` page component with data fetching, loading, and error states
- [x] 4.3 Implement force-directed simulation (center, link, many-body, collision forces)
- [x] 4.4 Render spec nodes (circles, amber, scaled by historyCount) and change nodes (rounded rects, green/blue-gray by status)
- [x] 4.5 Render edges (lines connecting change → spec nodes)
- [x] 4.6 Render node labels (topic/description, truncated at 25 chars)
- [x] 4.7 Implement drag interaction (D3 drag behavior, fix position on drag)
- [x] 4.8 Implement hover highlight (connected nodes/edges at full opacity, others at 0.1)
- [x] 4.9 Implement click navigation (spec → `/specs/:topic`, change → `/changes/:slug`)
- [x] 4.10 Implement zoom and pan (D3 zoom, 0.3x–3x extent, initial fit-to-viewport)
- [x] 4.11 Add graph legend overlay (node type indicators)

## 5. Integration: Routing and Sidebar

- [x] 5.1 Add `/graph` route to React Router config in `App.tsx` (and WebviewApp/DemoApp if separate)
- [x] 5.2 Add "Graph" navigation link with icon to Sidebar component

## 6. Demo Build

- [x] 6.1 Update demo build script (`scripts/build-demo.ts`) to include `graphData` in `__DEMO_DATA__`
