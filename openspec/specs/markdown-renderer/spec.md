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

### Requirement: Spec headings render without their format keyword

Under the spec-shaped declaration, and only under it, the renderer SHALL display a requirement heading
and a scenario heading without the leading OpenSpec format keyword. `### Requirement: Single YAML
manifest as source of truth` SHALL render as *Single YAML manifest as source of truth*.

The keyword is removable because position already carries it: under a delta operation heading every
level-3 heading is a requirement, and inside a requirement every level-4 heading is a scenario. Repeating
it takes the same characters off the front of every heading in the document, and takes them from the
front — where a reader scanning a column of headings looks for what distinguishes one from the next, and
where the narrowest host has the least room to give.

This SHALL NOT weaken the rule that the renderer is told its content is spec-shaped rather than deducing
it. The keyword is matched only after the caller has declared the content spec-shaped, and matching it
SHALL NOT be used to decide that a document is spec-shaped.

Whether a heading carries the keyword SHALL be decided from the heading's text **in full**, not from
whatever fragment of it happens to come first. A requirement named after a code span begins
`Requirement: ` and then leaves the markup — decide from the fragment and that heading keeps its keyword
while the table of contents, which reads the file's own line, drops it, producing on the very first real
document the disagreement between surfaces that stating the rule once exists to prevent. Where the
keyword does not lie wholly within the heading's leading run of plain text, the heading SHALL render
unchanged: eliding across markup would mean deleting part of the author's structure.

The elision SHALL apply at every heading level, not at a chosen pair of them. Level is not what makes a
heading a requirement — the keyword is — and the surfaces that display headings do not agree on which
levels they show: the rendered content shows all of them and the table of contents shows two. Gate on
level and the same heading is elided on one surface and not on the other, which is the disagreement
again by another route.

The elision SHALL be presentational only. Each heading's element, its level, and its `id` SHALL be
exactly what they would be without it. The `id` in particular is derived from the authored heading text
and is the anchor every deep link, the scrollspy, the table of contents and the VS Code sidebar resolve
against; those anchors are computed from the file's own text elsewhere, so an `id` built from the elided
text would leave every one of them pointing at nothing.

Text that does not match the format keyword SHALL render exactly as authored, which is also what happens
under a workflow schema whose format uses different keywords: no match, no elision.

#### Scenario: A requirement heading renders without its keyword

- **WHEN** spec-shaped content containing `### Requirement: Foo` is rendered
- **THEN** the heading displays as `Foo`

#### Scenario: A scenario heading renders without its keyword

- **WHEN** spec-shaped content containing `#### Scenario: bar happens` is rendered
- **THEN** the heading displays as `bar happens`

#### Scenario: A heading whose name begins with a code span is elided

- **WHEN** spec-shaped content containing ``### Requirement: `@spekjs/ui` package exports reusable components`` is rendered
- **THEN** the heading displays as `` `@spekjs/ui` package exports reusable components ``, the code span intact and the space before it preserved

#### Scenario: A heading at another level is elided on the same terms

- **WHEN** spec-shaped content containing `## Requirement: Foo` is rendered
- **THEN** the heading displays as `Foo`, matching what the table of contents shows for it

#### Scenario: The heading's id is built from the authored text

- **WHEN** spec-shaped content containing `### Requirement: Foo` is rendered
- **THEN** the rendered heading's `id` is the slug of `Requirement: Foo`, identical to the id the same content produces without the elision
- **AND** a link to that id still resolves to the heading

#### Scenario: Heading elements and levels are unchanged

- **WHEN** the same spec-shaped content is rendered with and without the elision
- **THEN** every heading is the same element at the same level in both renderings

#### Scenario: Non-spec documents are unaffected

- **WHEN** a change's proposal or design artifact is rendered without the spec-shaped declaration
- **THEN** a heading reading `Requirement: Foo` renders with its text unchanged

#### Scenario: Structural headings are unaffected

- **WHEN** spec-shaped content containing `## ADDED Requirements` and `## Purpose` is rendered
- **THEN** those headings render with their text unchanged

#### Scenario: A heading the format keyword does not match renders verbatim

- **WHEN** spec-shaped content contains a level-3 heading whose text does not begin with a format keyword
- **THEN** it renders exactly as authored

### Requirement: Syntax highlighting for fenced code blocks
The system SHALL syntax-highlight fenced code blocks in rendered Markdown. It SHALL color the tokens by the language declared on the fence. Highlight colors SHALL be per-theme color tokens. Each highlight color SHALL meet the project's color-contrast obligation in the light theme and in the dark theme. Highlight colors SHALL NOT be shipped as untokenized literals. A code block whose fence declares no language SHALL render as plain, uncolored code, and SHALL raise no error. Highlighting SHALL NOT change the behavior that keeps BDD keywords unhighlighted inside code. Highlighting SHALL NOT weaken author emphasis. A `data` artifact renders through this same pipeline as a fenced block, so the highlighting SHALL apply to it and to code fences in other Markdown documents alike.

#### Scenario: A language-tagged code block is highlighted
- **WHEN** MarkdownRenderer receives a fenced code block tagged with a language (for example ` ```json `)
- **THEN** the block's tokens are colored by that language's syntax

#### Scenario: Highlight colors meet the contrast obligation in both themes
- **WHEN** a highlighted code block renders in the light theme and in the dark theme
- **THEN** every highlight color applied to code text meets the project's contrast standard in that theme

#### Scenario: A code block with no language renders plainly
- **WHEN** MarkdownRenderer receives a fenced code block with no language hint
- **THEN** the block renders as plain, uncolored code
- **AND** no error is raised

#### Scenario: A data artifact renders as a highlighted block
- **WHEN** a `data` artifact's content renders as a fenced code block with the language from its file extension
- **THEN** the content is syntax-highlighted by the same mechanism as any other fenced code block

