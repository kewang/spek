## Purpose

渲染 OpenSpec markdown（含 GFM 與 BDD 語法高亮），統一各前端的內容呈現。

## Requirements

### Requirement: Markdown content rendering
The system SHALL render Markdown content using react-markdown with remark-gfm plugin, supporting GFM features including tables, strikethrough, and task lists.

#### Scenario: Standard Markdown rendering
- **WHEN** MarkdownRenderer receives a string containing standard Markdown (headings, lists, bold, italic, links, code blocks)
- **THEN** the content is rendered as formatted HTML with appropriate styling

#### Scenario: GFM table rendering
- **WHEN** MarkdownRenderer receives content containing a GFM pipe table
- **THEN** the table is rendered as a styled HTML table with header row and data rows

#### Scenario: GFM checkbox rendering
- **WHEN** MarkdownRenderer receives content containing `- [x]` or `- [ ]` items
- **THEN** the items are rendered as visual checkboxes (read-only)

### Requirement: BDD keyword highlighting
The system SHALL visually highlight BDD keywords in rendered Markdown content to improve readability of spec documents.

Highlighting SHALL NOT reduce the font weight already applied by the surrounding markup.

Every delta operation OpenSpec defines SHALL be marked, not a subset of them. A marked vocabulary with
gaps in it is read as meaning that the unmarked words are ordinary prose, which is the opposite of what
an unhandled operation is.

Colour SHALL distinguish meanings rather than repeat them: an operation SHALL NOT be given the colour
already carrying normative force, so that a reader who has learned one mark does not have to unlearn it.

#### Scenario: WHEN/GIVEN keyword highlighting
- **WHEN** rendered Markdown contains the word `WHEN` or `GIVEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a blue background label style (blue text on blue-tinted background)

#### Scenario: THEN keyword highlighting
- **WHEN** rendered Markdown contains the word `THEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a green background label style (green text on green-tinted background)

#### Scenario: AND keyword highlighting
- **WHEN** rendered Markdown contains the word `AND` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a gray background label style (gray text on gray-tinted background)

#### Scenario: MUST/SHALL keyword highlighting
- **WHEN** rendered Markdown contains `MUST` or `SHALL` as standalone uppercase keywords
- **THEN** the keywords are displayed in red bold text

#### Scenario: Delta operation badge rendering
- **WHEN** rendered Markdown contains `ADDED`, `MODIFIED`, `REMOVED` or `RENAMED` as standalone uppercase keywords
- **THEN** `ADDED` is displayed as an orange badge and `MODIFIED` is displayed as a blue badge, as before
- **AND** `REMOVED` and `RENAMED` are each displayed as a badge in a colour distinct from those two and from each other

#### Scenario: No operation takes the normative colour
- **WHEN** the delta operation badges are compared with the `MUST`/`SHALL` styling
- **THEN** no operation badge uses the colour that marks normative keywords

#### Scenario: Highlighting does not weaken author emphasis
- **WHEN** a BDD keyword appears inside Markdown emphasis, such as `**SHALL**`
- **THEN** the rendered keyword is no lighter in weight than the emphasis the author applied

#### Scenario: Keywords inside code blocks are not highlighted
- **WHEN** BDD keywords appear inside inline code or fenced code blocks
- **THEN** the keywords are NOT highlighted and remain as plain code text

#### Scenario: Case-sensitive matching
- **WHEN** text contains lowercase or mixed-case variations like "when", "Then", "must"
- **THEN** the keywords are NOT highlighted (only exact uppercase matches trigger highlighting)

### Requirement: Dark theme styling
The system SHALL apply dark theme styles consistent with the application's design system (background #0a0c0f series, amber accent, text #e2e8f0).

#### Scenario: Code block styling
- **WHEN** MarkdownRenderer renders a fenced code block
- **THEN** the code block uses a dark background with monospace font and appropriate padding

#### Scenario: Link styling
- **WHEN** MarkdownRenderer renders a hyperlink
- **THEN** the link is displayed in accent color (amber) with hover effect

#### Scenario: Heading styling
- **WHEN** MarkdownRenderer renders headings (h1-h6)
- **THEN** headings use appropriate font sizes and weights consistent with the dark theme

### Requirement: Timestamp display format
All timestamps displayed in the UI SHALL use YYYY-MM-DD absolute date format consistently across all pages.

#### Scenario: Dashboard active changes
- **WHEN** the Dashboard displays an active change with a git timestamp
- **THEN** the timestamp is shown in YYYY-MM-DD format

#### Scenario: Dashboard archived changes
- **WHEN** the Dashboard displays an archived change with a git timestamp
- **THEN** the timestamp is shown in YYYY-MM-DD format

#### Scenario: ChangeList timestamps
- **WHEN** the ChangeList displays changes with git timestamps
- **THEN** all timestamps are shown in YYYY-MM-DD format

#### Scenario: SpecDetail history timestamps
- **WHEN** the SpecDetail page displays revision history entries
- **THEN** all timestamps are shown in YYYY-MM-DD format

