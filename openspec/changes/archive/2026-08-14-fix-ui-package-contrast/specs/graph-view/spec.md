## MODIFIED Requirements

### Requirement: Node visual encoding
The system SHALL render spec nodes as circles and change nodes as rounded rectangles. Spec node radius SHALL scale with `historyCount` (minimum 20px, maximum 45px). Change node size SHALL scale with `specCount` (number of specs modified). Spec nodes SHALL use the accent color (amber). Change nodes SHALL use green for active status and blue-gray for archived status.

Each of those colours SHALL come from the package's colour contract rather than from a literal, so that a
host's theme reaches them: the spec node from the accent property, the archived change node from the muted
text property, and the active change node from a property of its own, since no existing one expresses it.
A node's colour states its kind and its status with no text beside it, so it SHALL meet at least 3:1
against the least favourable of the host's surfaces in every theme the host offers.

Where a node is drawn with both a fill and a stroke, the stroke SHALL be the same contract colour as the
fill rather than a separate value. A rim one step lighter than its fill is a dark-theme assumption — on a
light background the rim has to darken instead — and the package cannot know which way to move.

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

#### Scenario: Node colours follow the host's theme
- **WHEN** a host renders the graph with a light theme
- **THEN** every node's fill and stroke resolve from the contract to that theme's values
- **AND** each meets at least 3:1 against the least favourable of the host's surfaces

### Requirement: Edge rendering
The system SHALL render edges as lines connecting change nodes to the spec nodes they modified. Edges SHALL use a muted color by default. When a node is hovered, its connected edges SHALL be highlighted.

An edge is the only thing stating that a change touched a spec, so it SHALL meet at least 3:1 against the
least favourable of the host's surfaces in every theme. It SHALL NOT be drawn in the contract's border
colour: that value is a panel hairline — 1.22:1 dark and 1.13:1 light **at full strength** — so no opacity
of it can satisfy the floor.

#### Scenario: Edge display
- **WHEN** change "phase3-markdown-and-search" modified specs "markdown-renderer" and "search-ui"
- **THEN** two edges are drawn from the change node to each respective spec node

#### Scenario: Edges are visible in every theme
- **WHEN** the graph is rendered in either theme
- **THEN** each edge meets at least 3:1 against the least favourable of the host's surfaces

### Requirement: Hover highlight interaction
The system SHALL highlight a node and its connected neighbors when the user hovers over it. All non-connected nodes and edges SHALL reduce opacity to 0.1. The hovered node, its neighbors, and their connecting edges SHALL remain at full opacity.

This dimming is a **stated exemption** from the contrast floor, not a satisfaction of it. It is permitted
because it is a pointer-driven emphasis state that reverts when the pointer leaves, and nothing is
available only while it is active — every dimmed node is fully legible in the graph's resting state. The
exemption is limited to that shape: a de-emphasis that the reader causes, that ends when they stop causing
it, and that hides nothing.

The exemption is claimed against a measurement, and the measurement is stated exactly. A node label in the
light theme holds 2.82:1 at 0.6 opacity and 4.41:1 at 0.8, and clears the 4.5:1 floor from **α ≈ 0.81**
(dark, α ≈ 0.73). So a conforming dimming does exist — at a strength no reader would perceive as dimming.
The choice was therefore this exemption, dimming the graphics while leaving every label at full strength,
or hiding the non-connected labels outright; it is a judgement about what de-emphasis means, not a claim
that no value passes.

#### Scenario: Hover on spec node
- **WHEN** user hovers over spec node "markdown-renderer"
- **THEN** the "markdown-renderer" node, all change nodes connected to it, and their edges are highlighted at full opacity
- **AND** all other nodes and edges reduce to 0.1 opacity

#### Scenario: Hover off
- **WHEN** user moves the cursor away from all nodes
- **THEN** all nodes and edges return to full opacity

#### Scenario: The dimmed state ends on its own
- **WHEN** the pointer leaves the graph without any further action
- **THEN** every dimmed node and edge returns to full strength
- **AND** no information was reachable only while they were dimmed

### Requirement: Graph legend
The system SHALL display a legend overlay in a corner of the graph container, showing the meaning of node shapes and colors: amber circle = Spec, green rectangle = Active Change, blue-gray rectangle = Archived Change.

Each swatch SHALL take the same contract colour as the node kind it explains. A legend drawn from its own
literals states the key in colours the graph may not be using.

#### Scenario: Legend display
- **WHEN** the graph is rendered
- **THEN** a legend is visible showing node type indicators with labels

#### Scenario: Swatch matches the node it explains
- **WHEN** the graph is rendered in either theme
- **THEN** each legend swatch is the same colour as the nodes of that kind
