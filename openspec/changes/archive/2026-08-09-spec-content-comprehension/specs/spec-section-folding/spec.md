## ADDED Requirements

### Requirement: Spec content folds by requirement and scenario

When folding is enabled for a rendered document, the renderer SHALL group the content into collapsible
sections at heading levels 3 and 4. A level-3 section (`### Requirement:`) SHALL render **expanded**,
showing its heading and its body. A level-4 section (`#### Scenario:`) SHALL render with its heading
visible and its body **collapsed**.

Headings above level 3 SHALL NOT be folded; they remain plain separators, so no control ever hides the
whole document. Content appearing before the first level-3 heading SHALL render unfolded in place.

The default state exists so that the first screen of a spec shows every requirement together with the
prose stating what it requires, while the scenario detail — the majority of the text — is held back
until asked for.

#### Scenario: Default state on opening a spec

- **WHEN** a spec containing `### Requirement:` and `#### Scenario:` headings is rendered with folding enabled
- **THEN** each requirement section is expanded and its body is visible
- **AND** each scenario section shows only its heading, with its body collapsed

#### Scenario: Higher-level headings are not folded

- **WHEN** the content contains `##` headings such as `## Purpose`, `## Requirements` or `## ADDED Requirements`
- **THEN** those headings render as plain headings with no fold control

#### Scenario: Content before the first requirement

- **WHEN** prose appears after a `##` heading but before the first `###` heading
- **THEN** that prose renders unfolded, in its original position

#### Scenario: Document with nothing to fold

- **WHEN** a document contains no `###` or `####` headings
- **THEN** the rendered output is identical to rendering the same document with folding disabled

### Requirement: Section boundaries follow heading depth

A folded section SHALL contain every node from its heading up to, but excluding, the next heading of the
same level or shallower. Level-4 sections SHALL nest inside the level-3 section that precedes them.

This boundary rule is the one part of folding that can silently produce wrong output — a mis-scoped
boundary absorbs a following requirement into the previous one, which reads as content loss rather than
as a layout bug — so it SHALL be implemented as a pure transformation over the document tree and
verified directly.

#### Scenario: A requirement ends where the next begins

- **WHEN** a `###` section is followed by another `###` heading
- **THEN** the first section contains every node between the two headings and does not contain the second heading

#### Scenario: A scenario ends at a shallower heading

- **WHEN** a `####` section is followed by a heading of level 3 or shallower
- **THEN** the scenario section ends before that heading

#### Scenario: Scenarios nest inside their requirement

- **WHEN** a `###` section contains several `####` headings
- **THEN** each scenario section is contained within that requirement's section
- **AND** collapsing the requirement hides its scenarios with it

#### Scenario: A scenario with no preceding requirement

- **WHEN** a `####` heading appears before any `###` heading
- **THEN** it forms a top-level folded section and no content is dropped

### Requirement: Folding preserves heading identity and native disclosure semantics

A folded section's heading element SHALL be preserved intact — including any `id` it carries — and SHALL
remain present in the document as the fold's handle whether the section is open or closed. Assigning
heading anchor ids SHALL happen before sectioning, so that ids are unchanged from rendering the same
document unfolded.

Folding SHALL use the platform's native disclosure element rather than application-managed visibility,
so that the host's own find-in-page, keyboard activation and assistive-technology reporting apply
without reimplementation.

#### Scenario: Heading ids survive folding

- **WHEN** a document is rendered with folding enabled and again with folding disabled
- **THEN** every heading carries the same `id` in both renderings

#### Scenario: A collapsed section's heading is still addressable

- **WHEN** a section is collapsed
- **THEN** its heading element remains in the document and can be located by its `id`

#### Scenario: Keyboard operation

- **WHEN** the user moves focus to a fold handle and presses Enter or Space
- **THEN** that section toggles between open and closed

### Requirement: Expand all and collapse all

The user SHALL be able to open every section in the document at once, and to close every section at
once. Collapse all SHALL close requirement sections as well as scenario sections.

#### Scenario: Expand all

- **WHEN** the user activates Expand all
- **THEN** every requirement and scenario section in the document is open

#### Scenario: Collapse all

- **WHEN** the user activates Collapse all
- **THEN** every requirement and scenario section in the document is closed, leaving only headings visible

### Requirement: Fold preference persists across specs and sessions

Choosing Expand all or Collapse all SHALL be remembered and applied to subsequently rendered spec
content, including after a reload, until the user chooses otherwise. The preference is global rather
than per section or per spec: which individual sections a reader happened to open SHALL NOT be
persisted.

Where persistent storage is unavailable — an embedded host, a privacy mode — the renderer SHALL fall
back to the default state silently, with the preference applying for the current session only, and SHALL
NOT surface an error.

#### Scenario: Preference applies to the next spec

- **WHEN** the user activates Collapse all on one spec and then navigates to a different spec
- **THEN** that spec renders with every section collapsed

#### Scenario: Preference survives a reload

- **WHEN** the user activates Expand all and then reloads the application
- **THEN** spec content renders with every section expanded

#### Scenario: Storage unavailable

- **WHEN** persistent storage cannot be read or written
- **THEN** content renders in the default state, no error is shown, and the controls still work for the current session

### Requirement: Navigating to a heading reveals it

Before scrolling to a heading, the renderer SHALL open every folded section enclosing that heading. This
SHALL apply to every route into a heading: activating a table-of-contents entry, loading a page whose
URL carries a matching `#hash`, and a host command that navigates to a route with a hash.

Without this, a reader who asks to go to a requirement arrives at a heading with nothing under it.

#### Scenario: Table of contents entry into collapsed content

- **WHEN** every section is collapsed and the user activates a TOC entry
- **THEN** the sections enclosing that heading are opened and the heading is scrolled into view

#### Scenario: Hash anchor on load

- **WHEN** the page is opened with a `#hash` naming a heading inside a collapsed section
- **THEN** the enclosing sections are opened before the page scrolls to that heading

#### Scenario: Host navigation command

- **WHEN** an extension host issues a navigate command for a route carrying a hash
- **THEN** the target heading is revealed on the same terms as a hash present at load

### Requirement: Folding applies only to spec content

Folding SHALL be enabled for spec-shaped content only: a spec's detail view and a change's delta specs.
Every other rendered artifact — a change's proposal, design, tasks or any other markdown artifact — and
the spec diff view SHALL render unfolded.

The renderer is shared across all of these, so folding SHALL be requested by the caller rather than
inferred from the content.

#### Scenario: A change's markdown artifacts are not folded

- **WHEN** a change's proposal, design or tasks artifact is rendered
- **THEN** its content renders unfolded, exactly as before this capability existed

#### Scenario: Delta specs are folded

- **WHEN** a change's specs artifact is rendered
- **THEN** each delta spec's requirements and scenarios fold on the same rules as a spec detail view

#### Scenario: The diff view is not folded

- **WHEN** a spec is displayed as a comparison against a change
- **THEN** the comparison renders unfolded
