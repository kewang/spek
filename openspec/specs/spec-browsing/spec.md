## Purpose

Provide the spec list and the single-spec reading experience, including its table of contents and change history.

## Requirements
### Requirement: Spec list with filtering
The system SHALL display all specs sorted alphabetically with history count metadata. A filter input SHALL allow instant client-side filtering by spec topic name. Each spec item SHALL display the topic name and the number of related changes (history count) as secondary information.

#### Scenario: Display all specs
- **WHEN** user navigates to the SpecList page
- **THEN** all spec topics are listed alphabetically, each showing the topic name and history change count

#### Scenario: Filter specs
- **WHEN** user types in the filter input
- **THEN** the list is filtered in real-time to show only specs whose topic name contains the search text (case-insensitive)

#### Scenario: Spec with no history
- **WHEN** a spec has zero related changes
- **THEN** the history count is not displayed (or shows "No changes")

### Requirement: Spec detail display
The system SHALL display the full content of a spec when the user navigates to its detail page. The
content SHALL be rendered as Markdown, with its requirements and scenarios folded according to the
spec section folding capability, and SHALL offer the controls to expand and collapse every section.

#### Scenario: View spec content
- **WHEN** user navigates to `/specs/:topic`
- **THEN** system displays the spec topic as title and the full spec.md content, rendered as Markdown

#### Scenario: Requirements and scenarios are folded
- **WHEN** the rendered spec contains requirement and scenario headings
- **THEN** each requirement is shown expanded and each scenario is shown collapsed, with controls available to expand or collapse all sections

#### Scenario: Spec not found
- **WHEN** user navigates to a spec topic that does not exist
- **THEN** system displays a "not found" message

### Requirement: Related changes display
The spec detail page SHALL display a list of changes that affect the spec (from the API's `relatedChanges` field). Each change SHALL be a link to its detail page.

#### Scenario: Show related changes
- **WHEN** viewing a spec that has related changes
- **THEN** a "Related Changes" section lists each change as a clickable link to `/changes/:slug`

#### Scenario: No related changes
- **WHEN** viewing a spec with no related changes
- **THEN** the "Related Changes" section shows an empty state message

### Requirement: Spec detail TOC sidebar
The spec detail page (`/specs/:topic`) SHALL display a sticky table-of-contents (TOC) sidebar listing all `h2` and `h3` headings of the spec content when the heading count is at least 3 and the viewport width is at least 1280px. Each TOC entry SHALL be a clickable link that smooth-scrolls the main content to the corresponding heading. `h3` entries SHALL be visually indented relative to `h2` entries.

#### Scenario: TOC visible for long spec
- **WHEN** user views a spec whose content contains 3 or more `h2`/`h3` headings on a viewport at least 1280px wide
- **THEN** a sticky TOC sidebar appears alongside the main content listing every `h2` and `h3` heading in document order

#### Scenario: TOC hidden for short spec
- **WHEN** user views a spec whose content contains fewer than 3 `h2`/`h3` headings
- **THEN** no TOC sidebar is rendered and the main content occupies the full available width

#### Scenario: TOC hidden on narrow viewport
- **WHEN** user views any spec on a viewport narrower than 1280px
- **THEN** the TOC sidebar is not rendered and the main content occupies the full available width

#### Scenario: Click TOC entry
- **WHEN** user clicks a TOC entry
- **THEN** the main content smooth-scrolls to the corresponding heading and the URL hash updates to that heading's slug

#### Scenario: Indented h3 entries
- **WHEN** the TOC contains both `h2` and `h3` entries
- **THEN** each `h3` entry is visually indented relative to its preceding `h2` entry

### Requirement: Spec detail scrollspy
The spec detail page SHALL highlight the TOC entry corresponding to the heading currently closest to the top of the viewport while the user scrolls (scrollspy behavior). The threshold that decides whether a heading has been scrolled past SHALL be the same measured header bottom that hash-anchor scrolling uses, and the comparison SHALL tolerate a few pixels of rounding, so the heading a reader just scrolled to via the TOC is the one highlighted.

#### Scenario: Active entry on scroll
- **WHEN** the user scrolls the spec detail content and a heading enters the top region of the viewport
- **THEN** the TOC entry matching that heading is visually highlighted as active

#### Scenario: Only one active entry
- **WHEN** multiple headings are simultaneously visible in the viewport
- **THEN** exactly one TOC entry is highlighted as active (the heading closest to the top)

#### Scenario: The clicked entry is the highlighted one
- **WHEN** the user clicks a TOC entry and the page finishes scrolling that heading to just below the header
- **THEN** the clicked entry — not the one before it — is highlighted

### Requirement: Spec detail hash anchor navigation
The spec detail page SHALL scroll to the heading matching the URL hash when the page mounts or when the hash changes, after the markdown content finishes rendering. The scroll SHALL position the target heading in the visible area **below** any sticky or fixed header rather than at the literal viewport top, with the offset measured from the actual rendered header at scroll time (falling back to the fixed app header, then a constant) rather than a fixed assumed height. The header SHALL be measured as it sits once pinned, so the offset does not drift with the reader's current scroll position.

#### Scenario: Direct link with hash
- **WHEN** user opens a URL such as `/specs/foo#requirement-bar` directly
- **THEN** after the page loads and content renders, the page scrolls so the heading whose slug is `requirement-bar` sits fully visible just below the fixed header

#### Scenario: Hash change while on page
- **WHEN** the URL hash changes (e.g., user clicks a TOC entry or another in-page hash link) while already on the spec detail page
- **THEN** the page scrolls so the target heading lands just below the header, not behind it

#### Scenario: Hash with no matching heading
- **WHEN** the URL hash does not match any heading slug on the current spec
- **THEN** no scrolling occurs and the page renders at its default scroll position

### Requirement: TOC entries read as the content reads

Each entry in the spec detail TOC sidebar SHALL be labelled with the same display text the rendered
content shows for that heading, so that a reader looking for a requirement in the sidebar is looking for
the words they can see in the page. Where the content displays a requirement heading without its
OpenSpec format keyword, the TOC entry SHALL omit it too.

Navigation SHALL be unaffected: each entry SHALL continue to link by the slug derived from the heading's
authored text. Only the label changes, so a TOC built from the file and content rendered from the same
file continue to address the same anchors.

#### Scenario: A requirement entry drops the format keyword

- **WHEN** a spec containing `### Requirement: Foo` is viewed with the TOC sidebar visible
- **THEN** the TOC entry for that heading reads `Foo`

#### Scenario: The entry still navigates to its heading

- **WHEN** the user clicks that TOC entry
- **THEN** the main content scrolls to the heading and the URL hash is the slug of the authored text, unchanged from before the label was elided

#### Scenario: An entry with no format keyword is unchanged

- **WHEN** the spec contains `## Purpose`
- **THEN** its TOC entry reads `Purpose`