#### Scenario: Fallback when no git timestamp
- **WHEN** a change or spec has no git timestamp but has a date field
- **THEN** the date field (already YYYY-MM-DD) is displayed as-is

### Requirement: Heading anchor ids
The MarkdownRenderer SHALL assign a deterministic, slug-based `id` attribute to every rendered `h2` and `h3` element so they can be targeted by URL hash anchors and TOC links. The slug for a heading SHALL match the slug produced by the shared `slugifyHeading` utility in `@spekjs/core`.

#### Scenario: h2 receives slug id
- **WHEN** MarkdownRenderer renders an `h2` heading with text `Requirement: Spec list with filtering`
- **THEN** the rendered `<h2>` element has `id="requirement-spec-list-with-filtering"`

#### Scenario: h3 receives slug id
- **WHEN** MarkdownRenderer renders an `h3` heading with text `Scenario: Display all specs`
- **THEN** the rendered `<h3>` element has `id="scenario-display-all-specs"`

#### Scenario: Duplicate heading text
- **WHEN** the same heading text appears twice in one document
- **THEN** the first occurrence uses the base slug and subsequent occurrences are suffixed with `-2`, `-3`, etc., matching the `extractHeadings` numbering

#### Scenario: Slug consistency with core utility
- **WHEN** any heading is rendered by MarkdownRenderer
- **THEN** its `id` exactly equals the `slug` produced by `extractHeadings(content)` from `@spekjs/core` for the same heading

### Requirement: Rendered content is readable in every theme

Every colour the renderer applies to text — BDD keywords, badges, inline code, spec references — SHALL
be defined per theme rather than as one value shared by all themes, and SHALL meet WCAG 2 AA contrast of
at least 4.5:1 against the background it is actually rendered on, which for a keyword is its own label
background composited over the page.

This requirement exists because the capability previously stated obligations for the dark theme only.
No light-theme value was ever asserted, so none could fail, and every mark drifted to a value that is
unreadable there — `THEN` reached 1.43:1 while the specification remained satisfied.

Hue is not required to change between themes: the obligation is contrast, not appearance.

#### Scenario: Marks are readable in the light theme

- **WHEN** spec content is rendered with the light theme active
- **THEN** every BDD keyword, badge, inline code span and spec reference meets at least 4.5:1 contrast against its own background

#### Scenario: Marks are readable in the dark theme

- **WHEN** spec content is rendered with the dark theme active
- **THEN** every BDD keyword, badge, inline code span and spec reference meets at least 4.5:1 contrast against its own background

#### Scenario: Colours are theme-scoped

- **WHEN** the active theme changes
- **THEN** each mark takes that theme's own colour value rather than one value shared across themes

### Requirement: Spec-shaped content is typeset by its own rules

The renderer SHALL accept, from its caller, a declaration that the content being rendered is
spec-shaped, and SHALL apply spec typography only under that declaration. It SHALL NOT decide this by
matching the text of the content.

In a spec-shaped document every level-2 heading is a structural separator — `## Purpose`,
`## Requirements`, `## ADDED Requirements` — whereas in a proposal or design document a level-2 heading
carries the content itself. One typography cannot serve both, and the styling suited to the second makes
the first outrank the requirements it merely groups.

Under that declaration, a level-2 heading SHALL be rendered as a subordinate label: less prominent than
the level-3 requirement headings beneath it, and less prominent than whatever names the document as a
whole. It SHALL NOT, however, be rendered less prominently than the level-4 headings nested inside those
requirements — demoting it past them would restore the same inversion one level down. Its heading
element and any `id` it carries SHALL be unchanged, because heading level determines where folded
sections end and heading ids are addressable anchors.

The declaration SHALL be independent of whether folding is requested. Folding is a view state its
reader controls and may switch off; being spec-shaped is a property of the document that no preference
alters. Deriving one from the other would let a display preference restyle the document's headings.

#### Scenario: A delta operation heading does not outrank its requirements

- **WHEN** spec-shaped content containing `## ADDED Requirements` followed by `### Requirement:` headings is rendered
- **THEN** the level-2 heading is rendered less prominently than the level-3 headings that follow it
- **AND** it is not rendered less prominently than the level-4 headings nested within them

#### Scenario: A main spec's structural headings are demoted on the same terms

- **WHEN** a spec's own detail view renders content containing `## Purpose` and `## Requirements`
- **THEN** those headings render as subordinate labels on the same terms as a delta operation heading
- **AND** the heading naming the spec as a whole remains the most prominent element on the page

#### Scenario: Non-spec documents are unaffected

- **WHEN** a change's proposal or design artifact is rendered
- **THEN** its level-2 headings render as content headings, exactly as before this capability existed

#### Scenario: Spec typography applies without folding

- **WHEN** spec-shaped content is rendered and folding is not requested
- **THEN** spec typography still applies

#### Scenario: Heading elements and ids are unchanged

- **WHEN** the same document is rendered with and without the spec-shaped declaration
- **THEN** every heading is the same element at the same level and carries the same `id` in both renderings
