## ADDED Requirements

### Requirement: Graph page route
The system SHALL provide a `/graph` route that renders the Graph View page within the shared Layout. The page SHALL be accessible from all three modes (Web, VS Code Webview, Demo).

#### Scenario: Navigate to graph page
- **WHEN** user navigates to `/graph`
- **THEN** the Graph View page is rendered within the Layout with sidebar and header visible

#### Scenario: Graph page in demo mode
- **WHEN** the demo build is loaded
- **AND** user navigates to `/graph`
- **THEN** the Graph View page renders using static graph data from `window.__DEMO_DATA__`

### Requirement: Graph data fetching
The system SHALL fetch graph data (nodes and edges) from the API adapter when the Graph View page loads. While loading, the page SHALL display a loading indicator. If the fetch fails, an error message SHALL be displayed.

#### Scenario: Successful data load
- **WHEN** the Graph View page mounts
- **THEN** the system calls `getGraphData()` on the API adapter
- **AND** renders the force-directed graph with the returned nodes and edges

#### Scenario: Loading state
- **WHEN** graph data is being fetched
- **THEN** a loading indicator is displayed in the graph container

#### Scenario: Error state
- **WHEN** graph data fetch fails
- **THEN** an error message is displayed with the failure reason

### Requirement: Force-directed graph layout
The system SHALL render an interactive force-directed graph using D3 force simulation. Spec nodes and change nodes SHALL be positioned by the simulation with forces: center force, link force (connecting edges), many-body repulsion force, and collision force to prevent overlap.

#### Scenario: Initial layout
- **WHEN** graph data is loaded with specs and changes
- **THEN** a force-directed simulation positions all nodes within the SVG viewport
- **AND** the simulation runs until convergence (alpha < 0.001)

#### Scenario: Empty graph
- **WHEN** graph data contains no nodes with edges (no changes have specs)
- **THEN** the page displays a message indicating no relationships to visualize

### Requirement: Node visual encoding
The system SHALL render spec nodes as circles and change nodes as rounded rectangles. Spec node radius SHALL scale with `historyCount` (minimum 20px, maximum 45px). Change node size SHALL scale with `specCount` (number of specs modified). Spec nodes SHALL use the accent color (amber). Change nodes SHALL use green for active status and blue-gray for archived status.

#### Scenario: Spec node sizing
- **WHEN** a spec has `historyCount` of 5 (highest in the dataset)
- **THEN** its circle radius is at or near the maximum (45px)

#### Scenario: Spec node with no history
- **WHEN** a spec has `historyCount` of 0
- **THEN** its circle radius is at the minimum (20px)

#### Scenario: Change node coloring
- **WHEN** a change has `status: "active"`
- **THEN** its rectangle uses a green color scheme
- **WHEN** a change has `status: "archived"`
- **THEN** its rectangle uses a blue-gray color scheme

### Requirement: Node labels
The system SHALL display text labels next to each node. Spec labels SHALL show the topic name. Change labels SHALL show the description (derived from slug). Labels longer than 25 characters SHALL be truncated with ellipsis.

#### Scenario: Spec label display
- **WHEN** a spec node with topic "markdown-renderer" is rendered
- **THEN** a text label "markdown-renderer" is displayed adjacent to the node

#### Scenario: Long change label truncation
- **WHEN** a change with description "phase3 markdown and search improvements" is rendered
- **THEN** the label is truncated to 25 characters with "..." appended

### Requirement: Edge rendering
The system SHALL render edges as lines connecting change nodes to the spec nodes they modified. Edges SHALL use a muted color by default. When a node is hovered, its connected edges SHALL be highlighted.

#### Scenario: Edge display
- **WHEN** change "phase3-markdown-and-search" modified specs "markdown-renderer" and "search-ui"
- **THEN** two edges are drawn from the change node to each respective spec node

### Requirement: Drag interaction
The system SHALL support dragging nodes to reposition them. During drag, the dragged node's position SHALL be fixed. After releasing, the node SHALL remain at its dragged position until the simulation is restarted.

#### Scenario: Drag a node
- **WHEN** user clicks and drags a spec node
- **THEN** the node follows the cursor
- **AND** connected edges update in real-time
- **AND** the force simulation reheats to adjust surrounding nodes

### Requirement: Hover highlight interaction
The system SHALL highlight a node and its connected neighbors when the user hovers over it. All non-connected nodes and edges SHALL reduce opacity to 0.1. The hovered node, its neighbors, and their connecting edges SHALL remain at full opacity.

#### Scenario: Hover on spec node
- **WHEN** user hovers over spec node "markdown-renderer"
- **THEN** the "markdown-renderer" node, all change nodes connected to it, and their edges are highlighted at full opacity
- **AND** all other nodes and edges reduce to 0.1 opacity

#### Scenario: Hover off
- **WHEN** user moves the cursor away from all nodes
- **THEN** all nodes and edges return to full opacity

### Requirement: Click navigation
The system SHALL navigate to the detail page when a node is clicked (without dragging). Clicking a spec node SHALL navigate to `/specs/:topic`. Clicking a change node SHALL navigate to `/changes/:slug`.

#### Scenario: Click spec node
- **WHEN** user clicks (without dragging) on spec node "api-adapter"
- **THEN** the app navigates to `/specs/api-adapter`

#### Scenario: Click change node
- **WHEN** user clicks (without dragging) on change node "2026-02-13-initial-implementation"
- **THEN** the app navigates to `/changes/2026-02-13-initial-implementation`

### Requirement: Zoom and pan
The system SHALL support zooming (scroll wheel or pinch) and panning (click-and-drag on empty space) of the graph viewport. Zoom SHALL be constrained between 0.3x and 3x. The graph SHALL initially be centered and scaled to fit all nodes within the viewport.

#### Scenario: Zoom in
- **WHEN** user scrolls up (or pinch-zooms in) on the graph
- **THEN** the graph zooms in, up to a maximum of 3x

#### Scenario: Zoom out
- **WHEN** user scrolls down (or pinch-zooms out) on the graph
- **THEN** the graph zooms out, down to a minimum of 0.3x

#### Scenario: Pan
- **WHEN** user clicks and drags on empty space (not on a node)
- **THEN** the entire graph viewport pans in the drag direction

#### Scenario: Initial fit
- **WHEN** the graph first renders
- **THEN** the viewport is scaled and centered to show all nodes within the visible area

### Requirement: Graph legend
The system SHALL display a legend overlay in a corner of the graph container, showing the meaning of node shapes and colors: amber circle = Spec, green rectangle = Active Change, blue-gray rectangle = Archived Change.

#### Scenario: Legend display
- **WHEN** the graph is rendered
- **THEN** a legend is visible showing node type indicators with labels
