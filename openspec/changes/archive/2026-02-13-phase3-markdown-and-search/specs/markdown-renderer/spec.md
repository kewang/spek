## ADDED Requirements

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

#### Scenario: ADDED/MODIFIED badge rendering
- **WHEN** rendered Markdown contains `ADDED` or `MODIFIED` as standalone uppercase keywords
- **THEN** `ADDED` is displayed as an orange badge and `MODIFIED` is displayed as a blue badge

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
